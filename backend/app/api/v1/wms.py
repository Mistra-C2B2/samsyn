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


class WMSDimension:
    """Represents a dimension (e.g., TIME, ELEVATION) from WMS GetCapabilities."""

    def __init__(
        self,
        name: str,
        extent: str,
        units: Optional[str] = None,
        default: Optional[str] = None,
    ):
        self.name = name
        self.extent = extent
        self.units = units
        self.default = default

    def to_dict(self):
        return {
            "name": self.name,
            "extent": self.extent,
            "units": self.units,
            "default": self.default,
        }


class WMSLayer:
    """Represents a layer from WMS GetCapabilities response."""

    def __init__(
        self,
        name: str,
        title: str,
        abstract: Optional[str] = None,
        queryable: bool = False,
        dimensions: Optional[List[WMSDimension]] = None,
    ):
        self.name = name
        self.title = title
        self.abstract = abstract
        self.queryable = queryable
        self.dimensions = dimensions or []

    def to_dict(self):
        return {
            "name": self.name,
            "title": self.title,
            "abstract": self.abstract,
            "queryable": self.queryable,
            "dimensions": [d.to_dict() for d in self.dimensions],
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
                dimension_elems = layer_elem.findall("wms:Dimension", ns)
            else:
                name_elem = layer_elem.find("Name")
                title_elem = layer_elem.find("Title")
                abstract_elem = layer_elem.find("Abstract")
                dimension_elems = layer_elem.findall("Dimension")

            # Parse dimensions (TIME, ELEVATION, etc.)
            dimensions: List[WMSDimension] = []
            for dim_elem in dimension_elems:
                dim_name = dim_elem.get("name")
                dim_extent = dim_elem.text.strip() if dim_elem.text else None
                if dim_name and dim_extent:
                    dimensions.append(
                        WMSDimension(
                            name=dim_name,
                            extent=dim_extent,
                            units=dim_elem.get("units"),
                            default=dim_elem.get("default"),
                        )
                    )

            # Only include layers that have a name (can be requested)
            if name_elem is not None and name_elem.text:
                layer = WMSLayer(
                    name=name_elem.text,
                    title=title_elem.text if title_elem is not None else name_elem.text,
                    abstract=abstract_elem.text if abstract_elem is not None else None,
                    queryable=layer_elem.get("queryable") == "1",
                    dimensions=dimensions,
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


@router.get("/feature-info")
async def get_wms_feature_info(
    url: str = Query(..., description="WMS service base URL"),
    layers: str = Query(..., description="Layer name(s) to query"),
    bbox: str = Query(..., description="Bounding box (west,south,east,north)"),
    width: int = Query(..., description="Map width in pixels"),
    height: int = Query(..., description="Map height in pixels"),
    x: int = Query(..., description="X pixel coordinate of query point"),
    y: int = Query(..., description="Y pixel coordinate of query point"),
    info_format: str = Query("text/html", description="Response format (text/html is most widely supported)"),
    time: Optional[str] = Query(None, description="TIME parameter for temporal layers"),
):
    """
    Proxy for WMS GetFeatureInfo requests.

    Fetches feature information at a specific point from the WMS server.
    This endpoint is only available in development mode to avoid abuse.

    Args:
        url: Base URL of the WMS service
        layers: Layer name(s) to query
        bbox: Bounding box in format "west,south,east,north"
        width: Map width in pixels
        height: Map height in pixels
        x: X pixel coordinate of query point
        y: Y pixel coordinate of query point
        info_format: Desired response format (default: application/json)
        time: Optional TIME parameter for temporal layers

    Returns:
        The raw response from the WMS server

    Raises:
        403: If not in dev mode
        502: If WMS server request fails
    """
    # Check dev mode
    if not settings.DEV_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="WMS feature info proxy is only available in development mode",
        )

    # Build GetFeatureInfo URL
    base_url = url.split("?")[0]

    # For WMS 1.3.0 with EPSG:4326, BBOX order is: minLat,minLon,maxLat,maxLon (south,west,north,east)
    # The frontend sends: west,south,east,north - we need to reorder for EPSG:4326
    bbox_parts = bbox.split(",")
    if len(bbox_parts) == 4:
        west, south, east, north = bbox_parts
        # Reorder for EPSG:4326 in WMS 1.3.0: minY,minX,maxY,maxX
        bbox_4326 = f"{south},{west},{north},{east}"
    else:
        bbox_4326 = bbox

    params = {
        "SERVICE": "WMS",
        "VERSION": "1.3.0",
        "REQUEST": "GetFeatureInfo",
        "LAYERS": layers,
        "QUERY_LAYERS": layers,
        "INFO_FORMAT": info_format,
        "CRS": "EPSG:4326",
        "BBOX": bbox_4326,
        "WIDTH": str(width),
        "HEIGHT": str(height),
        "I": str(x),
        "J": str(y),
    }

    # Add TIME parameter if provided (for temporal layers)
    if time:
        params["TIME"] = time

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

    # Return the response based on content type
    content_type = response.headers.get("content-type", "").lower()

    if "json" in content_type:
        # Parse and return JSON
        try:
            return response.json()
        except Exception:
            return {"raw": response.text}
    elif "html" in content_type:
        # Try to parse HTML table and extract data
        try:
            html_content = response.text
            # Parse HTML to extract table data
            import re

            # Extract table rows
            features = []

            # Find all header cells
            headers = re.findall(r'<th[^>]*>([^<]*)</th>', html_content, re.IGNORECASE)
            # Filter out empty headers
            headers = [h.strip() for h in headers if h.strip()]

            # Find all data rows (tbody tr)
            tbody_match = re.search(r'<tbody[^>]*>(.*?)</tbody>', html_content, re.DOTALL | re.IGNORECASE)
            if tbody_match and headers:
                tbody_content = tbody_match.group(1)
                # Find all rows
                rows = re.findall(r'<tr[^>]*>(.*?)</tr>', tbody_content, re.DOTALL | re.IGNORECASE)

                for row in rows:
                    # Extract cell values
                    cells = re.findall(r'<td[^>]*>([^<]*)</td>', row, re.IGNORECASE)
                    if cells and len(cells) == len(headers):
                        # Create properties dict from headers and cells
                        properties = {}
                        for header, cell in zip(headers, cells):
                            properties[header.strip()] = cell.strip()
                        features.append({
                            "type": "Feature",
                            "properties": properties
                        })

            # Always return features array (even if empty) so frontend knows parsing succeeded
            return {"features": features}
        except Exception:
            return {"type": "html", "content": response.text}
    else:
        # Return text content
        return {"type": "text", "content": response.text}
