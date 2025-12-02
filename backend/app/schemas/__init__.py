"""
Pydantic schemas for request/response validation.

This module exports all schemas used for API request validation
and response serialization.
"""

from app.schemas.user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserResponse,
)

from app.schemas.map import (
    MapPermissionEnum,
    CollaboratorRoleEnum,
    MapBase,
    MapCreate,
    MapUpdate,
    MapResponse,
    MapListResponse,
    MapCollaboratorCreate,
    MapCollaboratorUpdate,
    MapCollaboratorResponse,
    MapLayerCreate,
    MapLayerUpdate,
    MapLayerResponse,
    MapLayerReorder,
)

from app.schemas.layer import (
    LayerSourceTypeEnum,
    LayerEditabilityEnum,
    LayerBase,
    LayerCreate,
    LayerUpdate,
    LayerResponse,
    LayerListResponse,
)

from app.schemas.feature import (
    GeometryTypeEnum,
    FeatureGeometry,
    FeatureProperties,
    FeatureBase,
    FeatureCreate,
    FeatureUpdate,
    FeatureResponse,
    FeatureGeoJSONResponse,
    GeoJSONFeature,
    FeatureCollection,
    BulkFeatureCreate,
    BulkFeatureResponse,
    FeatureQueryParams,
    BulkFeatureDelete,
    BulkFeatureDeleteResponse,
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
]
