"""
GeoJSON utility functions for converting between GeoJSON and PostGIS geometries.

This module provides utility functions for:
- Converting GeoJSON to WKT (Well-Known Text) for PostGIS
- Converting PostGIS geometry to GeoJSON
- Validating GeoJSON structure
- Extracting bounding boxes from GeoJSON features
- Working with FeatureCollections
"""

from typing import Dict, Any, List, Optional, Tuple, Union
import json

import geojson
from shapely.geometry import shape, mapping
from shapely.geometry.base import BaseGeometry
from geoalchemy2.elements import WKBElement
from geoalchemy2.shape import to_shape, from_shape


class GeoJSONValidationError(Exception):
    """Raised when GeoJSON validation fails."""
    pass


def geojson_to_wkt(geojson_geometry: Dict[str, Any]) -> str:
    """
    Convert GeoJSON geometry to WKT (Well-Known Text) format for PostGIS.

    Args:
        geojson_geometry: A GeoJSON geometry object (dict with 'type' and 'coordinates')

    Returns:
        WKT string representation of the geometry

    Raises:
        GeoJSONValidationError: If the GeoJSON geometry is invalid
        ValueError: If the geometry cannot be converted

    Example:
        >>> geojson_geom = {
        ...     "type": "Point",
        ...     "coordinates": [102.0, 0.5]
        ... }
        >>> wkt = geojson_to_wkt(geojson_geom)
        >>> print(wkt)
        'POINT (102 0.5)'
    """
    try:
        # Validate GeoJSON geometry structure
        if not isinstance(geojson_geometry, dict):
            raise GeoJSONValidationError("GeoJSON geometry must be a dictionary")

        if "type" not in geojson_geometry:
            raise GeoJSONValidationError("GeoJSON geometry must have a 'type' field")

        if "coordinates" not in geojson_geometry:
            raise GeoJSONValidationError("GeoJSON geometry must have a 'coordinates' field")

        # Convert GeoJSON to Shapely geometry
        shapely_geom = shape(geojson_geometry)

        # Convert to WKT
        return shapely_geom.wkt

    except AttributeError as e:
        raise ValueError(f"Invalid GeoJSON geometry structure: {str(e)}")
    except Exception as e:
        raise ValueError(f"Failed to convert GeoJSON to WKT: {str(e)}")


def geojson_to_postgis(geojson_geometry: Dict[str, Any], srid: int = 4326) -> WKBElement:
    """
    Convert GeoJSON geometry to PostGIS WKBElement.

    Args:
        geojson_geometry: A GeoJSON geometry object
        srid: Spatial Reference System Identifier (default: 4326 for WGS84)

    Returns:
        WKBElement that can be stored in PostGIS geometry column

    Raises:
        GeoJSONValidationError: If the GeoJSON geometry is invalid
        ValueError: If the geometry cannot be converted

    Example:
        >>> geojson_geom = {"type": "Point", "coordinates": [102.0, 0.5]}
        >>> postgis_geom = geojson_to_postgis(geojson_geom)
    """
    try:
        # Convert GeoJSON to Shapely geometry
        shapely_geom = shape(geojson_geometry)

        # Convert Shapely geometry to PostGIS WKBElement
        return from_shape(shapely_geom, srid=srid)

    except Exception as e:
        raise ValueError(f"Failed to convert GeoJSON to PostGIS: {str(e)}")


def postgis_to_geojson(postgis_geometry: WKBElement) -> Dict[str, Any]:
    """
    Convert PostGIS geometry (WKBElement) to GeoJSON geometry object.

    Args:
        postgis_geometry: A PostGIS WKBElement from database

    Returns:
        GeoJSON geometry dictionary with 'type' and 'coordinates'

    Raises:
        ValueError: If the geometry cannot be converted

    Example:
        >>> # Assuming postgis_geom is from database
        >>> geojson_geom = postgis_to_geojson(postgis_geom)
        >>> print(geojson_geom)
        {'type': 'Point', 'coordinates': [102.0, 0.5]}
    """
    try:
        # Convert PostGIS WKBElement to Shapely geometry
        shapely_geom = to_shape(postgis_geometry)

        # Convert Shapely geometry to GeoJSON
        return mapping(shapely_geom)

    except Exception as e:
        raise ValueError(f"Failed to convert PostGIS to GeoJSON: {str(e)}")


def validate_geojson_geometry(geojson_geometry: Dict[str, Any]) -> bool:
    """
    Validate GeoJSON geometry structure (geometry object only).

    Args:
        geojson_geometry: GeoJSON geometry object (dict with 'type' and 'coordinates')

    Returns:
        True if valid geometry, False otherwise

    Example:
        >>> geom = {"type": "Point", "coordinates": [102.0, 0.5]}
        >>> validate_geojson_geometry(geom)
        True
    """
    try:
        if not isinstance(geojson_geometry, dict):
            return False

        if "type" not in geojson_geometry:
            return False

        geom_type = geojson_geometry["type"]

        # GeometryCollection has 'geometries' instead of 'coordinates'
        if geom_type == "GeometryCollection":
            if "geometries" not in geojson_geometry:
                return False
        else:
            if "coordinates" not in geojson_geometry:
                return False

        # Try to create Shapely geometry for validation
        shapely_geom = shape(geojson_geometry)
        return shapely_geom.is_valid

    except Exception:
        return False


def validate_geojson(geojson_obj: Union[Dict[str, Any], str]) -> bool:
    """
    Validate GeoJSON structure (geometry, feature, or feature collection).

    Args:
        geojson_obj: GeoJSON object (dict) or JSON string

    Returns:
        True if valid GeoJSON

    Raises:
        GeoJSONValidationError: If the GeoJSON is invalid with details about what's wrong

    Example:
        >>> geojson_feature = {
        ...     "type": "Feature",
        ...     "geometry": {"type": "Point", "coordinates": [102.0, 0.5]},
        ...     "properties": {"name": "Sample Point"}
        ... }
        >>> validate_geojson(geojson_feature)
        True
    """
    try:
        # Parse JSON string if needed
        if isinstance(geojson_obj, str):
            try:
                geojson_obj = json.loads(geojson_obj)
            except json.JSONDecodeError as e:
                raise GeoJSONValidationError(f"Invalid JSON: {str(e)}")

        if not isinstance(geojson_obj, dict):
            raise GeoJSONValidationError("GeoJSON must be a dictionary")

        # Check for required 'type' field
        if "type" not in geojson_obj:
            raise GeoJSONValidationError("GeoJSON must have a 'type' field")

        geojson_type = geojson_obj["type"]

        # Validate based on type
        if geojson_type == "FeatureCollection":
            obj = geojson.FeatureCollection(**geojson_obj)
        elif geojson_type == "Feature":
            obj = geojson.Feature(**geojson_obj)
        elif geojson_type in ["Point", "LineString", "Polygon", "MultiPoint",
                               "MultiLineString", "MultiPolygon", "GeometryCollection"]:
            # Geometry object
            if "coordinates" not in geojson_obj and geojson_type != "GeometryCollection":
                raise GeoJSONValidationError(f"{geojson_type} must have 'coordinates' field")

            # Try to create Shapely geometry for validation
            try:
                shapely_geom = shape(geojson_obj)
                if not shapely_geom.is_valid:
                    raise GeoJSONValidationError(f"Invalid geometry: {shapely_geom.is_valid_reason}")
            except Exception as e:
                raise GeoJSONValidationError(f"Invalid geometry structure: {str(e)}")
        else:
            raise GeoJSONValidationError(f"Unknown GeoJSON type: {geojson_type}")

        return True

    except GeoJSONValidationError:
        raise
    except Exception as e:
        raise GeoJSONValidationError(f"GeoJSON validation failed: {str(e)}")


def extract_bounding_box(geojson_obj: Dict[str, Any]) -> Optional[Tuple[float, float, float, float]]:
    """
    Extract bounding box from GeoJSON feature or geometry.

    Args:
        geojson_obj: GeoJSON Feature, FeatureCollection, or Geometry object

    Returns:
        Tuple of (min_lon, min_lat, max_lon, max_lat) or None if no geometry

    Raises:
        ValueError: If the GeoJSON is invalid

    Example:
        >>> geojson_feature = {
        ...     "type": "Feature",
        ...     "geometry": {"type": "Point", "coordinates": [102.0, 0.5]},
        ...     "properties": {}
        ... }
        >>> bbox = extract_bounding_box(geojson_feature)
        >>> print(bbox)
        (102.0, 0.5, 102.0, 0.5)
    """
    try:
        geometry = None

        # Extract geometry based on GeoJSON type
        if geojson_obj.get("type") == "Feature":
            geometry = geojson_obj.get("geometry")
        elif geojson_obj.get("type") == "FeatureCollection":
            # For FeatureCollection, compute bounding box of all features
            features = geojson_obj.get("features", [])
            if not features:
                return None

            all_bounds = []
            for feature in features:
                feature_bbox = extract_bounding_box(feature)
                if feature_bbox:
                    all_bounds.append(feature_bbox)

            if not all_bounds:
                return None

            # Compute overall bounding box
            min_lon = min(bbox[0] for bbox in all_bounds)
            min_lat = min(bbox[1] for bbox in all_bounds)
            max_lon = max(bbox[2] for bbox in all_bounds)
            max_lat = max(bbox[3] for bbox in all_bounds)

            return (min_lon, min_lat, max_lon, max_lat)
        else:
            # Assume it's a geometry object
            geometry = geojson_obj

        if not geometry:
            return None

        # Convert to Shapely geometry and get bounds
        shapely_geom = shape(geometry)
        bounds = shapely_geom.bounds  # Returns (minx, miny, maxx, maxy)

        return bounds

    except Exception as e:
        raise ValueError(f"Failed to extract bounding box: {str(e)}")


def featurecollection_to_features(feature_collection: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extract list of features from a GeoJSON FeatureCollection.

    Args:
        feature_collection: GeoJSON FeatureCollection object

    Returns:
        List of GeoJSON Feature objects

    Raises:
        ValueError: If the input is not a valid FeatureCollection

    Example:
        >>> fc = {
        ...     "type": "FeatureCollection",
        ...     "features": [
        ...         {"type": "Feature", "geometry": {...}, "properties": {...}},
        ...         {"type": "Feature", "geometry": {...}, "properties": {...}}
        ...     ]
        ... }
        >>> features = featurecollection_to_features(fc)
        >>> len(features)
        2
    """
    if not isinstance(feature_collection, dict):
        raise ValueError("FeatureCollection must be a dictionary")

    if feature_collection.get("type") != "FeatureCollection":
        raise ValueError(f"Expected FeatureCollection, got {feature_collection.get('type')}")

    if "features" not in feature_collection:
        raise ValueError("FeatureCollection must have 'features' field")

    features = feature_collection["features"]

    if not isinstance(features, list):
        raise ValueError("FeatureCollection 'features' must be a list")

    return features


def features_to_featurecollection(
    features: List[Dict[str, Any]],
    bbox: Optional[Tuple[float, float, float, float]] = None
) -> Dict[str, Any]:
    """
    Create a GeoJSON FeatureCollection from a list of features.

    Args:
        features: List of GeoJSON Feature objects
        bbox: Optional bounding box tuple (min_lon, min_lat, max_lon, max_lat)

    Returns:
        GeoJSON FeatureCollection object

    Raises:
        ValueError: If features list is invalid

    Example:
        >>> features = [
        ...     {"type": "Feature", "geometry": {"type": "Point", "coordinates": [102.0, 0.5]}, "properties": {}},
        ...     {"type": "Feature", "geometry": {"type": "Point", "coordinates": [103.0, 1.5]}, "properties": {}}
        ... ]
        >>> fc = features_to_featurecollection(features)
        >>> fc["type"]
        'FeatureCollection'
    """
    if not isinstance(features, list):
        raise ValueError("Features must be a list")

    feature_collection: Dict[str, Any] = {
        "type": "FeatureCollection",
        "features": features
    }

    # Add bounding box if provided
    if bbox is not None:
        if not isinstance(bbox, (tuple, list)) or len(bbox) != 4:
            raise ValueError("Bounding box must be a tuple of 4 values (min_lon, min_lat, max_lon, max_lat)")
        feature_collection["bbox"] = list(bbox)

    return feature_collection


def feature_to_postgis(
    feature: Dict[str, Any],
    srid: int = 4326
) -> Tuple[WKBElement, Dict[str, Any]]:
    """
    Convert a GeoJSON Feature to PostGIS geometry and properties.

    Args:
        feature: GeoJSON Feature object
        srid: Spatial Reference System Identifier (default: 4326)

    Returns:
        Tuple of (PostGIS WKBElement, properties dict)

    Raises:
        ValueError: If the feature is invalid

    Example:
        >>> feature = {
        ...     "type": "Feature",
        ...     "geometry": {"type": "Point", "coordinates": [102.0, 0.5]},
        ...     "properties": {"name": "Sample", "value": 42}
        ... }
        >>> geometry, properties = feature_to_postgis(feature)
        >>> properties["name"]
        'Sample'
    """
    if not isinstance(feature, dict):
        raise ValueError("Feature must be a dictionary")

    if feature.get("type") != "Feature":
        raise ValueError(f"Expected Feature, got {feature.get('type')}")

    geometry = feature.get("geometry")
    if not geometry:
        raise ValueError("Feature must have a 'geometry' field")

    properties = feature.get("properties", {})

    # Convert geometry to PostGIS
    postgis_geom = geojson_to_postgis(geometry, srid=srid)

    return postgis_geom, properties


def postgis_to_feature(
    postgis_geometry: WKBElement,
    properties: Optional[Dict[str, Any]] = None,
    feature_id: Optional[Union[str, int]] = None
) -> Dict[str, Any]:
    """
    Convert PostGIS geometry and properties to a GeoJSON Feature.

    Args:
        postgis_geometry: PostGIS WKBElement from database
        properties: Optional properties dictionary
        feature_id: Optional feature ID

    Returns:
        GeoJSON Feature object

    Example:
        >>> # Assuming postgis_geom is from database
        >>> feature = postgis_to_feature(
        ...     postgis_geom,
        ...     properties={"name": "Sample"},
        ...     feature_id="feature-1"
        ... )
        >>> feature["type"]
        'Feature'
    """
    geometry = postgis_to_geojson(postgis_geometry)

    feature: Dict[str, Any] = {
        "type": "Feature",
        "geometry": geometry,
        "properties": properties or {}
    }

    if feature_id is not None:
        feature["id"] = feature_id

    return feature


def get_geometry_type(geojson_geometry: Dict[str, Any]) -> str:
    """
    Get the geometry type from a GeoJSON geometry object.

    Args:
        geojson_geometry: GeoJSON geometry object

    Returns:
        Geometry type string (e.g., 'Point', 'LineString', 'Polygon')

    Raises:
        ValueError: If the geometry is invalid

    Example:
        >>> geom = {"type": "Point", "coordinates": [102.0, 0.5]}
        >>> get_geometry_type(geom)
        'Point'
    """
    if not isinstance(geojson_geometry, dict):
        raise ValueError("Geometry must be a dictionary")

    geom_type = geojson_geometry.get("type")
    if not geom_type:
        raise ValueError("Geometry must have a 'type' field")

    valid_types = [
        "Point", "LineString", "Polygon",
        "MultiPoint", "MultiLineString", "MultiPolygon",
        "GeometryCollection"
    ]

    if geom_type not in valid_types:
        raise ValueError(f"Invalid geometry type: {geom_type}")

    return geom_type
