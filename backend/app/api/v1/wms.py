"""
WMS (Web Map Service) proxy endpoints.

Provides proxy functionality for WMS GetCapabilities requests to avoid CORS issues.
These endpoints are only available in development mode.
"""

from typing import List, Optional
from xml.etree import ElementTree as ET

import httpx
from fastapi import APIRouter, HTTPException, Query, status

from app.config import settings

router = APIRouter(prefix="/wms", tags=["wms"])


# ============================================================================
# Response Models
# ============================================================================


class WMSLayer:
    """Represents a layer from WMS GetCapabilities response."""

    def __init__(
        self,
        name: str,
        title: str,
        abstract: Optional[str] = None,
        queryable: bool = False,
    ):
        self.name = name
        self.title = title
        self.abstract = abstract
        self.queryable = queryable

    def to_dict(self):
        return {
            "name": self.name,
            "title": self.title,
            "abstract": self.abstract,
            "queryable": self.queryable,
        }


# ============================================================================
# Helper Functions
# ============================================================================


def parse_wms_capabilities(xml_content: str) -> dict:
    """
    Parse WMS GetCapabilities XML and extract layer information.

    Handles both WMS 1.1.1 and 1.3.0 formats.

    Args:
        xml_content: Raw XML string from GetCapabilities response

    Returns:
        Dict with service_title and list of layers
    """
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        raise ValueError(f"Invalid XML: {e}")

    # Try different namespace patterns (WMS 1.1.1 vs 1.3.0)
    namespaces = [
        {"wms": "http://www.opengis.net/wms"},  # WMS 1.3.0
        {},  # No namespace (WMS 1.1.1)
    ]

    service_title = ""
    layers: List[WMSLayer] = []

    for ns in namespaces:
        # Try to get service title
        if ns:
            title_elem = root.find(".//wms:Service/wms:Title", ns)
            if title_elem is None:
                title_elem = root.find(".//wms:Title", ns)
        else:
            title_elem = root.find(".//Service/Title")
            if title_elem is None:
                title_elem = root.find(".//Title")

        if title_elem is not None and title_elem.text:
            service_title = title_elem.text

        # Find all Layer elements (skip the root capability layer)
        if ns:
            # WMS 1.3.0 with namespace
            layer_elements = root.findall(".//wms:Layer/wms:Layer", ns)
            if not layer_elements:
                # Try finding any Layer with a Name child
                layer_elements = root.findall(".//wms:Layer", ns)
        else:
            # WMS 1.1.1 without namespace
            layer_elements = root.findall(".//Layer/Layer")
            if not layer_elements:
                layer_elements = root.findall(".//Layer")

        for layer_elem in layer_elements:
            if ns:
                name_elem = layer_elem.find("wms:Name", ns)
                title_elem = layer_elem.find("wms:Title", ns)
                abstract_elem = layer_elem.find("wms:Abstract", ns)
            else:
                name_elem = layer_elem.find("Name")
                title_elem = layer_elem.find("Title")
                abstract_elem = layer_elem.find("Abstract")

            # Only include layers that have a name (can be requested)
            if name_elem is not None and name_elem.text:
                layer = WMSLayer(
                    name=name_elem.text,
                    title=title_elem.text if title_elem is not None else name_elem.text,
                    abstract=abstract_elem.text if abstract_elem is not None else None,
                    queryable=layer_elem.get("queryable") == "1",
                )
                layers.append(layer)

        # If we found layers, no need to try other namespace patterns
        if layers:
            break

    return {
        "service_title": service_title,
        "layers": [layer.to_dict() for layer in layers],
    }


# ============================================================================
# Endpoints
# ============================================================================


@router.get("/capabilities")
async def get_wms_capabilities(
    url: str = Query(..., description="WMS service base URL"),
):
    """
    Proxy for WMS GetCapabilities requests.

    Fetches the GetCapabilities document from the specified WMS server
    and returns parsed layer information as JSON.

    This endpoint is only available in development mode to avoid abuse.

    Args:
        url: Base URL of the WMS service

    Returns:
        JSON object with:
        - service_title: Title of the WMS service
        - layers: List of available layers with name, title, abstract, queryable

    Raises:
        403: If not in dev mode
        502: If WMS server request fails or returns invalid data
    """
    # Check dev mode
    if not settings.DEV_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="WMS capabilities proxy is only available in development mode",
        )

    # Build GetCapabilities URL
    # Remove any existing query parameters and add our own
    base_url = url.split("?")[0]

    params = {
        "SERVICE": "WMS",
        "VERSION": "1.3.0",
        "REQUEST": "GetCapabilities",
    }

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        try:
            response = await client.get(base_url, params=params)
            response.raise_for_status()
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="WMS server request timed out",
            )
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"WMS server returned error: {e.response.status_code}",
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to connect to WMS server: {str(e)}",
            )

    # Parse the capabilities XML
    try:
        result = parse_wms_capabilities(response.text)
    except ValueError as e:
        # If 1.3.0 fails, try 1.1.1
        params["VERSION"] = "1.1.1"
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            try:
                response = await client.get(base_url, params=params)
                response.raise_for_status()
                result = parse_wms_capabilities(response.text)
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to parse WMS capabilities: {str(e)}",
                )

    return result
