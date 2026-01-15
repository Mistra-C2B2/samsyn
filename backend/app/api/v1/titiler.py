"""
TiTiler proxy endpoints for Cloud-Optimized GeoTIFF (COG) tile serving.

Provides proxy functionality for TiTiler requests to avoid CORS issues.
In production, TiTiler should only be accessible through this proxy,
not directly from the internet.

Security:
- In DEV_MODE: No authentication required (for easier testing)
- In Production: Requires valid Clerk session (authenticated user)
"""

from typing import Annotated, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from app.config import settings
from app.api.deps import get_current_user_optional
from app.models.user import User

router = APIRouter(prefix="/titiler", tags=["titiler"])


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


def _check_access(user: Optional[User]):
    """
    Check if the request has access to TiTiler proxy.

    In DEV_MODE: Always allowed (no auth required)
    In Production: Requires authenticated user
    """
    if settings.DEV_MODE:
        return  # Allow all requests in dev mode

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to access GeoTIFF tiles",
            headers={"WWW-Authenticate": "Bearer"},
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
                return "Unable to open GeoTIFF file. The URL may be invalid or inaccessible."
            elif "404" in detail_lower or "not found" in detail_lower:
                return "GeoTIFF URL not found. Please check the URL is correct."
            else:
                return f"Error processing GeoTIFF: {error_detail}"
        return "Unable to process GeoTIFF. The URL may be invalid or the file may not be a valid COG."
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
    colormap: Optional[str] = Query(None, description="Colormap name (e.g., viridis, terrain)"),
    rescale: Optional[str] = Query(None, description="Min,max values for rescaling (e.g., 0,255)"),
    bidx: Optional[str] = Query(None, description="Band index or indices (e.g., 1 or 1,2,3)"),
    nodata: Optional[str] = Query(None, description="Nodata value to use"),
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
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
        401: If not authenticated (production only)
        503: If TiTiler is not configured
        502: If TiTiler request fails
    """
    _check_access(current_user)
    _check_titiler_configured()

    # Build TiTiler tile URL
    titiler_url = f"{settings.TITILER_URL.rstrip('/')}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}"

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

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        try:
            response = await client.get(titiler_url, params=params)
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
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    """
    Get metadata/info for a Cloud-Optimized GeoTIFF file.

    Returns bounds, min/max zoom, band information, data type, and nodata value.

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
        401: If not authenticated (production only)
        503: If TiTiler is not configured
        502: If TiTiler request fails
    """
    _check_access(current_user)
    _check_titiler_configured()

    # Build TiTiler info URL
    titiler_url = f"{settings.TITILER_URL.rstrip('/')}/cog/info"
    params = {"url": url}

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        try:
            response = await client.get(titiler_url, params=params)
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
    bidx: Optional[str] = Query(None, description="Band index or indices (e.g., 1 or 1,2,3)"),
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    """
    Get band statistics for a Cloud-Optimized GeoTIFF file.

    Returns min, max, mean, and std for each band. Useful for determining
    appropriate rescale values.

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
        401: If not authenticated (production only)
        503: If TiTiler is not configured
        502: If TiTiler request fails
    """
    _check_access(current_user)
    _check_titiler_configured()

    # Build TiTiler statistics URL
    titiler_url = f"{settings.TITILER_URL.rstrip('/')}/cog/statistics"
    params = {"url": url}
    if bidx:
        params["bidx"] = bidx

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        try:
            response = await client.get(titiler_url, params=params)
            response.raise_for_status()
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="TiTiler statistics request timed out (this can take a while for large files)",
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
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    """
    Get a preview image of a Cloud-Optimized GeoTIFF file.

    Returns a small preview image of the entire COG extent.

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
        401: If not authenticated (production only)
        503: If TiTiler is not configured
        502: If TiTiler request fails
    """
    _check_access(current_user)
    _check_titiler_configured()

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

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        try:
            response = await client.get(titiler_url, params=params)
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
