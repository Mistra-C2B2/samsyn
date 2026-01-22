"""
Feature Pydantic schemas for request/response validation.

These schemas handle data validation for:
- Feature CRUD operations (create, read, update, delete)
- GeoJSON geometry and properties
- Spatial query parameters (bbox, intersects)
- Bulk feature operations and GeoJSON FeatureCollection import
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


# Enums
class GeometryTypeEnum(str, Enum):
    """GeoJSON geometry types"""

    Point = "Point"
    LineString = "LineString"
    Polygon = "Polygon"
    MultiPoint = "MultiPoint"
    MultiLineString = "MultiLineString"
    MultiPolygon = "MultiPolygon"


# GeoJSON Geometry schemas
class FeatureGeometry(BaseModel):
    """
    Schema for GeoJSON geometry objects.

    Supports all standard GeoJSON geometry types with coordinate validation.
    """

    type: GeometryTypeEnum = Field(..., description="GeoJSON geometry type")
    coordinates: Union[
        List[float],  # Point
        List[List[float]],  # LineString, MultiPoint
        List[List[List[float]]],  # Polygon, MultiLineString
        List[List[List[List[float]]]],  # MultiPolygon
    ] = Field(..., description="Coordinates array following GeoJSON specification")

    model_config = ConfigDict(from_attributes=True)

    @field_validator("coordinates")
    @classmethod
    def validate_coordinates(cls, v, info):
        """Validate coordinate structure based on geometry type"""
        geometry_type = info.data.get("type")

        if not v:
            raise ValueError("Coordinates cannot be empty")

        # Basic structure validation based on type
        if geometry_type == GeometryTypeEnum.Point:
            if not isinstance(v, list) or len(v) < 2:
                raise ValueError(
                    "Point coordinates must be [lng, lat] or [lng, lat, elevation]"
                )
            if len(v) > 3:
                raise ValueError("Point coordinates cannot have more than 3 elements")

        elif geometry_type == GeometryTypeEnum.LineString:
            if not isinstance(v, list) or len(v) < 2:
                raise ValueError("LineString must have at least 2 positions")
            for pos in v:
                if not isinstance(pos, list) or len(pos) < 2:
                    raise ValueError(
                        "Each position must be [lng, lat] or [lng, lat, elevation]"
                    )

        elif geometry_type == GeometryTypeEnum.Polygon:
            if not isinstance(v, list) or len(v) < 1:
                raise ValueError("Polygon must have at least one ring")
            for ring in v:
                if not isinstance(ring, list) or len(ring) < 4:
                    raise ValueError(
                        "Each ring must have at least 4 positions (closed)"
                    )
                # Validate closure (first and last positions must be identical)
                if ring[0] != ring[-1]:
                    raise ValueError(
                        "Polygon ring must be closed "
                        "(first and last positions identical)"
                    )

        elif geometry_type == GeometryTypeEnum.MultiPoint:
            if not isinstance(v, list) or len(v) < 1:
                raise ValueError("MultiPoint must have at least one position")
            for pos in v:
                if not isinstance(pos, list) or len(pos) < 2:
                    raise ValueError(
                        "Each position must be [lng, lat] or [lng, lat, elevation]"
                    )

        elif geometry_type == GeometryTypeEnum.MultiLineString:
            if not isinstance(v, list) or len(v) < 1:
                raise ValueError("MultiLineString must have at least one LineString")
            for linestring in v:
                if not isinstance(linestring, list) or len(linestring) < 2:
                    raise ValueError("Each LineString must have at least 2 positions")

        elif geometry_type == GeometryTypeEnum.MultiPolygon:
            if not isinstance(v, list) or len(v) < 1:
                raise ValueError("MultiPolygon must have at least one Polygon")
            for polygon in v:
                if not isinstance(polygon, list) or len(polygon) < 1:
                    raise ValueError("Each Polygon must have at least one ring")
                for ring in polygon:
                    if not isinstance(ring, list) or len(ring) < 4:
                        raise ValueError(
                            "Each ring must have at least 4 positions (closed)"
                        )
                    if ring[0] != ring[-1]:
                        raise ValueError("Polygon ring must be closed")

        return v


class FeatureProperties(BaseModel):
    """
    Schema for GeoJSON feature properties.

    Flexible dictionary to store arbitrary feature attributes.
    """

    properties: Dict[str, Any] = Field(
        default_factory=dict, description="Feature properties as key-value pairs"
    )

    model_config = ConfigDict(from_attributes=True)


# Base schemas
class FeatureBase(BaseModel):
    """Base feature fields shared across schemas"""

    geometry: Dict[str, Any] = Field(..., description="GeoJSON geometry object")
    properties: Dict[str, Any] = Field(
        default_factory=dict, description="Feature properties"
    )
    feature_type: Optional[str] = Field(
        default=None, max_length=100, description="Optional feature type/category"
    )

    model_config = ConfigDict(from_attributes=True)


class FeatureCreate(FeatureBase):
    """
    Schema for creating a new feature.

    Validates geometry structure and accepts arbitrary properties.
    """

    @field_validator("geometry")
    @classmethod
    def validate_geometry_structure(cls, v):
        """Validate that geometry has required GeoJSON fields"""
        if not isinstance(v, dict):
            raise ValueError("Geometry must be a dictionary")

        if "type" not in v:
            raise ValueError("Geometry must have a 'type' field")

        if "coordinates" not in v:
            raise ValueError("Geometry must have a 'coordinates' field")

        # Validate using FeatureGeometry schema
        try:
            FeatureGeometry(**v)
        except Exception as e:
            raise ValueError(f"Invalid geometry: {str(e)}")

        return v


class FeatureUpdate(BaseModel):
    """
    Schema for updating a feature.

    All fields are optional to support partial updates.
    """

    geometry: Optional[Dict[str, Any]] = Field(
        None, description="Updated GeoJSON geometry object"
    )
    properties: Optional[Dict[str, Any]] = Field(
        None, description="Updated feature properties"
    )
    feature_type: Optional[str] = Field(
        None, max_length=100, description="Updated feature type"
    )

    model_config = ConfigDict(from_attributes=True)

    @field_validator("geometry")
    @classmethod
    def validate_geometry_structure(cls, v):
        """Validate geometry structure if provided"""
        if v is not None:
            if not isinstance(v, dict):
                raise ValueError("Geometry must be a dictionary")

            if "type" not in v or "coordinates" not in v:
                raise ValueError("Geometry must have 'type' and 'coordinates' fields")

            # Validate using FeatureGeometry schema
            try:
                FeatureGeometry(**v)
            except Exception as e:
                raise ValueError(f"Invalid geometry: {str(e)}")

        return v


class FeatureResponse(BaseModel):
    """
    Schema for feature API responses.

    Returns complete feature data including metadata.
    """

    id: UUID
    layer_id: UUID
    geometry: Dict[str, Any] = Field(..., description="GeoJSON geometry object")
    properties: Dict[str, Any] = Field(default_factory=dict)
    feature_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FeatureGeoJSONResponse(BaseModel):
    """
    Schema for GeoJSON Feature format response.

    Complies with GeoJSON specification (RFC 7946).
    """

    type: Literal["Feature"] = "Feature"
    id: UUID
    geometry: Dict[str, Any]
    properties: Dict[str, Any]

    model_config = ConfigDict(from_attributes=True)


# GeoJSON FeatureCollection schemas
class GeoJSONFeature(BaseModel):
    """
    Schema for individual GeoJSON Feature in a FeatureCollection.

    Used for bulk imports and exports.
    """

    type: Literal["Feature"] = "Feature"
    geometry: Dict[str, Any] = Field(..., description="GeoJSON geometry object")
    properties: Dict[str, Any] = Field(
        default_factory=dict, description="Feature properties"
    )
    id: Optional[Union[str, int, UUID]] = Field(
        default=None, description="Optional feature ID"
    )

    model_config = ConfigDict(from_attributes=True)

    @field_validator("geometry")
    @classmethod
    def validate_geometry_structure(cls, v):
        """Validate geometry structure"""
        if not isinstance(v, dict):
            raise ValueError("Geometry must be a dictionary")

        if "type" not in v or "coordinates" not in v:
            raise ValueError("Geometry must have 'type' and 'coordinates' fields")

        return v


class FeatureCollection(BaseModel):
    """
    Schema for GeoJSON FeatureCollection.

    Complies with GeoJSON specification (RFC 7946).
    """

    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: List[GeoJSONFeature] = Field(
        default_factory=list, description="Array of GeoJSON features"
    )

    model_config = ConfigDict(from_attributes=True)

    @field_validator("features")
    @classmethod
    def validate_features(cls, v):
        """Validate that features list is not empty for bulk operations"""
        if not v:
            raise ValueError("FeatureCollection must contain at least one feature")
        return v


class BulkFeatureCreate(BaseModel):
    """
    Schema for importing GeoJSON FeatureCollections.

    Validates and prepares features for bulk insertion into a layer.
    """

    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: List[Dict[str, Any]] = Field(
        ..., min_length=1, description="Array of GeoJSON features to import"
    )
    feature_type: Optional[str] = Field(
        default=None,
        max_length=100,
        description="Optional type to apply to all features",
    )

    model_config = ConfigDict(from_attributes=True)

    @field_validator("features")
    @classmethod
    def validate_features(cls, v):
        """Validate each feature structure"""
        if not v:
            raise ValueError("Must provide at least one feature")

        for i, feature in enumerate(v):
            if not isinstance(feature, dict):
                raise ValueError(f"Feature at index {i} must be a dictionary")

            # Validate GeoJSON Feature structure
            if "type" not in feature or feature["type"] != "Feature":
                raise ValueError(f"Feature at index {i} must have type='Feature'")

            if "geometry" not in feature:
                raise ValueError(f"Feature at index {i} must have a 'geometry' field")

            if not isinstance(feature["geometry"], dict):
                raise ValueError(f"Feature at index {i} geometry must be a dictionary")

            if (
                "type" not in feature["geometry"]
                or "coordinates" not in feature["geometry"]
            ):
                raise ValueError(
                    f"Feature at index {i} geometry must have 'type' and 'coordinates'"
                )

            # Validate geometry using FeatureGeometry schema
            try:
                FeatureGeometry(**feature["geometry"])
            except Exception as e:
                raise ValueError(f"Feature at index {i} has invalid geometry: {str(e)}")

        return v


class BulkFeatureResponse(BaseModel):
    """
    Schema for bulk feature operation responses.

    Returns summary of bulk operation results.
    """

    success: bool
    created_count: int = Field(
        ..., description="Number of features successfully created"
    )
    failed_count: int = Field(default=0, description="Number of features that failed")
    feature_ids: List[UUID] = Field(
        default_factory=list, description="List of created feature IDs"
    )
    errors: List[Dict[str, Any]] = Field(
        default_factory=list, description="List of error details for failed features"
    )

    model_config = ConfigDict(from_attributes=True)


# Query parameter schemas
class FeatureQueryParams(BaseModel):
    """
    Schema for spatial and pagination query parameters.

    Supports bounding box filtering, geometry intersection, and pagination.
    """

    bbox: Optional[str] = Field(
        default=None,
        description=(
            "Bounding box filter: 'west,south,east,north' (e.g., '-180,-90,180,90')"
        ),
    )
    intersects: Optional[str] = Field(
        default=None,
        description="GeoJSON geometry as string to filter features that intersect",
    )
    feature_type: Optional[str] = Field(
        default=None, description="Filter by feature type"
    )
    limit: int = Field(
        default=100, ge=1, le=1000, description="Maximum number of features to return"
    )
    offset: int = Field(
        default=0, ge=0, description="Number of features to skip (for pagination)"
    )

    model_config = ConfigDict(from_attributes=True)

    @field_validator("bbox")
    @classmethod
    def validate_bbox(cls, v):
        """Validate bounding box format and coordinates"""
        if v is not None:
            try:
                coords = [float(x.strip()) for x in v.split(",")]
                if len(coords) != 4:
                    raise ValueError("Bounding box must have 4 coordinates")

                west, south, east, north = coords

                # Validate longitude range
                if west < -180 or west > 180 or east < -180 or east > 180:
                    raise ValueError("Longitude must be between -180 and 180")

                # Validate latitude range
                if south < -90 or south > 90 or north < -90 or north > 90:
                    raise ValueError("Latitude must be between -90 and 90")

                # Validate logical bounds
                if west > east:
                    raise ValueError(
                        "West longitude must be less than or equal to east longitude"
                    )

                if south > north:
                    raise ValueError(
                        "South latitude must be less than or equal to north latitude"
                    )

            except ValueError as e:
                raise ValueError(f"Invalid bbox format: {str(e)}")

        return v

    @field_validator("intersects")
    @classmethod
    def validate_intersects(cls, v):
        """Validate intersects geometry is valid GeoJSON"""
        if v is not None:
            try:
                import json

                geometry = json.loads(v)

                if not isinstance(geometry, dict):
                    raise ValueError("Intersects must be a GeoJSON geometry object")

                if "type" not in geometry or "coordinates" not in geometry:
                    raise ValueError(
                        "Intersects geometry must have 'type' and 'coordinates'"
                    )

                # Validate using FeatureGeometry schema
                FeatureGeometry(**geometry)

            except json.JSONDecodeError:
                raise ValueError("Intersects must be valid JSON")
            except Exception as e:
                raise ValueError(f"Invalid intersects geometry: {str(e)}")

        return v


# Bulk delete schema
class BulkFeatureDelete(BaseModel):
    """Schema for bulk deleting features"""

    feature_ids: List[UUID] = Field(
        ..., min_length=1, description="List of feature IDs to delete"
    )

    model_config = ConfigDict(from_attributes=True)


class BulkFeatureDeleteResponse(BaseModel):
    """Schema for bulk delete operation response"""

    success: bool
    deleted_count: int = Field(
        ..., description="Number of features successfully deleted"
    )
    failed_count: int = Field(
        default=0, description="Number of features that failed to delete"
    )
    errors: List[Dict[str, Any]] = Field(
        default_factory=list, description="List of error details"
    )

    model_config = ConfigDict(from_attributes=True)
