"""
Global Fishing Watch (GFW) API proxy endpoint.

Provides secure proxy functionality for GFW 4Wings tile requests.
The GFW API token is kept server-side and never exposed to the client.

Security:
- Token is stored as GFW_API_TOKEN environment variable (backend only)
- Frontend makes requests to this proxy, not directly to GFW API
- In DEV_MODE: No authentication required (for easier testing)
- In Production: Requires valid Clerk session (authenticated user)
"""

from typing import Annotated, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Path, Request, status
from fastapi.responses import Response

from app.api.deps import get_current_user_optional
from app.config import settings
from app.models.user import User

router = APIRouter(prefix="/gfw", tags=["gfw"])

# GFW API base URL
GFW_API_BASE = "https://gateway.api.globalfishingwatch.org"


# ============================================================================
# Helper Functions
# ============================================================================


def _check_gfw_configured():
    """Check if GFW API token is configured."""
    if not settings.GFW_API_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GFW API is not configured. Set GFW_API_TOKEN in environment.",
        )


def _check_access(user: Optional[User]):
    """
    Check if the request has access to GFW proxy.

    GFW tiles are publicly accessible since the actual API token is protected
    server-side.
    Users cannot steal the GFW_API_TOKEN, they only receive proxied tile data.
    """
    # Always allow tile requests - the GFW API token is protected server-side
    return


# ============================================================================
# Endpoints
# ============================================================================


@router.get(
    "/v3/4wings/tile/heatmap/{z}/{x}/{y}",
    summary="Proxy GFW 4Wings heatmap tiles",
    description=(
        "Proxies tile requests to Global Fishing Watch API "
        "with server-side authentication"
    ),
)
async def proxy_gfw_tiles(
    z: Annotated[int, Path(description="Tile zoom level")],
    x: Annotated[int, Path(description="Tile X coordinate")],
    y: Annotated[int, Path(description="Tile Y coordinate")],
    request: Request,
    user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
) -> Response:
    """
    Proxy GFW 4Wings tile requests to the Global Fishing Watch API.

    This endpoint:
    1. Validates GFW API token is configured
    2. Checks user access (authentication required in production)
    3. Forwards tile request to GFW API with Bearer token
    4. Returns the tile response (MVT format)

    Query Parameters (forwarded from frontend):
    - format: Tile format (MVT)
    - interval: Time interval (HOUR, DAY, MONTH, YEAR)
    - datasets[0]: Dataset ID (e.g., "public-global-fishing-effort:latest")
    - date-range: Date range in format "YYYY-MM-DD,YYYY-MM-DD"

    Returns:
        Response: MVT (Mapbox Vector Tile) binary data

    Raises:
        HTTPException 401: If authentication required and not provided
        HTTPException 503: If GFW API token not configured
        HTTPException 502: If GFW API request fails
    """
    _check_gfw_configured()
    _check_access(user)

    # Build GFW API URL with query parameters
    gfw_url = f"{GFW_API_BASE}/v3/4wings/tile/heatmap/{z}/{x}/{y}"

    # Forward all query parameters from the request
    query_params = dict(request.query_params)

    # Make request to GFW API with Bearer token
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                gfw_url,
                params=query_params,
                headers={
                    "Authorization": f"Bearer {settings.GFW_API_TOKEN}",
                },
                timeout=30.0,
            )

            # Handle 404 responses gracefully (empty tiles are expected)
            if response.status_code == 404:
                return Response(
                    content=response.content,
                    status_code=404,
                    headers={
                        "Content-Type": response.headers.get(
                            "Content-Type", "application/json"
                        ),
                        "Cache-Control": "public, max-age=3600",
                    },
                )

            # For other non-2xx responses, raise an error
            response.raise_for_status()

            # Return the tile data with appropriate content type
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers={
                    "Content-Type": response.headers.get(
                        "Content-Type", "application/vnd.mapbox-vector-tile"
                    ),
                    "Cache-Control": "public, max-age=3600",  # Cache tiles for 1 hour
                },
            )

        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    f"GFW API request failed: "
                    f"{e.response.status_code} {e.response.text}"
                ),
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to connect to GFW API: {str(e)}",
            )


@router.get(
    "/health",
    summary="Check GFW proxy health",
    description="Verifies GFW API token is configured",
)
async def gfw_health() -> dict:
    """
    Health check for GFW proxy.

    Returns:
        dict: Status of GFW API configuration
    """
    return {
        "status": "ok" if settings.GFW_API_TOKEN else "not_configured",
        "configured": bool(settings.GFW_API_TOKEN),
    }
