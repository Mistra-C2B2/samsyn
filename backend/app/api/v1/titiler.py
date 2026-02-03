"""
TiTiler proxy endpoints for Cloud-Optimized GeoTIFF (COG) tile serving.

Provides proxy functionality for TiTiler requests to avoid CORS issues.
In production, TiTiler should only be accessible through this proxy,
not directly from the internet.

Security:
- URL Whitelist: Only URLs stored in the database (layers.source_config) can be proxied
- This prevents proxy abuse and SSRF attacks
- No authentication required - public maps can be viewed by anyone
"""

import logging
from typing import Annotated, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.api.deps import is_admin_from_payload
from app.config import settings
from app.database import get_db
from app.services.auth_service import auth_service
from app.services.url_whitelist_service import URLWhitelistService

logger = logging.getLogger(__name__)

# Security scheme for optional authentication
security = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/titiler", tags=["titiler"])


# ============================================================================
# Dependencies
# ============================================================================


def get_http_client(request: Request) -> httpx.AsyncClient:
    """
    Get the shared HTTP client from application state.

    This client is configured with connection pooling to prevent
    connection exhaustion when handling many concurrent requests.
    """
    return request.app.state.http_client


# ============================================================================
# Helper Functions
# ============================================================================


def _check_titiler_configured():
    """Check if TiTiler URL is configured."""
    if not settings.TITILER_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="TiTiler is not configured. Set TITILER_URL in environment.",
        )


async def get_is_admin(
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials], Depends(security)
    ] = None,
) -> bool:
    """
    Dependency to check if current request is from an admin user.

    Extracts and verifies JWT token, then checks for admin status in publicMetadata.

    Returns:
        True if request is from an admin user, False otherwise
    """
    if not credentials:
        return False

    try:
        token = credentials.credentials
        payload = await auth_service.verify_token(token)
        is_admin = is_admin_from_payload(payload)

        if is_admin:
            logger.debug(f"Admin access detected for user: {payload.get('sub')}")

        return is_admin
    except Exception as e:
        logger.debug(f"Admin check failed: {e}")
        return False


def _validate_url_whitelisted(url: str, db: Session, is_admin: bool = False):
    """
    Validate that the URL is whitelisted in the database.

    Only URLs stored in layers.source_config can be proxied.
    This prevents proxy abuse and SSRF attacks.

    Admin users can bypass the whitelist check to allow previewing/validating
    GeoTIFFs before creating layers.

    Args:
        url: URL to validate
        db: Database session
        is_admin: Whether the request is from an admin user

    Raises:
        HTTPException: 403 if URL is not whitelisted and user is not admin
    """
    # Admin users can bypass whitelist for validation purposes
    if is_admin:
        logger.info(f"Admin user accessing URL (whitelist bypassed): {url}")
        return

    # Non-admin users must have URL in whitelist
    whitelist_service = URLWhitelistService(db)
    is_whitelisted = whitelist_service.is_url_whitelisted(url)

    if not is_whitelisted:
        logger.warning(f"Rejected non-whitelisted URL: {url}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "URL not authorized. Only GeoTIFF URLs from database "
                "layers can be accessed."
            ),
        )


def _generate_empty_tile() -> bytes:
    """
    Generate a transparent 1x1 PNG tile.

    Used when a tile is requested outside the GeoTIFF bounds,
    which is normal behavior for tile servers.
    """
    # Transparent 1x1 PNG (67 bytes)
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _parse_titiler_error(response: httpx.Response) -> str:
    """
    Parse TiTiler error response and return a user-friendly message.
    """
    status_code = response.status_code

    # Try to get error detail from JSON response
    error_detail = None
    try:
        error_json = response.json()
        error_detail = error_json.get("detail") or error_json.get("message")
    except Exception:
        pass

    # Map common errors to user-friendly messages
    if status_code == 404:
        return "GeoTIFF URL not found. Please check the URL is correct and accessible."
    elif status_code == 403:
        return "Access denied to GeoTIFF file. The file may require authentication."
    elif status_code == 500:
        if error_detail:
            # Check for common TiTiler error patterns
            detail_lower = error_detail.lower() if isinstance(error_detail, str) else ""
            if "not a valid cog" in detail_lower or "not a cog" in detail_lower:
                return "File is not a valid Cloud-Optimized GeoTIFF (COG)."
            elif "unable to open" in detail_lower or "cannot open" in detail_lower:
                return (
                    "Unable to open GeoTIFF file. "
                    "The URL may be invalid or inaccessible."
                )
            elif "404" in detail_lower or "not found" in detail_lower:
                return "GeoTIFF URL not found. Please check the URL is correct."
            else:
                return f"Error processing GeoTIFF: {error_detail}"
        return (
            "Unable to process GeoTIFF. The URL may be invalid or "
            "the file may not be a valid COG."
        )
    elif status_code == 400:
        if error_detail:
            return f"Invalid request: {error_detail}"
        return "Invalid request parameters."
    else:
        if error_detail:
            return f"TiTiler error ({status_code}): {error_detail}"
        return f"TiTiler returned error: {status_code}"


# ============================================================================
# Endpoints
# ============================================================================


@router.get("/tiles/{z}/{x}/{y}")
async def get_cog_tile(
    z: int,
    x: int,
    y: int,
    url: str = Query(..., description="URL to the COG file"),
    colormap: Optional[str] = Query(
        None, description="Colormap name (e.g., viridis, terrain)"
    ),
    rescale: Optional[str] = Query(
        None, description="Min,max values for rescaling (e.g., 0,255)"
    ),
    bidx: Optional[str] = Query(
        None, description="Band index or indices (e.g., 1 or 1,2,3)"
    ),
    nodata: Optional[str] = Query(None, description="Nodata value to use"),
    db: Annotated[Session, Depends(get_db)] = None,
    http_client: Annotated[httpx.AsyncClient, Depends(get_http_client)] = None,
):
    """
    Proxy for TiTiler COG tile requests.

    Fetches a tile from TiTiler for the specified COG file and returns it.

    Args:
        z: Zoom level
        x: Tile X coordinate
        y: Tile Y coordinate
        url: URL to the Cloud-Optimized GeoTIFF file
        colormap: Optional colormap name (viridis, terrain, blues, etc.)
        rescale: Optional rescale range (min,max)
        bidx: Optional band index/indices
        nodata: Optional nodata value

    Returns:
        PNG tile image

    Raises:
        403: If URL is not whitelisted
        503: If TiTiler is not configured
        502: If TiTiler request fails
    """
    _check_titiler_configured()
    _validate_url_whitelisted(url, db)

    # Build TiTiler tile URL
    titiler_url = (
        f"{settings.TITILER_URL.rstrip('/')}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}"
    )

    # Build query parameters
    params = {"url": url}
    if colormap:
        params["colormap_name"] = colormap
    if rescale:
        params["rescale"] = rescale
    if bidx:
        params["bidx"] = bidx
    if nodata:
        params["nodata"] = nodata

    try:
        response = await http_client.get(titiler_url, params=params)
        response.raise_for_status()
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="TiTiler request timed out",
        )
    except httpx.HTTPStatusError as e:
        # 404 errors typically mean the tile is outside the GeoTIFF bounds
        # Return a transparent tile instead of an error (normal for tile servers)
        if e.response.status_code == 404:
            logger.debug(
                f"Tile outside bounds for {url} at {z}/{x}/{y}, returning empty tile"
            )
            return Response(
                content=_generate_empty_tile(),
                media_type="image/png",
                headers={
                    "Cache-Control": "public, max-age=3600",
                },
            )
        # For other HTTP errors, raise as before
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=_parse_titiler_error(e.response),
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to connect to TiTiler: {str(e)}",
        )

    # Return the tile image
    return Response(
        content=response.content,
        media_type=response.headers.get("content-type", "image/png"),
        headers={
            "Cache-Control": "public, max-age=3600",
        },
    )


@router.get("/info")
async def get_cog_info(
    url: str = Query(..., description="URL to the COG file"),
    db: Annotated[Session, Depends(get_db)] = None,
    is_admin: Annotated[bool, Depends(get_is_admin)] = False,
    http_client: Annotated[httpx.AsyncClient, Depends(get_http_client)] = None,
):
    """
    Get metadata/info for a Cloud-Optimized GeoTIFF file.

    Returns bounds, min/max zoom, band information, data type, and nodata value.

    Admin users can access any URL (for validation before creating layers).
    Non-admin users can only access URLs that exist in the database.

    Args:
        url: URL to the Cloud-Optimized GeoTIFF file

    Returns:
        JSON object with:
        - bounds: Geographic bounds [west, south, east, north]
        - minzoom: Minimum zoom level
        - maxzoom: Maximum zoom level
        - band_metadata: List of band information
        - dtype: Data type of the raster
        - nodata: Nodata value (if set)

    Raises:
        403: If URL is not whitelisted and user is not admin
        503: If TiTiler is not configured
        502: If TiTiler request fails
    """
    _check_titiler_configured()
    _validate_url_whitelisted(url, db, is_admin)

    # Build TiTiler info URL
    titiler_url = f"{settings.TITILER_URL.rstrip('/')}/cog/info"
    params = {"url": url}

    try:
        response = await http_client.get(titiler_url, params=params)
        response.raise_for_status()
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="TiTiler request timed out",
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=_parse_titiler_error(e.response),
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to connect to TiTiler: {str(e)}",
        )

    return response.json()


@router.get("/statistics")
async def get_cog_statistics(
    url: str = Query(..., description="URL to the COG file"),
    bidx: Optional[str] = Query(
        None, description="Band index or indices (e.g., 1 or 1,2,3)"
    ),
    db: Annotated[Session, Depends(get_db)] = None,
    is_admin: Annotated[bool, Depends(get_is_admin)] = False,
    http_client: Annotated[httpx.AsyncClient, Depends(get_http_client)] = None,
):
    """
    Get band statistics for a Cloud-Optimized GeoTIFF file.

    Returns min, max, mean, and std for each band. Useful for determining
    appropriate rescale values.

    Admin users can access any URL (for validation before creating layers).
    Non-admin users can only access URLs that exist in the database.

    Args:
        url: URL to the Cloud-Optimized GeoTIFF file
        bidx: Optional band index/indices to get statistics for

    Returns:
        JSON object with statistics per band:
        - min: Minimum value
        - max: Maximum value
        - mean: Mean value
        - std: Standard deviation

    Raises:
        403: If URL is not whitelisted and user is not admin
        503: If TiTiler is not configured
        502: If TiTiler request fails
    """
    _check_titiler_configured()
    _validate_url_whitelisted(url, db, is_admin)

    # Build TiTiler statistics URL
    titiler_url = f"{settings.TITILER_URL.rstrip('/')}/cog/statistics"
    params = {"url": url}
    if bidx:
        params["bidx"] = bidx

    # Statistics can take longer, use extended timeout
    try:
        response = await http_client.get(titiler_url, params=params, timeout=60.0)
        response.raise_for_status()
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=(
                "TiTiler statistics request timed out "
                "(this can take a while for large files)"
            ),
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=_parse_titiler_error(e.response),
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to connect to TiTiler: {str(e)}",
        )

    return response.json()


@router.get("/preview")
async def get_cog_preview(
    url: str = Query(..., description="URL to the COG file"),
    width: int = Query(256, description="Preview width in pixels"),
    height: int = Query(256, description="Preview height in pixels"),
    colormap: Optional[str] = Query(None, description="Colormap name"),
    rescale: Optional[str] = Query(None, description="Min,max values for rescaling"),
    bidx: Optional[str] = Query(None, description="Band index or indices"),
    db: Annotated[Session, Depends(get_db)] = None,
    is_admin: Annotated[bool, Depends(get_is_admin)] = False,
    http_client: Annotated[httpx.AsyncClient, Depends(get_http_client)] = None,
):
    """
    Get a preview image of a Cloud-Optimized GeoTIFF file.

    Returns a small preview image of the entire COG extent.

    Admin users can access any URL (for validation before creating layers).
    Non-admin users can only access URLs that exist in the database.

    Args:
        url: URL to the Cloud-Optimized GeoTIFF file
        width: Preview width in pixels (default: 256)
        height: Preview height in pixels (default: 256)
        colormap: Optional colormap name
        rescale: Optional rescale range
        bidx: Optional band index/indices

    Returns:
        PNG preview image

    Raises:
        403: If URL is not whitelisted and user is not admin
        503: If TiTiler is not configured
        502: If TiTiler request fails
    """
    _check_titiler_configured()
    _validate_url_whitelisted(url, db, is_admin)

    # Build TiTiler preview URL
    titiler_url = f"{settings.TITILER_URL.rstrip('/')}/cog/preview.png"
    params = {
        "url": url,
        "width": width,
        "height": height,
    }
    if colormap:
        params["colormap_name"] = colormap
    if rescale:
        params["rescale"] = rescale
    if bidx:
        params["bidx"] = bidx

    try:
        response = await http_client.get(titiler_url, params=params)
        response.raise_for_status()
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="TiTiler preview request timed out",
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=_parse_titiler_error(e.response),
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to connect to TiTiler: {str(e)}",
        )

    return Response(
        content=response.content,
        media_type=response.headers.get("content-type", "image/png"),
    )
