"""
Pydantic schemas for request/response validation.

This module exports all schemas used for API request validation
and response serialization.
"""

from app.schemas.comment import (
    CommentCreate,
    CommentResponse,
    CommentUpdate,
    CommentWithReplies,
)
from app.schemas.feature import (
    BulkFeatureCreate,
    BulkFeatureDelete,
    BulkFeatureDeleteResponse,
    BulkFeatureResponse,
    FeatureBase,
    FeatureCollection,
    FeatureCreate,
    FeatureGeoJSONResponse,
    FeatureGeometry,
    FeatureProperties,
    FeatureQueryParams,
    FeatureResponse,
    FeatureUpdate,
    GeoJSONFeature,
    GeometryTypeEnum,
)
from app.schemas.layer import (
    LayerBase,
    LayerCreate,
    LayerEditabilityEnum,
    LayerListResponse,
    LayerResponse,
    LayerSourceTypeEnum,
    LayerUpdate,
)
from app.schemas.map import (
    CollaboratorRoleEnum,
    MapBase,
    MapCollaboratorCreate,
    MapCollaboratorResponse,
    MapCollaboratorUpdate,
    MapCreate,
    MapLayerCreate,
    MapLayerReorder,
    MapLayerResponse,
    MapLayerUpdate,
    MapListResponse,
    MapPermissionEnum,
    MapResponse,
    MapUpdate,
)
from app.schemas.user import (
    UserBase,
    UserCreate,
    UserResponse,
    UserUpdate,
)

__all__ = [
    # User schemas
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    # Map schemas
    "MapPermissionEnum",
    "CollaboratorRoleEnum",
    "MapBase",
    "MapCreate",
    "MapUpdate",
    "MapResponse",
    "MapListResponse",
    "MapCollaboratorCreate",
    "MapCollaboratorUpdate",
    "MapCollaboratorResponse",
    "MapLayerCreate",
    "MapLayerUpdate",
    "MapLayerResponse",
    "MapLayerReorder",
    # Layer schemas
    "LayerSourceTypeEnum",
    "LayerEditabilityEnum",
    "LayerBase",
    "LayerCreate",
    "LayerUpdate",
    "LayerResponse",
    "LayerListResponse",
    # Feature schemas
    "GeometryTypeEnum",
    "FeatureGeometry",
    "FeatureProperties",
    "FeatureBase",
    "FeatureCreate",
    "FeatureUpdate",
    "FeatureResponse",
    "FeatureGeoJSONResponse",
    "GeoJSONFeature",
    "FeatureCollection",
    "BulkFeatureCreate",
    "BulkFeatureResponse",
    "FeatureQueryParams",
    "BulkFeatureDelete",
    "BulkFeatureDeleteResponse",
    # Comment schemas
    "CommentCreate",
    "CommentUpdate",
    "CommentResponse",
    "CommentWithReplies",
]
