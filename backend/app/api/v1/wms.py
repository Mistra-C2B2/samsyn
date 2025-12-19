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


class WMSStyle:
    """Represents a style from WMS GetCapabilities."""

    def __init__(
        self,
        name: str,
        title: str,
        legend_url: Optional[str] = None,
    ):
        self.name = name
        self.title = title
        self.legend_url = legend_url

    def to_dict(self):
        return {
            "name": self.name,
            "title": self.title,
            "legendUrl": self.legend_url,
        }


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
        styles: Optional[List[WMSStyle]] = None,
        bounds: Optional[List[float]] = None,  # [west, south, east, north]
        crs: Optional[List[str]] = None,  # Supported coordinate reference systems
    ):
        self.name = name
        self.title = title
        self.abstract = abstract
        self.queryable = queryable
        self.dimensions = dimensions or []
        self.styles = styles or []
        self.bounds = bounds
        self.crs = crs or []

    def to_dict(self):
        return {
            "name": self.name,
            "title": self.title,
            "abstract": self.abstract,
            "queryable": self.queryable,
            "dimensions": [d.to_dict() for d in self.dimensions],
            "styles": [s.to_dict() for s in self.styles],
            "bounds": self.bounds,
            "crs": self.crs,
        }


# ============================================================================
# Helper Functions
# ============================================================================


def _find_elem(root: ET.Element, ns: dict, with_ns_path: str, without_ns_path: str):
    """Helper to find element with or without namespace."""
    if ns:
        return root.find(with_ns_path, ns)
    return root.find(without_ns_path)


def _find_all_elems(root: ET.Element, ns: dict, with_ns_path: str, without_ns_path: str):
    """Helper to find all elements with or without namespace."""
    if ns:
        return root.findall(with_ns_path, ns)
    return root.findall(without_ns_path)


def parse_wms_capabilities(xml_content: str) -> dict:
    """
    Parse WMS GetCapabilities XML and extract layer information.

    Handles both WMS 1.1.1 and 1.3.0 formats.

    Args:
        xml_content: Raw XML string from GetCapabilities response

    Returns:
        Dict with service_title, version, supported formats, and list of layers
    """
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        raise ValueError(f"Invalid XML: {e}")

    # Detect WMS version from root element
    wms_version = root.get("version", "1.3.0")

    # Determine namespace based on root element
    # WMS 1.3.0 uses namespace, WMS 1.1.1 typically doesn't
    ns: dict = {}
    if root.tag.startswith("{http://www.opengis.net/wms}"):
        ns = {"wms": "http://www.opengis.net/wms"}

    # Initialize service metadata
    service_title = ""
    service_abstract = ""
    service_provider = ""
    service_contact_email = ""
    service_access_constraints = ""
    service_fees = ""
    getmap_formats: List[str] = []
    getfeatureinfo_formats: List[str] = []
    layers: List[WMSLayer] = []

    # Parse service title
    title_elem = _find_elem(root, ns, ".//wms:Service/wms:Title", ".//Service/Title")
    if title_elem is None:
        title_elem = _find_elem(root, ns, ".//wms:Title", ".//Title")
    if title_elem is not None and title_elem.text:
        service_title = title_elem.text

    # Parse service abstract
    abstract_elem = _find_elem(root, ns, ".//wms:Service/wms:Abstract", ".//Service/Abstract")
    if abstract_elem is not None and abstract_elem.text:
        service_abstract = abstract_elem.text.strip()

    # Parse contact information
    org_elem = _find_elem(
        root, ns,
        ".//wms:Service/wms:ContactInformation/wms:ContactPersonPrimary/wms:ContactOrganization",
        ".//Service/ContactInformation/ContactPersonPrimary/ContactOrganization"
    )
    email_elem = _find_elem(
        root, ns,
        ".//wms:Service/wms:ContactInformation/wms:ContactElectronicMailAddress",
        ".//Service/ContactInformation/ContactElectronicMailAddress"
    )
    if org_elem is not None and org_elem.text and org_elem.text.strip():
        service_provider = org_elem.text.strip()
    if email_elem is not None and email_elem.text and email_elem.text.strip():
        service_contact_email = email_elem.text.strip()

    # Parse access constraints
    constraints_elem = _find_elem(root, ns, ".//wms:Service/wms:AccessConstraints", ".//Service/AccessConstraints")
    if constraints_elem is not None and constraints_elem.text and constraints_elem.text.strip():
        service_access_constraints = constraints_elem.text.strip()

    # Parse fees
    fees_elem = _find_elem(root, ns, ".//wms:Service/wms:Fees", ".//Service/Fees")
    if fees_elem is not None and fees_elem.text and fees_elem.text.strip():
        service_fees = fees_elem.text.strip()

    # Parse supported GetMap formats
    getmap_format_elems = _find_all_elems(
        root, ns,
        ".//wms:Capability/wms:Request/wms:GetMap/wms:Format",
        ".//Capability/Request/GetMap/Format"
    )
    for fmt_elem in getmap_format_elems:
        if fmt_elem.text:
            getmap_formats.append(fmt_elem.text.strip())

    # Parse supported GetFeatureInfo formats
    gfi_format_elems = _find_all_elems(
        root, ns,
        ".//wms:Capability/wms:Request/wms:GetFeatureInfo/wms:Format",
        ".//Capability/Request/GetFeatureInfo/Format"
    )
    for fmt_elem in gfi_format_elems:
        if fmt_elem.text:
            getfeatureinfo_formats.append(fmt_elem.text.strip())

    # Find all Layer elements (skip the root capability layer)
    layer_elements = _find_all_elems(root, ns, ".//wms:Layer/wms:Layer", ".//Layer/Layer")
    if not layer_elements:
        layer_elements = _find_all_elems(root, ns, ".//wms:Layer", ".//Layer")

    for layer_elem in layer_elements:
        name_elem = _find_elem(layer_elem, ns, "wms:Name", "Name")
        layer_title_elem = _find_elem(layer_elem, ns, "wms:Title", "Title")
        layer_abstract_elem = _find_elem(layer_elem, ns, "wms:Abstract", "Abstract")
        dimension_elems = _find_all_elems(layer_elem, ns, "wms:Dimension", "Dimension")
        style_elems = _find_all_elems(layer_elem, ns, "wms:Style", "Style")

        # Parse CRS/SRS (WMS 1.3.0 uses CRS, WMS 1.1.1 uses SRS)
        crs_list: List[str] = []
        if ns:
            crs_elems = layer_elem.findall("wms:CRS", ns)
        else:
            crs_elems = layer_elem.findall("SRS")
        for crs_elem in crs_elems:
            if crs_elem.text:
                crs_list.append(crs_elem.text.strip())

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

        # Parse styles
        styles: List[WMSStyle] = []
        for style_elem in style_elems:
            style_name_elem = _find_elem(style_elem, ns, "wms:Name", "Name")
            style_title_elem = _find_elem(style_elem, ns, "wms:Title", "Title")
            legend_url_elem = _find_elem(style_elem, ns, "wms:LegendURL/wms:OnlineResource", "LegendURL/OnlineResource")

            if style_name_elem is not None and style_name_elem.text:
                legend_url = None
                if legend_url_elem is not None:
                    legend_url = legend_url_elem.get("{http://www.w3.org/1999/xlink}href")
                    if legend_url is None:
                        legend_url = legend_url_elem.get("href")

                styles.append(
                    WMSStyle(
                        name=style_name_elem.text,
                        title=style_title_elem.text if style_title_elem is not None else style_name_elem.text,
                        legend_url=legend_url,
                    )
                )

        # Parse bounding box
        bounds: Optional[List[float]] = None
        if ns:
            # WMS 1.3.0: EX_GeographicBoundingBox
            geo_bbox = layer_elem.find("wms:EX_GeographicBoundingBox", ns)
            if geo_bbox is not None:
                west = geo_bbox.find("wms:westBoundLongitude", ns)
                south = geo_bbox.find("wms:southBoundLatitude", ns)
                east = geo_bbox.find("wms:eastBoundLongitude", ns)
                north = geo_bbox.find("wms:northBoundLatitude", ns)
                if all(e is not None and e.text for e in [west, south, east, north]):
                    try:
                        bounds = [
                            float(west.text),
                            float(south.text),
                            float(east.text),
                            float(north.text),
                        ]
                    except ValueError:
                        pass
        else:
            # WMS 1.1.1: LatLonBoundingBox
            latlon_bbox = layer_elem.find("LatLonBoundingBox")
            if latlon_bbox is not None:
                try:
                    bounds = [
                        float(latlon_bbox.get("minx", 0)),
                        float(latlon_bbox.get("miny", 0)),
                        float(latlon_bbox.get("maxx", 0)),
                        float(latlon_bbox.get("maxy", 0)),
                    ]
                except ValueError:
                    pass

        # Only include layers that have a name (can be requested)
        if name_elem is not None and name_elem.text:
            layer = WMSLayer(
                name=name_elem.text,
                title=layer_title_elem.text if layer_title_elem is not None else name_elem.text,
                abstract=layer_abstract_elem.text if layer_abstract_elem is not None else None,
                queryable=layer_elem.get("queryable") == "1",
                dimensions=dimensions,
                styles=styles,
                bounds=bounds,
                crs=crs_list,
            )
            layers.append(layer)

    return {
        "version": wms_version,
        "service_title": service_title,
        "service_abstract": service_abstract or None,
        "service_provider": service_provider or None,
        "service_contact_email": service_contact_email or None,
        "service_access_constraints": service_access_constraints or None,
        "service_fees": service_fees or None,
        "getmap_formats": getmap_formats,
        "getfeatureinfo_formats": getfeatureinfo_formats,
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
    version: str = Query("1.3.0", description="WMS version (1.1.1 or 1.3.0)"),
    cql_filter: Optional[str] = Query(None, description="CQL_FILTER for GeoServer (vendor extension)"),
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
        version: WMS version (1.1.1 or 1.3.0)
        cql_filter: Optional CQL_FILTER for GeoServer (vendor extension)

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

    # Handle BBOX and coordinate parameters based on WMS version
    bbox_parts = bbox.split(",")
    if len(bbox_parts) == 4:
        west, south, east, north = bbox_parts
    else:
        # Invalid bbox, use as-is
        west, south, east, north = "0", "0", "0", "0"

    # Build version-specific parameters
    if version == "1.1.1":
        # WMS 1.1.1: SRS parameter, X/Y for pixel coordinates
        # BBOX is always minx,miny,maxx,maxy (west,south,east,north)
        params = {
            "SERVICE": "WMS",
            "VERSION": "1.1.1",
            "REQUEST": "GetFeatureInfo",
            "LAYERS": layers,
            "QUERY_LAYERS": layers,
            "INFO_FORMAT": info_format,
            "SRS": "EPSG:4326",
            "BBOX": f"{west},{south},{east},{north}",
            "WIDTH": str(width),
            "HEIGHT": str(height),
            "X": str(x),
            "Y": str(y),
        }
    else:
        # WMS 1.3.0: CRS parameter, I/J for pixel coordinates
        # For EPSG:4326 in WMS 1.3.0, BBOX order is: minLat,minLon,maxLat,maxLon (south,west,north,east)
        bbox_4326 = f"{south},{west},{north},{east}"
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

    # Add CQL_FILTER if provided (GeoServer/MapServer vendor extension)
    if cql_filter:
        params["CQL_FILTER"] = cql_filter

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


@router.get("/discover-properties")
async def discover_wms_layer_properties(
    url: str = Query(..., description="WMS service base URL"),
    layer: str = Query(..., description="Layer name to discover properties for"),
    bounds: Optional[str] = Query(None, description="Layer bounds (west,south,east,north) for sampling"),
    version: str = Query("1.3.0", description="WMS version"),
):
    """
    Discover available properties/columns in a WMS layer.

    This makes a sample GetFeatureInfo request to discover what properties
    are available for CQL filtering.

    Args:
        url: Base URL of the WMS service
        layer: Layer name to query
        bounds: Optional layer bounds for better sampling location
        version: WMS version

    Returns:
        List of discovered properties with sample values
    """
    if not settings.DEV_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="WMS property discovery is only available in development mode",
        )

    base_url = url.split("?")[0]

    # Determine sampling location (center of bounds or default global location)
    if bounds:
        try:
            west, south, east, north = [float(x) for x in bounds.split(",")]
            center_lon = (west + east) / 2
            center_lat = (south + north) / 2
        except (ValueError, IndexError):
            center_lon, center_lat = 0, 0
    else:
        center_lon, center_lat = 0, 0

    # Create a small bbox around the center point
    bbox_size = 10  # degrees
    west = center_lon - bbox_size
    east = center_lon + bbox_size
    south = max(-85, center_lat - bbox_size)
    north = min(85, center_lat + bbox_size)

    # Build GetFeatureInfo request
    if version == "1.1.1":
        params = {
            "SERVICE": "WMS",
            "VERSION": "1.1.1",
            "REQUEST": "GetFeatureInfo",
            "LAYERS": layer,
            "QUERY_LAYERS": layer,
            "INFO_FORMAT": "application/json",
            "SRS": "EPSG:4326",
            "BBOX": f"{west},{south},{east},{north}",
            "WIDTH": "256",
            "HEIGHT": "256",
            "X": "128",
            "Y": "128",
        }
    else:
        # WMS 1.3.0 with axis order for EPSG:4326
        bbox_4326 = f"{south},{west},{north},{east}"
        params = {
            "SERVICE": "WMS",
            "VERSION": "1.3.0",
            "REQUEST": "GetFeatureInfo",
            "LAYERS": layer,
            "QUERY_LAYERS": layer,
            "INFO_FORMAT": "application/json",
            "CRS": "EPSG:4326",
            "BBOX": bbox_4326,
            "WIDTH": "256",
            "HEIGHT": "256",
            "I": "128",
            "J": "128",
        }

    discovered_properties = []

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        try:
            response = await client.get(base_url, params=params)
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")

            if "json" in content_type or "geo+json" in content_type:
                try:
                    data = response.json()
                    features = data.get("features", [])

                    if features and len(features) > 0:
                        # Extract properties from first feature
                        props = features[0].get("properties", {})
                        for key, value in props.items():
                            # Skip internal/geometry fields
                            if key.startswith("_") or key == "geometry":
                                continue
                            discovered_properties.append({
                                "name": key,
                                "sampleValue": str(value) if value is not None else None,
                                "type": type(value).__name__ if value is not None else "unknown"
                            })
                except Exception:
                    pass
            elif "html" in content_type:
                # Try to parse HTML table response
                import re
                html_content = response.text
                headers = re.findall(r'<th[^>]*>([^<]*)</th>', html_content, re.IGNORECASE)
                headers = [h.strip() for h in headers if h.strip()]

                # Get first row of data
                tbody_match = re.search(r'<tbody[^>]*>(.*?)</tbody>', html_content, re.DOTALL | re.IGNORECASE)
                if tbody_match and headers:
                    tbody_content = tbody_match.group(1)
                    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', tbody_content, re.DOTALL | re.IGNORECASE)

                    if rows:
                        cells = re.findall(r'<td[^>]*>([^<]*)</td>', rows[0], re.IGNORECASE)
                        for i, header in enumerate(headers):
                            sample_value = cells[i].strip() if i < len(cells) else None
                            discovered_properties.append({
                                "name": header,
                                "sampleValue": sample_value,
                                "type": "string"
                            })

        except Exception as e:
            # Return empty properties list on error - discovery is best-effort
            return {
                "properties": [],
                "error": str(e),
                "message": "Could not discover properties. The layer may not support GetFeatureInfo or no data exists at the sample location."
            }

    return {
        "properties": discovered_properties,
        "message": f"Discovered {len(discovered_properties)} properties" if discovered_properties else "No properties found at sample location. Try adding the layer and clicking on data."
    }
