"""
WMS Server Pydantic schemas for request/response validation.

These schemas handle data validation for:
- WMS server creation and updates
- WMS server API responses
- Capabilities cache management
"""

from uuid import UUID
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict


class WmsServerBase(BaseModel):
    """Base WMS server fields shared across schemas"""

    name: str = Field(..., min_length=1, max_length=255, description="Display name for the WMS server")
    base_url: str = Field(..., min_length=1, description="WMS service endpoint URL")
    description: Optional[str] = Field(default=None, description="Optional description of the WMS server")


class WmsServerCreate(WmsServerBase):
    """
    Schema for creating a new WMS server.

    Only requires name and base_url - capabilities will be auto-fetched.
    """

    model_config = ConfigDict(from_attributes=True)


class WmsServerUpdate(BaseModel):
    """
    Schema for updating a WMS server.

    All fields are optional to support partial updates.
    """

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class WmsServerResponse(BaseModel):
    """
    Schema for full WMS server API responses.

    Includes all server fields, capabilities metadata, and timestamps.
    """

    id: UUID
    name: str
    base_url: str
    description: Optional[str]

    # WMS metadata from GetCapabilities
    version: Optional[str]
    service_title: Optional[str]
    service_provider: Optional[str]
    layer_count: int = Field(default=0)

    # Capabilities cache
    capabilities_cache: dict[str, Any] = Field(default_factory=dict)
    cached_at: Optional[datetime]

    # Creator and timestamps
    created_by: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WmsServerListResponse(BaseModel):
    """
    Optimized schema for WMS server listing.

    Excludes full capabilities cache for performance.
    """

    id: UUID
    name: str
    base_url: str
    description: Optional[str]

    # Summary metadata
    version: Optional[str]
    service_title: Optional[str]
    service_provider: Optional[str]
    layer_count: int = Field(default=0)
    cached_at: Optional[datetime]

    created_by: Optional[UUID]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WmsLayerInfo(BaseModel):
    """
    Schema for a single WMS layer from capabilities.

    Used when browsing available layers from a saved WMS server.
    """

    name: str = Field(..., description="WMS layer name (used in requests)")
    title: Optional[str] = Field(default=None, description="Human-readable layer title")
    abstract: Optional[str] = Field(default=None, description="Layer description/abstract")
    queryable: bool = Field(default=False, description="Whether layer supports GetFeatureInfo")
    bounds: Optional[list[float]] = Field(default=None, description="Geographic bounds [west, south, east, north]")
    crs: list[str] = Field(default_factory=list, description="Supported coordinate reference systems")
    styles: list[dict[str, Any]] = Field(default_factory=list, description="Available styles with name, title, legendUrl")
    dimensions: list[dict[str, Any]] = Field(default_factory=list, description="Dimensions like TIME, ELEVATION")

    model_config = ConfigDict(from_attributes=True)


class WmsServerLayersResponse(BaseModel):
    """
    Schema for available layers from a WMS server.

    Returns layers from the cached GetCapabilities response.
    """

    server_id: UUID
    server_name: str
    base_url: str
    version: Optional[str]
    layers: list[WmsLayerInfo] = Field(default_factory=list)
    cached_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)
