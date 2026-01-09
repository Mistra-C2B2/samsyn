"""
WMS Servers API endpoints for CRUD operations.

Provides endpoints for:
- WMS server CRUD (create, read, update, delete)
- Capabilities refresh
- Available layers listing from cached capabilities

All WMS servers are shared/public. Authentication is required for write operations.
Only the creator can update or delete a server.
"""

from uuid import UUID
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import get_current_user, get_current_user_optional, get_current_admin
from app.models.user import User
from app.schemas.wms_server import (
    WmsServerCreate,
    WmsServerUpdate,
    WmsServerResponse,
    WmsServerListResponse,
    WmsServerLayersResponse,
    WmsLayerInfo,
)
from app.services.wms_server_service import WmsServerService

router = APIRouter(prefix="/wms-servers", tags=["wms_servers"])


# ============================================================================
# Helper Functions
# ============================================================================


def serialize_server_to_dict(server):
    """
    Convert SQLAlchemy WmsServer object to dict for Pydantic serialization.

    Args:
        server: SQLAlchemy WmsServer instance

    Returns:
        Dict with properly serialized server data
    """
    return {
        "id": server.id,
        "name": server.name,
        "base_url": server.base_url,
        "description": server.description,
        "version": server.version,
        "service_title": server.service_title,
        "service_provider": server.service_provider,
        "layer_count": server.layer_count or 0,
        "capabilities_cache": server.capabilities_cache or {},
        "cached_at": server.cached_at,
        "created_by": server.created_by,
        "created_at": server.created_at,
        "updated_at": server.updated_at,
    }


def serialize_server_list_to_dict(server):
    """
    Convert SQLAlchemy WmsServer object to dict for list response.

    Excludes the full capabilities cache for performance.

    Args:
        server: SQLAlchemy WmsServer instance

    Returns:
        Dict with properly serialized server list data
    """
    return {
        "id": server.id,
        "name": server.name,
        "base_url": server.base_url,
        "description": server.description,
        "version": server.version,
        "service_title": server.service_title,
        "service_provider": server.service_provider,
        "layer_count": server.layer_count or 0,
        "cached_at": server.cached_at,
        "created_by": server.created_by,
        "created_at": server.created_at,
    }


# ============================================================================
# WMS Server CRUD Endpoints
# ============================================================================


@router.get("", response_model=List[WmsServerListResponse])
async def list_wms_servers(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)],
):
    """
    List all WMS servers.

    All servers are shared/public. Authentication is optional.

    Returns:
        List of WMS servers (without full capabilities cache)
    """
    service = WmsServerService(db)
    servers = service.list_servers()

    return [WmsServerListResponse(**serialize_server_list_to_dict(server)) for server in servers]


@router.get("/{server_id}", response_model=WmsServerResponse)
async def get_wms_server(
    server_id: UUID,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get WMS server details by ID.

    Includes the full capabilities cache.

    Args:
        server_id: Server UUID

    Returns:
        Full server details including cached capabilities

    Raises:
        404: Server not found
    """
    service = WmsServerService(db)
    server = service.get_server(server_id)

    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WMS server not found",
        )

    return WmsServerResponse(**serialize_server_to_dict(server))


@router.post("", response_model=WmsServerResponse, status_code=status.HTTP_201_CREATED)
async def create_wms_server(
    server_data: WmsServerCreate,
    current_user: Annotated[User, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create a new WMS server. Admin only.

    Automatically fetches and caches GetCapabilities from the WMS URL.
    The current user becomes the server creator.

    Args:
        server_data: Server creation schema with name and base_url

    Returns:
        Created server details including fetched capabilities

    Raises:
        400: Invalid WMS URL or capabilities fetch failed
        403: User is not an admin
        409: Server with this URL already exists
    """
    service = WmsServerService(db)

    # Check if server with this URL already exists
    existing = service.get_server_by_url(server_data.base_url)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A WMS server with this URL already exists",
        )

    try:
        server = await service.create_server(server_data, current_user.id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return WmsServerResponse(**serialize_server_to_dict(server))


@router.put("/{server_id}", response_model=WmsServerResponse)
async def update_wms_server(
    server_id: UUID,
    server_data: WmsServerUpdate,
    current_user: Annotated[User, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update WMS server metadata. Admin only.

    Does not change the base_url or refresh capabilities.

    Args:
        server_id: Server UUID
        server_data: Partial update schema (name, description)

    Returns:
        Updated server details

    Raises:
        403: User is not an admin
        404: Server not found
    """
    service = WmsServerService(db)
    server = service.update_server(server_id, server_data, current_user.id)

    if not server:
        existing = service.get_server(server_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="WMS server not found",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the server creator can update this server",
            )

    return WmsServerResponse(**serialize_server_to_dict(server))


@router.delete("/{server_id}", status_code=status.HTTP_200_OK)
async def delete_wms_server(
    server_id: UUID,
    current_user: Annotated[User, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Delete a WMS server. Admin only.

    Args:
        server_id: Server UUID

    Returns:
        Status message

    Raises:
        403: User is not an admin
        404: Server not found
    """
    service = WmsServerService(db)
    deleted = service.delete_server(server_id, current_user.id)

    if not deleted:
        existing = service.get_server(server_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="WMS server not found",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the server creator can delete this server",
            )

    return {"status": "success", "message": "WMS server deleted"}


# ============================================================================
# Capabilities Management Endpoints
# ============================================================================


@router.post("/{server_id}/refresh", response_model=WmsServerResponse)
async def refresh_wms_capabilities(
    server_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Refresh the capabilities cache for a WMS server.

    Re-fetches GetCapabilities and updates the cached data.
    Any authenticated user can refresh capabilities.

    Args:
        server_id: Server UUID

    Returns:
        Updated server details with fresh capabilities

    Raises:
        404: Server not found
        400: Capabilities fetch failed
    """
    service = WmsServerService(db)

    # Check if server exists first
    existing = service.get_server(server_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WMS server not found",
        )

    try:
        server = await service.refresh_capabilities(server_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return WmsServerResponse(**serialize_server_to_dict(server))


@router.get("/{server_id}/layers", response_model=WmsServerLayersResponse)
async def get_wms_server_layers(
    server_id: UUID,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get available layers from a WMS server's cached capabilities.

    Returns the list of layers that can be added to maps.

    Args:
        server_id: Server UUID

    Returns:
        Server info and list of available layers

    Raises:
        404: Server not found
    """
    service = WmsServerService(db)
    result = service.get_layers(server_id)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="WMS server not found",
        )

    # Transform layers to WmsLayerInfo format
    layers = [
        WmsLayerInfo(
            name=layer.get("name", ""),
            title=layer.get("title"),
            abstract=layer.get("abstract"),
            queryable=layer.get("queryable", False),
            bounds=layer.get("bounds"),
            crs=layer.get("crs", []),
            styles=layer.get("styles", []),
            dimensions=layer.get("dimensions", []),
        )
        for layer in result.get("layers", [])
    ]

    return WmsServerLayersResponse(
        server_id=UUID(result["server_id"]),
        server_name=result["server_name"],
        base_url=result["base_url"],
        version=result.get("version"),
        layers=layers,
        cached_at=result.get("cached_at"),
    )
