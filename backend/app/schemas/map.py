"""
Map Pydantic schemas for request/response validation.

These schemas handle data validation for:
- Map creation and updates
- Map API responses with nested relationships
- Collaborator management
- Map-layer associations
"""

from uuid import UUID
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, field_validator, ConfigDict
from enum import Enum


# Enums
class MapPermissionEnum(str, Enum):
    """Map permission levels"""
    private = "private"
    collaborators = "collaborators"
    public = "public"


class CollaboratorRoleEnum(str, Enum):
    """Collaborator role types"""
    viewer = "viewer"
    editor = "editor"


# Base schemas
class MapBase(BaseModel):
    """Base map fields shared across schemas"""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    center_lat: float = Field(default=0.0, ge=-90, le=90)
    center_lng: float = Field(default=0.0, ge=-180, le=180)
    zoom: float = Field(default=2.0, ge=0, le=22)
    map_metadata: Optional[dict[str, Any]] = Field(default_factory=dict)


class MapCreate(MapBase):
    """
    Schema for creating a new map.

    Includes permission level which defaults to private.
    """

    permission: MapPermissionEnum = MapPermissionEnum.private


class MapUpdate(BaseModel):
    """
    Schema for updating a map.

    All fields are optional to support partial updates.
    """

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    center_lat: Optional[float] = Field(None, ge=-90, le=90)
    center_lng: Optional[float] = Field(None, ge=-180, le=180)
    zoom: Optional[float] = Field(None, ge=0, le=22)
    permission: Optional[MapPermissionEnum] = None
    map_metadata: Optional[dict[str, Any]] = None


# Nested schemas for responses
class MapCollaboratorResponse(BaseModel):
    """Schema for collaborator in map context"""

    id: UUID
    user_id: UUID
    role: str
    created_at: datetime

    # Optional nested user info
    user: Optional[Any] = None  # Can be UserResponse if needed

    model_config = ConfigDict(from_attributes=True)


class MapLayerResponse(BaseModel):
    """Schema for layer in map context"""

    id: UUID
    layer_id: UUID
    order: int
    visible: bool
    opacity: int = Field(..., ge=0, le=100)
    created_at: datetime

    # Optional nested layer info
    layer: Optional[Any] = None  # Can be LayerResponse if needed

    model_config = ConfigDict(from_attributes=True)


class MapResponse(BaseModel):
    """
    Schema for full map API responses.

    Includes all map fields, creator info, collaborators, and layers.
    """

    id: UUID
    name: str
    description: Optional[str]
    created_by: UUID
    permission: str
    center_lat: float
    center_lng: float
    zoom: float
    map_metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    # Nested relationships
    collaborators: List[MapCollaboratorResponse] = Field(default_factory=list)
    map_layers: List[MapLayerResponse] = Field(default_factory=list)

    # Optional creator info
    creator: Optional[Any] = None  # Can be UserResponse if needed

    model_config = ConfigDict(from_attributes=True)


class MapListResponse(BaseModel):
    """
    Simplified schema for map list views.

    Excludes full layer details for performance.
    """

    id: UUID
    name: str
    description: Optional[str]
    created_by: UUID
    permission: str
    center_lat: float
    center_lng: float
    zoom: float
    created_at: datetime
    updated_at: datetime

    # Summary counts instead of full nested data
    collaborator_count: Optional[int] = 0
    layer_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


# Collaborator schemas
class MapCollaboratorCreate(BaseModel):
    """Schema for adding a collaborator to a map"""

    user_id: UUID
    role: CollaboratorRoleEnum = CollaboratorRoleEnum.viewer


class MapCollaboratorUpdate(BaseModel):
    """Schema for updating a collaborator's role"""

    role: CollaboratorRoleEnum


# Map-Layer association schemas
class MapLayerCreate(BaseModel):
    """Schema for adding a layer to a map"""

    layer_id: UUID
    order: int = Field(default=0, ge=0)
    visible: bool = True
    opacity: int = Field(default=100, ge=0, le=100)


class MapLayerUpdate(BaseModel):
    """Schema for updating layer visibility/opacity/order in a map"""

    order: Optional[int] = Field(None, ge=0)
    visible: Optional[bool] = None
    opacity: Optional[int] = Field(None, ge=0, le=100)


class MapLayerReorder(BaseModel):
    """Schema for reordering layers in a map"""

    layer_orders: List[dict[str, Any]] = Field(
        ...,
        description="List of {layer_id: UUID, order: int} objects"
    )

    @field_validator('layer_orders')
    @classmethod
    def validate_layer_orders(cls, v):
        """Validate that each item has layer_id and order"""
        for item in v:
            if 'layer_id' not in item or 'order' not in item:
                raise ValueError("Each item must have 'layer_id' and 'order' fields")
            if not isinstance(item['order'], int) or item['order'] < 0:
                raise ValueError("Order must be a non-negative integer")
        return v
