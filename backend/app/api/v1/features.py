"""
Features API endpoints for LayerFeature CRUD operations.

Provides endpoints for:
- Feature listing with bbox filtering and pagination
- Feature CRUD (create, read, update, delete)
- Bulk import from GeoJSON FeatureCollections

Read endpoints (GET) are public and allow unauthenticated access.
Modification endpoints (POST/PUT/DELETE) require authentication and check
layer permissions (user must own layer or layer must be editable by everyone).
"""

from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_current_user_optional
from app.database import get_db
from app.models.user import User
from app.schemas.feature import (
    BulkFeatureCreate,
    BulkFeatureResponse,
    FeatureCreate,
    FeatureResponse,
    FeatureUpdate,
)
from app.services.feature_service import FeatureService
from app.services.layer_service import LayerService
from app.utils.geojson import postgis_to_geojson

router = APIRouter(prefix="/layers", tags=["features"])


# ============================================================================
# Helper Functions
# ============================================================================


def check_layer_edit_permission(
    layer_id: UUID,
    user_id: UUID,
    layer_service: LayerService,
) -> None:
    """
    Check if user has edit permission for the layer.

    Raises:
        HTTPException 404: Layer not found
        HTTPException 403: User doesn't have edit permission
    """
    layer = layer_service.get_layer(layer_id)

    if not layer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layer not found",
        )

    # Check if user can edit this layer
    if not layer_service.can_edit_layer(layer_id, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to edit this layer",
        )


def convert_feature_to_response(feature, db: Session) -> FeatureResponse:
    """
    Convert LayerFeature model to FeatureResponse schema.

    Handles PostGIS geometry to GeoJSON conversion.
    """
    # Convert PostGIS geometry to GeoJSON
    geometry_geojson = postgis_to_geojson(feature.geometry)

    return FeatureResponse(
        id=feature.id,
        layer_id=feature.layer_id,
        geometry=geometry_geojson,
        properties=feature.properties or {},
        feature_type=feature.feature_type,
        created_at=feature.created_at,
        updated_at=feature.updated_at,
    )


# ============================================================================
# Feature CRUD Endpoints
# ============================================================================


@router.get("/{layer_id}/features", response_model=List[FeatureResponse])
async def list_features(
    layer_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)],
    bbox: Optional[str] = Query(
        None,
        description="Bounding box filter: minLon,minLat,maxLon,maxLat",
        examples=["-180,-90,180,90"],
    ),
    limit: int = Query(
        100,
        ge=1,
        le=1000,
        description="Maximum number of features to return (max 1000)",
    ),
    offset: int = Query(
        0, ge=0, description="Number of features to skip for pagination"
    ),
):
    """
    List features for a layer with optional bounding box filtering and pagination.

    Public endpoint - authentication optional.

    Query parameters:
    - bbox: Optional bounding box as "minLon,minLat,maxLon,maxLat" (comma-separated)
    - limit: Maximum features to return (1-1000, default 100)
    - offset: Number of features to skip (default 0)

    Returns:
        List of features matching the query

    Raises:
        404: Layer not found
    """
    layer_service = LayerService(db)
    feature_service = FeatureService(db)

    # Check layer exists
    layer = layer_service.get_layer(layer_id)
    if not layer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layer not found",
        )

    # Parse bbox if provided
    bbox_coords = None
    if bbox:
        try:
            coords = [float(x.strip()) for x in bbox.split(",")]
            if len(coords) != 4:
                raise ValueError("Bounding box must have 4 coordinates")
            bbox_coords = coords
        except (ValueError, IndexError) as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid bbox format: {str(e)}. "
                    "Expected: minLon,minLat,maxLon,maxLat"
                ),
            )

    # Get features
    features = feature_service.list_features(
        layer_id=layer_id,
        bbox=bbox_coords,
        limit=limit,
        offset=offset,
    )

    # Convert to response format
    return [convert_feature_to_response(f, db) for f in features]


@router.get("/{layer_id}/features/{feature_id}", response_model=FeatureResponse)
async def get_feature(
    layer_id: UUID,
    feature_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)],
):
    """
    Get a single feature by ID.

    Public endpoint - authentication optional.

    Args:
        layer_id: Layer UUID
        feature_id: Feature UUID

    Returns:
        Feature details with GeoJSON geometry

    Raises:
        404: Layer or feature not found
    """
    layer_service = LayerService(db)
    feature_service = FeatureService(db)

    # Check layer exists
    layer = layer_service.get_layer(layer_id)
    if not layer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Layer not found",
        )

    # Get feature
    feature = feature_service.get_feature(feature_id)

    if not feature or feature.layer_id != layer_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature not found",
        )

    return convert_feature_to_response(feature, db)


@router.post(
    "/{layer_id}/features",
    response_model=FeatureResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_feature(
    layer_id: UUID,
    feature_data: FeatureCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create a new feature in a layer.

    The current user must have edit permission for the layer.
    Permission rules:
    - If layer.editable is "creator-only": Only creator can add features
    - If layer.editable is "everyone": Any authenticated user can add features

    Args:
        layer_id: Layer UUID
        feature_data: Feature creation schema with geometry and properties

    Returns:
        Created feature details

    Raises:
        404: Layer not found
        403: User doesn't have edit permission
        400: Invalid geometry
    """
    layer_service = LayerService(db)
    feature_service = FeatureService(db)

    # Check edit permission
    check_layer_edit_permission(layer_id, current_user.id, layer_service)

    # Create feature
    try:
        feature = feature_service.create_feature(layer_id, feature_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return convert_feature_to_response(feature, db)


@router.post(
    "/{layer_id}/features/bulk",
    response_model=BulkFeatureResponse,
    status_code=status.HTTP_201_CREATED,
)
async def bulk_import_features(
    layer_id: UUID,
    bulk_data: BulkFeatureCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Bulk import features from a GeoJSON FeatureCollection.

    The current user must have edit permission for the layer.
    This endpoint accepts a standard GeoJSON FeatureCollection and creates
    all features in a single transaction.

    Args:
        layer_id: Layer UUID
        bulk_data: GeoJSON FeatureCollection with features to import

    Returns:
        Summary of import operation with counts and any errors

    Raises:
        404: Layer not found
        403: User doesn't have edit permission
        400: Invalid FeatureCollection format

    Example request body:
        {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [102.0, 0.5]},
                    "properties": {"name": "Feature 1"}
                },
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [103.0, 1.5]},
                    "properties": {"name": "Feature 2"}
                }
            ]
        }
    """
    layer_service = LayerService(db)
    feature_service = FeatureService(db)

    # Check edit permission
    check_layer_edit_permission(layer_id, current_user.id, layer_service)

    # Validate FeatureCollection
    if not bulk_data.features:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FeatureCollection must contain at least one feature",
        )

    # Bulk create features
    try:
        feature_ids, errors = feature_service.bulk_create_features(layer_id, bulk_data)

        created_count = len(feature_ids)
        failed_count = len(errors)

        return BulkFeatureResponse(
            success=created_count > 0,
            created_count=created_count,
            failed_count=failed_count,
            feature_ids=feature_ids,
            errors=[{"message": error} for error in errors],
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/{layer_id}/features/{feature_id}", response_model=FeatureResponse)
async def update_feature(
    layer_id: UUID,
    feature_id: UUID,
    feature_data: FeatureUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update a feature's geometry and/or properties.

    The current user must have edit permission for the layer.
    Supports partial updates - only provided fields are updated.

    Permission rules:
    - If layer.editable is "creator-only": Only creator can update
    - If layer.editable is "everyone": Any authenticated user can update

    Args:
        layer_id: Layer UUID
        feature_id: Feature UUID
        feature_data: Partial update schema

    Returns:
        Updated feature details

    Raises:
        404: Layer or feature not found
        403: User doesn't have edit permission
        400: Invalid geometry
    """
    layer_service = LayerService(db)
    feature_service = FeatureService(db)

    # Check edit permission
    check_layer_edit_permission(layer_id, current_user.id, layer_service)

    # Verify feature exists and belongs to layer
    existing_feature = feature_service.get_feature(feature_id)
    if not existing_feature or existing_feature.layer_id != layer_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature not found",
        )

    # Update feature
    try:
        feature = feature_service.update_feature(feature_id, feature_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    if not feature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature not found",
        )

    return convert_feature_to_response(feature, db)


@router.delete("/{layer_id}/features/{feature_id}", status_code=status.HTTP_200_OK)
async def delete_feature(
    layer_id: UUID,
    feature_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Delete a feature.

    The current user must have edit permission for the layer.

    Permission rules:
    - If layer.editable is "creator-only": Only creator can delete
    - If layer.editable is "everyone": Any authenticated user can delete

    Args:
        layer_id: Layer UUID
        feature_id: Feature UUID

    Returns:
        Status message

    Raises:
        404: Layer or feature not found
        403: User doesn't have edit permission
    """
    layer_service = LayerService(db)
    feature_service = FeatureService(db)

    # Check edit permission
    check_layer_edit_permission(layer_id, current_user.id, layer_service)

    # Verify feature exists and belongs to layer
    existing_feature = feature_service.get_feature(feature_id)
    if not existing_feature or existing_feature.layer_id != layer_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature not found",
        )

    # Delete feature
    deleted = feature_service.delete_feature(feature_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feature not found",
        )

    return {"status": "success", "message": "Feature deleted"}
