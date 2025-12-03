"""
Maps API endpoints for CRUD operations and layer/collaborator management.

Provides endpoints for:
- Map CRUD (create, read, update, delete)
- Collaborator management (list, add, update, remove)
- Layer management within maps (add, remove, update, reorder)

Read endpoints (GET) are public and allow unauthenticated access.
Modification endpoints (POST/PUT/DELETE) require authentication via Clerk JWT tokens.
Authorization is enforced based on map permissions (private/collaborators/public).
"""

from uuid import UUID
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import get_current_user, get_current_user_optional
from app.models.user import User
from app.schemas.map import (
    MapCreate,
    MapUpdate,
    MapResponse,
    MapListResponse,
    MapCollaboratorCreate,
    MapCollaboratorUpdate,
    MapCollaboratorResponse,
    MapLayerCreate,
    MapLayerUpdate,
    MapLayerReorder,
    MapLayerResponse,
)
from app.services.map_service import MapService

router = APIRouter(prefix="/maps", tags=["maps"])


# ============================================================================
# Map CRUD Endpoints
# ============================================================================


@router.get("", response_model=List[MapListResponse])
async def list_user_maps(
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    List all maps accessible to the current user.

    Public endpoint - authentication optional.

    For authenticated users, returns maps where user is:
    - The creator/owner
    - A collaborator (viewer or editor)

    For unauthenticated users, returns only public maps.

    Returns:
        List of maps with summary information (without full nested data)
    """
    service = MapService(db)
    maps = service.list_user_maps(current_user.id if current_user else None)

    # Convert to list response with counts
    result = []
    for map_obj in maps:
        map_dict = MapListResponse.model_validate(map_obj).model_dump()
        map_dict["collaborator_count"] = len(map_obj.collaborators)
        map_dict["layer_count"] = len(map_obj.map_layers)
        result.append(MapListResponse(**map_dict))

    return result


@router.get("/{map_id}", response_model=MapResponse)
async def get_map(
    map_id: UUID,
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Get detailed map information by ID.

    Public endpoint - authentication optional.

    Includes:
    - All map properties
    - Collaborators list
    - Layers list with display properties

    Args:
        map_id: Map UUID

    Returns:
        Full map details

    Raises:
        404: Map not found or user doesn't have view access
    """
    service = MapService(db)
    map_obj = service.get_map(map_id, current_user.id if current_user else None)

    if not map_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Map not found or access denied",
        )

    return MapResponse.model_validate(map_obj)


@router.post("", response_model=MapResponse, status_code=status.HTTP_201_CREATED)
async def create_map(
    map_data: MapCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create a new map.

    The current user becomes the map owner.
    Map is created with specified permission level (default: private).

    Args:
        map_data: Map creation schema with name, description, center, zoom, etc.

    Returns:
        Created map details
    """
    service = MapService(db)
    map_obj = service.create_map(map_data, current_user.id)

    return MapResponse.model_validate(map_obj)


@router.put("/{map_id}", response_model=MapResponse)
async def update_map(
    map_id: UUID,
    map_data: MapUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update map properties.

    Only map owner and editor collaborators can update maps.
    Supports partial updates - only provided fields are updated.

    Args:
        map_id: Map UUID
        map_data: Partial update schema

    Returns:
        Updated map details

    Raises:
        404: Map not found
        403: User doesn't have edit permission
    """
    service = MapService(db)
    map_obj = service.update_map(map_id, map_data, current_user.id)

    if not map_obj:
        # Check if map exists to provide better error message
        existing = service.get_map(map_id, current_user.id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Map not found",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to edit this map",
            )

    return MapResponse.model_validate(map_obj)


@router.delete("/{map_id}", status_code=status.HTTP_200_OK)
async def delete_map(
    map_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Delete a map.

    Only the map owner can delete maps.
    This cascades to remove all collaborators and layer associations.

    Args:
        map_id: Map UUID

    Returns:
        Status message

    Raises:
        404: Map not found
        403: User is not the map owner
    """
    service = MapService(db)
    deleted = service.delete_map(map_id, current_user.id)

    if not deleted:
        # Check if map exists to provide better error message
        map_obj = db.query(service.db.query(map_id)).first() if hasattr(service.db.query, '__call__') else None
        # Simplified check - if delete failed, either not found or unauthorized
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Map not found or not authorized to delete",
        )

    return {"status": "success", "message": "Map deleted"}


# ============================================================================
# Collaborator Management Endpoints
# ============================================================================


@router.get("/{map_id}/collaborators", response_model=List[MapCollaboratorResponse])
async def list_collaborators(
    map_id: UUID,
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    List all collaborators for a map.

    Public endpoint - authentication optional.

    Requires view access to the map.

    Args:
        map_id: Map UUID

    Returns:
        List of collaborators with their roles

    Raises:
        404: Map not found or user doesn't have view access
    """
    service = MapService(db)
    collaborators = service.list_collaborators(map_id, current_user.id if current_user else None)

    if collaborators is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Map not found or access denied",
        )

    return [MapCollaboratorResponse.model_validate(c) for c in collaborators]


@router.post(
    "/{map_id}/collaborators",
    response_model=MapCollaboratorResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_collaborator(
    map_id: UUID,
    collaborator_data: MapCollaboratorCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Add a collaborator to a map.

    Permission rules:
    - Owner and editors can add viewers
    - Only owner can add editors
    - Cannot add the map owner as a collaborator

    Args:
        map_id: Map UUID
        collaborator_data: User ID and role to add

    Returns:
        Created collaborator details

    Raises:
        404: Map not found
        403: Not authorized to add collaborators
        400: User is already a collaborator or invalid user_id
    """
    service = MapService(db)
    collaborator = service.add_collaborator(
        map_id=map_id,
        user_id_to_add=collaborator_data.user_id,
        role=collaborator_data.role.value,
        requester_id=current_user.id,
    )

    if not collaborator:
        # Check different failure reasons
        map_obj = service.get_map(map_id, current_user.id)
        if not map_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Map not found",
            )

        # Could be unauthorized, already exists, or trying to add owner
        user_role = service.get_user_role_in_map(map_id, current_user.id)
        if user_role not in ["owner", "editor"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to add collaborators",
            )

        if (
            collaborator_data.role.value == "editor"
            and user_role != "owner"
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only owner can add editors",
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a collaborator or cannot be added",
        )

    return MapCollaboratorResponse.model_validate(collaborator)


@router.put(
    "/{map_id}/collaborators/{user_id}",
    response_model=MapCollaboratorResponse,
)
async def update_collaborator(
    map_id: UUID,
    user_id: UUID,
    collaborator_data: MapCollaboratorUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update a collaborator's role.

    Only the map owner can update collaborator roles.

    Args:
        map_id: Map UUID
        user_id: User UUID of collaborator to update
        collaborator_data: New role

    Returns:
        Updated collaborator details

    Raises:
        404: Map or collaborator not found
        403: User is not the map owner
    """
    service = MapService(db)
    collaborator = service.update_collaborator(
        map_id=map_id,
        user_id_to_update=user_id,
        role=collaborator_data.role.value,
        requester_id=current_user.id,
    )

    if not collaborator:
        # Check if map exists
        map_obj = service.get_map(map_id, current_user.id)
        if not map_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Map not found",
            )

        # Check if user is owner
        if map_obj.created_by != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only map owner can update collaborator roles",
            )

        # Collaborator not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found",
        )

    return MapCollaboratorResponse.model_validate(collaborator)


@router.delete("/{map_id}/collaborators/{user_id}", status_code=status.HTTP_200_OK)
async def remove_collaborator(
    map_id: UUID,
    user_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Remove a collaborator from a map.

    Only the map owner can remove collaborators.

    Args:
        map_id: Map UUID
        user_id: User UUID of collaborator to remove

    Returns:
        Status message

    Raises:
        404: Map or collaborator not found
        403: User is not the map owner
    """
    service = MapService(db)
    removed = service.remove_collaborator(
        map_id=map_id,
        user_id_to_remove=user_id,
        requester_id=current_user.id,
    )

    if not removed:
        # Check if map exists
        map_obj = service.get_map(map_id, current_user.id)
        if not map_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Map not found",
            )

        # Check if user is owner
        if map_obj.created_by != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only map owner can remove collaborators",
            )

        # Collaborator not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found",
        )

    return {"status": "success", "message": "Collaborator removed"}


# ============================================================================
# Layer Management Endpoints
# ============================================================================


@router.post(
    "/{map_id}/layers",
    response_model=MapLayerResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_layer_to_map(
    map_id: UUID,
    layer_data: MapLayerCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Add a layer to a map.

    Requires edit access to the map.
    Layer must exist in the database before adding to map.

    Args:
        map_id: Map UUID
        layer_data: Layer ID and display properties (order, visibility, opacity)

    Returns:
        Created map-layer association details

    Raises:
        404: Map or layer not found
        403: Not authorized to edit map
        400: Layer already in map
    """
    service = MapService(db)
    map_layer = service.add_layer_to_map(
        map_id=map_id,
        layer_id=layer_data.layer_id,
        user_id=current_user.id,
        display_order=layer_data.order,
        is_visible=layer_data.visible,
        opacity=layer_data.opacity,
    )

    if not map_layer:
        # Check different failure reasons
        map_obj = service.get_map(map_id, current_user.id)
        if not map_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Map not found",
            )

        if not service.can_edit_map(map_id, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to edit this map",
            )

        # Either layer doesn't exist or already in map
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Layer not found or already in map",
        )

    return MapLayerResponse.model_validate(map_layer)


@router.delete("/{map_id}/layers/{layer_id}", status_code=status.HTTP_200_OK)
async def remove_layer_from_map(
    map_id: UUID,
    layer_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Remove a layer from a map.

    Requires edit access to the map.
    This only removes the association, not the layer itself.

    Args:
        map_id: Map UUID
        layer_id: Layer UUID to remove

    Returns:
        Status message

    Raises:
        404: Map or layer association not found
        403: Not authorized to edit map
    """
    service = MapService(db)
    removed = service.remove_layer_from_map(map_id, layer_id, current_user.id)

    if not removed:
        # Check if map exists
        map_obj = service.get_map(map_id, current_user.id)
        if not map_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Map not found",
            )

        # Check if user can edit
        if not service.can_edit_map(map_id, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to edit this map",
            )

        # Layer not in map
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layer not found in map",
        )

    return {"status": "success", "message": "Layer removed from map"}


@router.put("/{map_id}/layers/{layer_id}", response_model=MapLayerResponse)
async def update_map_layer(
    map_id: UUID,
    layer_id: UUID,
    layer_data: MapLayerUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update layer display properties in a map.

    Allows updating visibility, opacity, and order.
    Requires edit access to the map.

    Args:
        map_id: Map UUID
        layer_id: Layer UUID
        layer_data: Updated display properties (partial)

    Returns:
        Updated map-layer association details

    Raises:
        404: Map or layer association not found
        403: Not authorized to edit map
    """
    service = MapService(db)

    # Convert Pydantic model to dict, excluding unset fields
    updates = layer_data.model_dump(exclude_unset=True)

    map_layer = service.update_map_layer(
        map_id=map_id,
        layer_id=layer_id,
        updates=updates,
        user_id=current_user.id,
    )

    if not map_layer:
        # Check if map exists
        map_obj = service.get_map(map_id, current_user.id)
        if not map_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Map not found",
            )

        # Check if user can edit
        if not service.can_edit_map(map_id, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to edit this map",
            )

        # Layer not in map
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layer not found in map",
        )

    return MapLayerResponse.model_validate(map_layer)


@router.put("/{map_id}/layers/reorder", response_model=List[MapLayerResponse])
async def reorder_map_layers(
    map_id: UUID,
    reorder_data: MapLayerReorder,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Reorder all layers in a map.

    Requires edit access to the map.
    Provide a list of all layer IDs with their new order positions.

    Args:
        map_id: Map UUID
        reorder_data: List of {layer_id, order} objects

    Returns:
        Updated list of all map-layer associations

    Raises:
        404: Map not found
        403: Not authorized to edit map
        400: Invalid layer order data
    """
    service = MapService(db)

    # Check if map exists and user can edit
    map_obj = service.get_map(map_id, current_user.id)
    if not map_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Map not found",
        )

    if not service.can_edit_map(map_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to edit this map",
        )

    # Reorder layers
    success = service.reorder_layers(
        map_id=map_id,
        layer_orders=reorder_data.layer_orders,
        user_id=current_user.id,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to reorder layers",
        )

    # Fetch updated map layers to return
    from app.models.layer import MapLayer

    updated_layers = (
        db.query(MapLayer)
        .filter(MapLayer.map_id == map_id)
        .order_by(MapLayer.order)
        .all()
    )

    return [MapLayerResponse.model_validate(ml) for ml in updated_layers]
