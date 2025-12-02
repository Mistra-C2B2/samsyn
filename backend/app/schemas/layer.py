"""
Layer Pydantic schemas for request/response validation.

These schemas handle data validation for:
- Layer creation and updates
- Layer API responses with nested relationships
- Source-specific configurations (WMS, GeoTIFF, Vector)
- Layer library management
"""

from uuid import UUID
from datetime import datetime
from typing import Optional, List, Any, Literal, Dict
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


# Enums
class LayerSourceTypeEnum(str, Enum):
    """Layer source types"""
    wms = "wms"
    geotiff = "geotiff"
    vector = "vector"


class LayerEditabilityEnum(str, Enum):
    """Layer editability levels"""
    creator_only = "creator-only"
    everyone = "everyone"


# Source-specific configuration models
class WMSSourceConfig(BaseModel):
    """
    Configuration for WMS (Web Map Service) layer sources.

    Supports standard WMS parameters including temporal dimensions.
    """

    url: str = Field(..., description="WMS service endpoint URL")
    layers: str = Field(..., description="Comma-separated list of WMS layer names")
    version: str = Field(default="1.3.0", description="WMS version")
    format: str = Field(default="image/png", description="Image format (image/png, image/jpeg, etc.)")
    transparent: bool = Field(default=True, description="Request transparent background")
    temporal: Optional[bool] = Field(default=None, description="Whether layer supports temporal queries")
    dimensions: Optional[Dict[str, str]] = Field(default=None, description="Additional WMS dimensions (e.g., TIME, ELEVATION)")

    model_config = ConfigDict(from_attributes=True)


class GeoTIFFSourceConfig(BaseModel):
    """
    Configuration for GeoTIFF/COG (Cloud-Optimized GeoTIFF) layer sources.

    Supports both direct delivery and tiled delivery methods.
    """

    delivery: Literal["direct", "tiles"] = Field(..., description="Delivery method: direct file or tile server")
    url: Optional[str] = Field(default=None, description="Direct GeoTIFF URL (for direct delivery)")
    cog_url: Optional[str] = Field(default=None, alias="cogUrl", description="Cloud-Optimized GeoTIFF URL")
    cog_url_template: Optional[str] = Field(default=None, alias="cogUrlTemplate", description="Template URL with placeholders for dynamic COG loading")
    tile_server: Optional[str] = Field(default=None, alias="tileServer", description="Tile server URL (for tiles delivery)")
    bounds: Optional[List[float]] = Field(default=None, description="Geographic bounds [west, south, east, north]")
    temporal: Optional[bool] = Field(default=None, description="Whether layer has temporal data")
    tile_params: Optional[Dict[str, Any]] = Field(default=None, alias="tileParams", description="Additional tile server parameters")
    processing: Optional[Dict[str, Any]] = Field(default=None, description="Processing parameters (e.g., color ramps, scaling)")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class VectorSourceConfig(BaseModel):
    """
    Configuration for vector layer sources.

    For layers with point, line, or polygon geometries stored as features.
    """

    geometry_type: Literal["Point", "LineString", "Polygon", "MultiPoint", "MultiLineString", "MultiPolygon"] = Field(
        ...,
        alias="geometryType",
        description="GeoJSON geometry type"
    )
    feature_count: int = Field(default=0, alias="featureCount", description="Number of features in layer")
    bounds: Optional[List[float]] = Field(default=None, description="Geographic bounds [west, south, east, north]")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# Base schemas
class LayerBase(BaseModel):
    """Base layer fields shared across schemas"""

    name: str = Field(..., min_length=1, max_length=255, description="Layer name")
    source_type: LayerSourceTypeEnum = Field(..., description="Type of layer source")
    description: Optional[str] = Field(default=None, description="Layer description")
    category: Optional[str] = Field(default=None, max_length=100, description="Layer category for organization")
    editable: LayerEditabilityEnum = Field(default=LayerEditabilityEnum.creator_only, description="Who can edit this layer")


class LayerCreate(LayerBase):
    """
    Schema for creating a new layer.

    Includes source configuration, styling, legend, and metadata.
    """

    is_global: bool = Field(default=False, description="Whether layer is available globally in layer library")
    source_config: Dict[str, Any] = Field(..., description="Source-specific configuration (WMS, GeoTIFF, or Vector)")
    style_config: Dict[str, Any] = Field(default_factory=dict, description="Mapbox style specification")
    legend_config: Dict[str, Any] = Field(default_factory=dict, description="Legend configuration (gradient or categories)")
    metadata: Dict[str, Any] = Field(default_factory=dict, alias="layer_metadata", description="Additional layer metadata (DOI, author, etc.)")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class LayerUpdate(BaseModel):
    """
    Schema for updating a layer.

    All fields are optional to support partial updates.
    """

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    source_type: Optional[LayerSourceTypeEnum] = None
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    editable: Optional[LayerEditabilityEnum] = None
    is_global: Optional[bool] = None
    source_config: Optional[Dict[str, Any]] = None
    style_config: Optional[Dict[str, Any]] = None
    legend_config: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = Field(None, alias="layer_metadata")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# Nested schemas for responses
class LayerFeatureResponse(BaseModel):
    """Schema for feature in layer context"""

    id: UUID
    geometry_type: str
    properties: Dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LayerMapResponse(BaseModel):
    """Schema for map in layer context (reverse relationship)"""

    id: UUID
    map_id: UUID
    order: int
    visible: bool
    opacity: int = Field(..., ge=0, le=100)
    created_at: datetime

    # Optional nested map info
    map: Optional[Any] = None  # Can be MapResponse if needed

    model_config = ConfigDict(from_attributes=True)


class LayerResponse(BaseModel):
    """
    Schema for full layer API responses.

    Includes all layer fields, creator info, features, and map associations.
    """

    id: UUID
    name: str
    source_type: str
    description: Optional[str]
    category: Optional[str]
    created_by: UUID
    editable: str
    is_global: bool
    source_config: Dict[str, Any]
    style_config: Dict[str, Any]
    legend_config: Dict[str, Any]
    layer_metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    # Nested relationships
    features: List[LayerFeatureResponse] = Field(default_factory=list)
    map_layers: List[LayerMapResponse] = Field(default_factory=list)

    # Optional creator info
    creator: Optional[Any] = None  # Can be UserResponse if needed

    model_config = ConfigDict(from_attributes=True)


class LayerListResponse(BaseModel):
    """
    Optimized schema for layer library listing.

    Excludes full feature and map details for performance.
    """

    id: UUID
    name: str
    source_type: str
    category: Optional[str]
    is_global: bool
    created_by: UUID
    created_at: datetime

    # Summary counts instead of full nested data
    feature_count: Optional[int] = 0
    map_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


# Feature schemas for vector layers
class LayerFeatureCreate(BaseModel):
    """Schema for adding a feature to a vector layer"""

    geometry_type: Literal["Point", "LineString", "Polygon", "MultiPoint", "MultiLineString", "MultiPolygon"]
    geometry: Dict[str, Any] = Field(..., description="GeoJSON geometry object")
    properties: Dict[str, Any] = Field(default_factory=dict, description="Feature properties")

    model_config = ConfigDict(from_attributes=True)


class LayerFeatureUpdate(BaseModel):
    """Schema for updating a feature in a vector layer"""

    geometry: Optional[Dict[str, Any]] = None
    properties: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


# Bulk operations
class LayerBulkDelete(BaseModel):
    """Schema for bulk deleting layers"""

    layer_ids: List[UUID] = Field(..., min_length=1, description="List of layer IDs to delete")

    model_config = ConfigDict(from_attributes=True)


class LayerBulkUpdate(BaseModel):
    """Schema for bulk updating layer properties"""

    layer_ids: List[UUID] = Field(..., min_length=1, description="List of layer IDs to update")
    updates: Dict[str, Any] = Field(..., description="Fields to update on all selected layers")

    model_config = ConfigDict(from_attributes=True)
