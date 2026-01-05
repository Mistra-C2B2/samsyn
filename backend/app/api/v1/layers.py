"""
Layers API endpoints for CRUD operations.

Provides endpoints for:
- Layer CRUD (create, read, update, delete)
- Layer listing with filtering (source_type, category, is_global, search)

Endpoints are public for reading, but require authentication for create/update/delete.
Update and delete operations enforce permission checks based on layer.editable setting.
"""

from uuid import UUID
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import get_current_user, get_current_user_optional
from app.models.user import User
from app.schemas.layer import (
    LayerCreate,
    LayerUpdate,
    LayerResponse,
    LayerListResponse,
)
from app.services.layer_service import LayerService

router = APIRouter(prefix="/layers", tags=["layers"])


# ============================================================================
# Helper Functions
# ============================================================================


def serialize_layer_to_dict(layer):
    """
    Convert SQLAlchemy Layer object to dict for Pydantic serialization.

    This prevents serialization errors when SQLAlchemy relationship objects
    (like User in creator field) are included in the response.

    Args:
        layer: SQLAlchemy Layer instance

    Returns:
        Dict with properly serialized layer data
    """
    return {
        "id": layer.id,
        "name": layer.name,
        "source_type": layer.source_type,
        "description": layer.description,
        "category": layer.category,
        "created_by": layer.created_by,
        "editable": layer.editable,
        "is_global": layer.is_global,
        "visibility": layer.visibility or "private",
        "creation_source": layer.creation_source or "system",
        "source_config": layer.source_config or {},
        "style_config": layer.style_config or {},
        "legend_config": layer.legend_config or {},
        "layer_metadata": layer.layer_metadata or {},
        "created_at": layer.created_at,
        "updated_at": layer.updated_at,
        "features": [
            {
                "id": feat.id,
                "geometry_type": feat.geometry_type,
                "properties": feat.properties or {},
                "created_at": feat.created_at,
            }
            for feat in (layer.features if hasattr(layer, 'features') else [])
        ],
        "map_layers": [
            {
                "id": ml.id,
                "map_id": ml.map_id,
                "order": ml.order,
                "visible": ml.visible,
                "opacity": ml.opacity,
                "created_at": ml.created_at,
            }
            for ml in (layer.map_layers if hasattr(layer, 'map_layers') else [])
        ],
    }


def serialize_layer_list_to_dict(layer):
    """
    Convert SQLAlchemy Layer object to dict for LayerListResponse.

    Simplified version without full nested relationships.

    Args:
        layer: SQLAlchemy Layer instance

    Returns:
        Dict with properly serialized layer list data
    """
    return {
        "id": layer.id,
        "name": layer.name,
        "source_type": layer.source_type,
        "category": layer.category,
        "is_global": layer.is_global,
        "visibility": layer.visibility or "private",
        "creation_source": layer.creation_source or "system",
        "created_by": layer.created_by,
        "created_at": layer.created_at,
        "feature_count": len(layer.features) if hasattr(layer, 'features') else 0,
        "map_count": len(layer.map_layers) if hasattr(layer, 'map_layers') else 0,
    }


# ============================================================================
# Layer CRUD Endpoints
# ============================================================================


@router.get("", response_model=List[LayerListResponse])
async def list_layers(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)],
    source_type: Optional[str] = Query(None, description="Filter by source type (wms, geotiff, vector)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    is_global: Optional[bool] = Query(None, description="Filter by global status"),
    search: Optional[str] = Query(None, description="Search in name and description"),
    include_my_layers: Optional[bool] = Query(None, description="If true, return only user's own non-global layers (for 'My Layers' section)"),
):
    """
    List all layers with optional filtering.

    Public endpoint - authentication optional. Authenticated users see global layers
    plus their own layers. Unauthenticated users only see global layers.

    Query parameters:
    - source_type: Filter by source type (wms, geotiff, vector)
    - category: Filter by category
    - is_global: Filter by global status (true/false)
    - search: Search text in layer name and description
    - include_my_layers: If true, return only user's own non-global layers

    Returns:
        List of layers matching the filters (simplified response without full config)
    """
    service = LayerService(db)
    layers = service.list_layers(
        user_id=current_user.id if current_user else None,
        source_type=source_type,
        category=category,
        is_global=is_global,
        search=search,
        include_my_layers=include_my_layers,
    )

    return [LayerListResponse(**serialize_layer_list_to_dict(layer)) for layer in layers]


@router.get("/{layer_id}", response_model=LayerResponse)
async def get_layer(
    layer_id: UUID,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get detailed layer information by ID.

    Includes:
    - All layer properties
    - Source, style, legend, and metadata configurations

    Args:
        layer_id: Layer UUID

    Returns:
        Full layer details

    Raises:
        404: Layer not found
    """
    service = LayerService(db)
    layer = service.get_layer(layer_id)

    if not layer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layer not found",
        )

    return LayerResponse(**serialize_layer_to_dict(layer))


@router.post("", response_model=LayerResponse, status_code=status.HTTP_201_CREATED)
async def create_layer(
    layer_data: LayerCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create a new layer.

    The current user becomes the layer creator.
    Layer editable setting determines who can modify it later.

    Args:
        layer_data: Layer creation schema with name, source_type, configs, etc.

    Returns:
        Created layer details
    """
    service = LayerService(db)
    layer = service.create_layer(layer_data, current_user.id)

    return LayerResponse(**serialize_layer_to_dict(layer))


@router.put("/{layer_id}", response_model=LayerResponse)
async def update_layer(
    layer_id: UUID,
    layer_data: LayerUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update layer properties.

    Permission rules:
    - If layer.editable is "creator-only": Only creator can update
    - If layer.editable is "everyone": Any authenticated user can update

    Supports partial updates - only provided fields are updated.

    Args:
        layer_id: Layer UUID
        layer_data: Partial update schema

    Returns:
        Updated layer details

    Raises:
        404: Layer not found
        403: User doesn't have edit permission
    """
    service = LayerService(db)
    layer = service.update_layer(layer_id, layer_data, current_user.id)

    if not layer:
        # Check if layer exists to provide better error message
        existing = service.get_layer(layer_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Layer not found",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to edit this layer",
            )

    return LayerResponse(**serialize_layer_to_dict(layer))


@router.delete("/{layer_id}", status_code=status.HTTP_200_OK)
async def delete_layer(
    layer_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Delete a layer.

    Only the layer creator can delete layers.
    This cascades to remove all features and map-layer associations.

    Args:
        layer_id: Layer UUID

    Returns:
        Status message

    Raises:
        404: Layer not found
        403: User is not the layer creator
    """
    service = LayerService(db)
    deleted = service.delete_layer(layer_id, current_user.id)

    if not deleted:
        # Check if layer exists to provide better error message
        existing = service.get_layer(layer_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Layer not found",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only layer creator can delete this layer",
            )

    return {"status": "success", "message": "Layer deleted"}
