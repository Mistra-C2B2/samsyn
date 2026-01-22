"""
Feature service for LayerFeature database operations.

Handles all feature CRUD operations including:
- Feature retrieval and listing with pagination
- Feature creation (single and bulk)
- Feature updates and deletion
- Spatial queries (bounding box filtering, intersection, containment)
- Permission checks inherited from parent layer
"""

from typing import List, Literal, Optional
from uuid import UUID

from geoalchemy2.functions import (
    ST_Contains,
    ST_GeomFromText,
    ST_Intersects,
    ST_SetSRID,
    ST_Within,
)
from geoalchemy2.shape import to_shape
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.feature import LayerFeature
from app.models.layer import Layer
from app.schemas.layer import LayerFeatureCreate, LayerFeatureUpdate
from app.utils.geojson import geojson_to_wkt, validate_geojson_geometry


class FeatureService:
    """Service for feature database operations"""

    def __init__(self, db: Session):
        self.db = db

    # ========================================================================
    # Core CRUD Operations
    # ========================================================================

    def get_feature(self, feature_id: UUID) -> Optional[LayerFeature]:
        """
        Get feature by ID.

        Args:
            feature_id: Feature UUID

        Returns:
            LayerFeature if found, None otherwise
        """
        return self.db.query(LayerFeature).filter(LayerFeature.id == feature_id).first()

    def list_features(
        self,
        layer_id: UUID,
        bbox: Optional[list[float]] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[LayerFeature]:
        """
        List features for a layer with optional bounding box filtering and pagination.

        Args:
            layer_id: Layer UUID
            bbox: Optional bounding box as [west, south, east, north]
                (minx, miny, maxx, maxy)
            limit: Maximum number of features to return (default 100)
            offset: Number of features to skip (default 0)

        Returns:
            List of LayerFeature instances
        """
        query = self.db.query(LayerFeature).filter(LayerFeature.layer_id == layer_id)

        # Apply bounding box filter if provided
        if bbox and len(bbox) == 4:
            bbox_geom = self._create_bbox_geometry(bbox)
            query = query.filter(ST_Intersects(LayerFeature.geometry, bbox_geom))

        # Apply pagination
        query = query.order_by(LayerFeature.created_at.desc())
        query = query.limit(limit).offset(offset)

        return query.all()

    def count_features(
        self,
        layer_id: UUID,
        bbox: Optional[list[float]] = None,
    ) -> int:
        """
        Count features for a layer with optional bounding box filtering.

        Args:
            layer_id: Layer UUID
            bbox: Optional bounding box as [west, south, east, north]

        Returns:
            Total number of features matching criteria
        """
        query = self.db.query(func.count(LayerFeature.id)).filter(
            LayerFeature.layer_id == layer_id
        )

        # Apply bounding box filter if provided
        if bbox and len(bbox) == 4:
            bbox_geom = self._create_bbox_geometry(bbox)
            query = query.filter(ST_Intersects(LayerFeature.geometry, bbox_geom))

        return query.scalar() or 0

    def create_feature(
        self,
        layer_id: UUID,
        feature_data: LayerFeatureCreate,
    ) -> LayerFeature:
        """
        Create a new feature for a layer.

        Args:
            layer_id: Layer UUID
            feature_data: Feature creation schema with geometry and properties

        Returns:
            Created LayerFeature instance

        Raises:
            ValueError: If geometry is invalid or layer doesn't exist
        """
        # Validate layer exists
        layer = self.db.query(Layer).filter(Layer.id == layer_id).first()
        if not layer:
            raise ValueError(f"Layer with id {layer_id} not found")

        # Validate geometry
        if not validate_geojson_geometry(feature_data.geometry):
            raise ValueError("Invalid GeoJSON geometry")

        # Convert GeoJSON to WKT
        try:
            wkt_geometry = geojson_to_wkt(feature_data.geometry)
        except ValueError as e:
            raise ValueError(f"Failed to convert geometry: {str(e)}")

        # Create feature
        feature = LayerFeature(
            layer_id=layer_id,
            geometry=f"SRID=4326;{wkt_geometry}",
            properties=feature_data.properties or {},
            feature_type=feature_data.geometry_type.lower(),
        )

        self.db.add(feature)
        self.db.commit()
        self.db.refresh(feature)

        return feature

    def create_features_bulk(
        self,
        layer_id: UUID,
        features: List[dict],
    ) -> List[LayerFeature]:
        """
        Create multiple features in bulk for a layer.

        This method is optimized for inserting many features at once.
        Each feature dict should have 'geometry' (GeoJSON) and optional 'properties'.

        Args:
            layer_id: Layer UUID
            features: List of feature dicts with 'geometry' and 'properties'
                     Example: [
                         {
                             "geometry": {"type": "Point", "coordinates": [lon, lat]},
                             "properties": {"name": "Feature 1"}
                         }
                     ]

        Returns:
            List of created LayerFeature instances

        Raises:
            ValueError: If layer doesn't exist or any geometry is invalid
        """
        # Validate layer exists
        layer = self.db.query(Layer).filter(Layer.id == layer_id).first()
        if not layer:
            raise ValueError(f"Layer with id {layer_id} not found")

        created_features = []

        for feature_data in features:
            geometry_geojson = feature_data.get("geometry")
            properties = feature_data.get("properties", {})

            if not geometry_geojson:
                raise ValueError("Each feature must have a 'geometry' field")

            # Validate and convert geometry
            if not validate_geojson_geometry(geometry_geojson):
                raise ValueError(f"Invalid GeoJSON geometry: {geometry_geojson}")

            try:
                wkt_geometry = geojson_to_wkt(geometry_geojson)
                geometry_type = geometry_geojson.get("type", "").lower()
            except ValueError as e:
                raise ValueError(f"Failed to convert geometry: {str(e)}")

            # Create feature
            feature = LayerFeature(
                layer_id=layer_id,
                geometry=f"SRID=4326;{wkt_geometry}",
                properties=properties,
                feature_type=geometry_type,
            )
            created_features.append(feature)

        # Bulk insert
        self.db.add_all(created_features)
        self.db.commit()

        # Refresh all features to get generated IDs
        for feature in created_features:
            self.db.refresh(feature)

        return created_features

    def update_feature(
        self,
        feature_id: UUID,
        feature_data: LayerFeatureUpdate,
    ) -> Optional[LayerFeature]:
        """
        Update a feature with partial data.

        Args:
            feature_id: Feature UUID
            feature_data: Partial update schema

        Returns:
            Updated LayerFeature or None if not found

        Raises:
            ValueError: If geometry update is invalid
        """
        feature = (
            self.db.query(LayerFeature).filter(LayerFeature.id == feature_id).first()
        )

        if not feature:
            return None

        # Update geometry if provided
        if feature_data.geometry is not None:
            if not validate_geojson_geometry(feature_data.geometry):
                raise ValueError("Invalid GeoJSON geometry")

            try:
                wkt_geometry = geojson_to_wkt(feature_data.geometry)
                feature.geometry = f"SRID=4326;{wkt_geometry}"

                # Update feature_type based on new geometry
                geometry_type = feature_data.geometry.get("type", "").lower()
                feature.feature_type = geometry_type
            except ValueError as e:
                raise ValueError(f"Failed to convert geometry: {str(e)}")

        # Update properties if provided (merge with existing)
        if feature_data.properties is not None:
            # Merge with existing properties
            existing_props = feature.properties or {}
            existing_props.update(feature_data.properties)
            feature.properties = existing_props

        self.db.commit()
        self.db.refresh(feature)

        return feature

    def delete_feature(self, feature_id: UUID) -> bool:
        """
        Delete a feature.

        Args:
            feature_id: Feature UUID

        Returns:
            True if deleted, False if not found
        """
        feature = (
            self.db.query(LayerFeature).filter(LayerFeature.id == feature_id).first()
        )

        if not feature:
            return False

        self.db.delete(feature)
        self.db.commit()

        return True

    # ========================================================================
    # Spatial Query Operations
    # ========================================================================

    def spatial_query(
        self,
        layer_id: UUID,
        geometry: dict,
        operation: Literal["intersects", "contains", "within"] = "intersects",
    ) -> List[LayerFeature]:
        """
        Perform spatial query on features using a geometry.

        Args:
            layer_id: Layer UUID
            geometry: GeoJSON geometry object to query against
            operation: Spatial operation type:
                      - "intersects": Features that intersect with geometry
                      - "contains": Features completely contained by geometry
                      - "within": Features that completely contain geometry

        Returns:
            List of LayerFeature instances matching spatial criteria

        Raises:
            ValueError: If geometry is invalid or operation is unsupported
        """
        # Validate geometry
        if not validate_geojson_geometry(geometry):
            raise ValueError("Invalid GeoJSON geometry")

        # Convert to WKT
        try:
            wkt_geometry = geojson_to_wkt(geometry)
        except ValueError as e:
            raise ValueError(f"Failed to convert geometry: {str(e)}")

        # Create PostGIS geometry with SRID
        query_geom = ST_SetSRID(ST_GeomFromText(wkt_geometry), 4326)

        # Build query based on operation
        query = self.db.query(LayerFeature).filter(LayerFeature.layer_id == layer_id)

        if operation == "intersects":
            query = query.filter(ST_Intersects(LayerFeature.geometry, query_geom))
        elif operation == "contains":
            # Query geometry contains features
            query = query.filter(ST_Contains(query_geom, LayerFeature.geometry))
        elif operation == "within":
            # Features contain query geometry
            query = query.filter(ST_Within(query_geom, LayerFeature.geometry))
        else:
            raise ValueError(
                f"Unsupported spatial operation: {operation}. "
                f"Use 'intersects', 'contains', or 'within'."
            )

        return query.all()

    # ========================================================================
    # Helper Methods
    # ========================================================================

    def _create_bbox_geometry(self, bbox: list[float]):
        """
        Create a PostGIS geometry from bounding box coordinates.

        Args:
            bbox: Bounding box as [west, south, east, north] (minx, miny, maxx, maxy)

        Returns:
            PostGIS geometry object
        """
        west, south, east, north = bbox

        # Create WKT polygon from bbox
        wkt = (
            f"POLYGON(({west} {south}, {east} {south}, "
            f"{east} {north}, {west} {north}, {west} {south}))"
        )

        return ST_SetSRID(ST_GeomFromText(wkt), 4326)

    def get_feature_geometry_as_geojson(self, feature: LayerFeature) -> dict:
        """
        Convert feature's PostGIS geometry to GeoJSON.

        Args:
            feature: LayerFeature instance

        Returns:
            GeoJSON geometry dict
        """
        try:
            # Convert PostGIS geometry to Shapely
            shapely_geom = to_shape(feature.geometry)
            # Convert Shapely to GeoJSON using our utility
            from shapely.geometry import mapping

            return mapping(shapely_geom)
        except Exception as e:
            raise ValueError(f"Failed to convert geometry to GeoJSON: {str(e)}")

    def get_layer_bounds(self, layer_id: UUID) -> Optional[list[float]]:
        """
        Calculate bounding box for all features in a layer.

        Args:
            layer_id: Layer UUID

        Returns:
            Bounding box as [west, south, east, north] or None if no features
        """
        # Use PostGIS ST_Extent to calculate bounds
        result = (
            self.db.query(func.ST_AsText(func.ST_Extent(LayerFeature.geometry)))
            .filter(LayerFeature.layer_id == layer_id)
            .scalar()
        )

        if not result:
            return None

        # Parse result (format: "BOX(west south,east north)")
        try:
            # Remove "BOX(" and ")"
            coords = result.replace("BOX(", "").replace(")", "")
            # Split into two points
            point1, point2 = coords.split(",")
            west, south = map(float, point1.split())
            east, north = map(float, point2.split())
            return [west, south, east, north]
        except Exception:
            return None

    def delete_features_by_layer(self, layer_id: UUID) -> int:
        """
        Delete all features belonging to a layer.

        This is typically called when a layer is being deleted.

        Args:
            layer_id: Layer UUID

        Returns:
            Number of features deleted
        """
        count = (
            self.db.query(LayerFeature)
            .filter(LayerFeature.layer_id == layer_id)
            .count()
        )

        self.db.query(LayerFeature).filter(LayerFeature.layer_id == layer_id).delete()

        self.db.commit()

        return count

    def get_feature_count_by_layer(self, layer_id: UUID) -> int:
        """
        Get total number of features in a layer.

        Args:
            layer_id: Layer UUID

        Returns:
            Feature count
        """
        return (
            self.db.query(func.count(LayerFeature.id))
            .filter(LayerFeature.layer_id == layer_id)
            .scalar()
            or 0
        )
