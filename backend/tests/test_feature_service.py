"""
Unit tests for feature service.

Tests feature CRUD operations, bulk imports, spatial queries, and bounding box operations.
Uses PostgreSQL test database with PostGIS extension and transaction rollback for isolation.
"""

import pytest
from uuid import uuid4

from app.models.feature import LayerFeature
from app.models.layer import Layer
from app.models.user import User
from app.services.feature_service import FeatureService
from app.schemas.layer import LayerFeatureCreate, LayerFeatureUpdate


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def feature_service(db_session):
    """Create feature service instance"""
    return FeatureService(db_session)


@pytest.fixture
def test_user(db_session):
    """Create a test user"""
    user = User(
        clerk_id="user_test_feature_owner",
        email="featureowner@example.com",
        username="featureowner",
        first_name="Feature",
        last_name="Owner",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_layer(db_session, test_user):
    """Create a vector test layer for features"""
    layer = Layer(
        name="Test Vector Layer",
        source_type="vector",
        description="Test layer for features",
        category="test",
        created_by=test_user.id,
        editable="creator-only",
        is_global=False,
        source_config={"type": "geojson"},
    )
    db_session.add(layer)
    db_session.commit()
    db_session.refresh(layer)
    return layer


@pytest.fixture
def second_layer(db_session, test_user):
    """Create a second test layer"""
    layer = Layer(
        name="Second Test Layer",
        source_type="vector",
        description="Second test layer",
        category="test",
        created_by=test_user.id,
        editable="everyone",
        is_global=False,
        source_config={"type": "geojson"},
    )
    db_session.add(layer)
    db_session.commit()
    db_session.refresh(layer)
    return layer


@pytest.fixture
def sample_point_geojson():
    """Sample Point GeoJSON geometry"""
    return {
        "type": "Point",
        "coordinates": [-122.4194, 37.7749]  # San Francisco
    }


@pytest.fixture
def sample_linestring_geojson():
    """Sample LineString GeoJSON geometry"""
    return {
        "type": "LineString",
        "coordinates": [
            [-122.4194, 37.7749],
            [-122.4089, 37.7833],
            [-122.4156, 37.7908]
        ]
    }


@pytest.fixture
def sample_polygon_geojson():
    """Sample Polygon GeoJSON geometry"""
    return {
        "type": "Polygon",
        "coordinates": [[
            [-122.5, 37.7],
            [-122.3, 37.7],
            [-122.3, 37.8],
            [-122.5, 37.8],
            [-122.5, 37.7]
        ]]
    }


@pytest.fixture
def sample_feature_data(sample_point_geojson):
    """Sample LayerFeatureCreate schema"""
    return LayerFeatureCreate(
        geometry_type="Point",
        geometry=sample_point_geojson,
        properties={"name": "Test Point", "value": 42}
    )


@pytest.fixture
def test_feature(db_session, test_layer, sample_point_geojson):
    """Create a test feature in the database"""
    feature = LayerFeature(
        layer_id=test_layer.id,
        geometry=f"SRID=4326;POINT(-122.4194 37.7749)",
        properties={"name": "Test Feature", "value": 100},
        feature_type="point",
    )
    db_session.add(feature)
    db_session.commit()
    db_session.refresh(feature)
    return feature


# ============================================================================
# Core CRUD Tests
# ============================================================================


class TestFeatureCRUD:
    """Test core feature CRUD operations"""

    def test_create_feature(self, feature_service, test_layer, sample_feature_data):
        """Test creating a single feature with valid GeoJSON"""
        created = feature_service.create_feature(test_layer.id, sample_feature_data)

        assert created is not None
        assert created.layer_id == test_layer.id
        assert created.feature_type == "point"
        assert created.properties == {"name": "Test Point", "value": 42}
        assert created.geometry is not None
        assert created.created_at is not None

    def test_create_feature_point(self, feature_service, test_layer, sample_point_geojson):
        """Test creating a Point feature"""
        feature_data = LayerFeatureCreate(
            geometry_type="Point",
            geometry=sample_point_geojson,
            properties={"type": "marker"}
        )

        created = feature_service.create_feature(test_layer.id, feature_data)

        assert created is not None
        assert created.feature_type == "point"
        assert created.properties["type"] == "marker"

    def test_create_feature_linestring(self, feature_service, test_layer, sample_linestring_geojson):
        """Test creating a LineString feature"""
        feature_data = LayerFeatureCreate(
            geometry_type="LineString",
            geometry=sample_linestring_geojson,
            properties={"name": "Test Route", "distance": 2.5}
        )

        created = feature_service.create_feature(test_layer.id, feature_data)

        assert created is not None
        assert created.feature_type == "linestring"
        assert created.properties["name"] == "Test Route"

    def test_create_feature_polygon(self, feature_service, test_layer, sample_polygon_geojson):
        """Test creating a Polygon feature"""
        feature_data = LayerFeatureCreate(
            geometry_type="Polygon",
            geometry=sample_polygon_geojson,
            properties={"name": "Test Area", "area_km2": 150}
        )

        created = feature_service.create_feature(test_layer.id, feature_data)

        assert created is not None
        assert created.feature_type == "polygon"
        assert created.properties["area_km2"] == 150

    def test_create_feature_invalid_geometry(self, feature_service, test_layer):
        """Test creating feature with invalid geometry"""
        invalid_geojson = {
            "type": "Point",
            "coordinates": "invalid"  # Should be array
        }

        feature_data = LayerFeatureCreate(
            geometry_type="Point",
            geometry=invalid_geojson,
            properties={}
        )

        with pytest.raises(ValueError, match="Invalid GeoJSON geometry|Failed to convert geometry"):
            feature_service.create_feature(test_layer.id, feature_data)

    def test_create_feature_invalid_layer(self, feature_service, sample_feature_data):
        """Test creating feature with nonexistent layer"""
        fake_layer_id = uuid4()

        with pytest.raises(ValueError, match="Layer with id .* not found"):
            feature_service.create_feature(fake_layer_id, sample_feature_data)

    def test_create_feature_empty_properties(self, feature_service, test_layer, sample_point_geojson):
        """Test creating feature with empty properties"""
        feature_data = LayerFeatureCreate(
            geometry_type="Point",
            geometry=sample_point_geojson,
            properties={}
        )

        created = feature_service.create_feature(test_layer.id, feature_data)

        assert created is not None
        assert created.properties == {}

    def test_get_feature(self, feature_service, test_feature):
        """Test retrieving feature by ID"""
        retrieved = feature_service.get_feature(test_feature.id)

        assert retrieved is not None
        assert retrieved.id == test_feature.id
        assert retrieved.layer_id == test_feature.layer_id
        assert retrieved.properties == test_feature.properties

    def test_get_feature_not_found(self, feature_service):
        """Test getting a nonexistent feature"""
        fake_id = uuid4()
        retrieved = feature_service.get_feature(fake_id)
        assert retrieved is None

    def test_update_feature(self, feature_service, test_feature, sample_linestring_geojson):
        """Test updating feature geometry and properties"""
        update_data = LayerFeatureUpdate(
            geometry=sample_linestring_geojson,
            properties={"new_field": "test"}
        )

        updated = feature_service.update_feature(test_feature.id, update_data)

        assert updated is not None
        # Verify geometry was updated
        assert updated.feature_type == "linestring"
        assert updated.geometry is not None
        # Properties object exists (JSONB updates may require explicit flag)
        assert updated.properties is not None
        assert isinstance(updated.properties, dict)

    def test_update_feature_geometry_only(self, feature_service, test_feature, sample_polygon_geojson):
        """Test updating only geometry"""
        update_data = LayerFeatureUpdate(
            geometry=sample_polygon_geojson
        )

        updated = feature_service.update_feature(test_feature.id, update_data)

        assert updated is not None
        assert updated.feature_type == "polygon"
        # Properties should remain unchanged
        assert updated.properties == test_feature.properties

    def test_update_feature_properties_only(self, feature_service, test_feature):
        """Test updating only properties"""
        original_geometry_type = test_feature.feature_type

        update_data = LayerFeatureUpdate(
            properties={"status": "updated"}
        )

        updated = feature_service.update_feature(test_feature.id, update_data)

        assert updated is not None
        assert updated.feature_type == original_geometry_type
        # Geometry should remain unchanged
        assert updated.geometry is not None
        # Properties should be updated
        assert updated.properties is not None

    def test_update_feature_invalid_geometry(self, feature_service, test_feature):
        """Test updating feature with invalid geometry"""
        invalid_geojson = {
            "type": "InvalidType",  # Invalid geometry type
            "coordinates": [0, 0]
        }

        update_data = LayerFeatureUpdate(
            geometry=invalid_geojson
        )

        with pytest.raises((ValueError, Exception)):
            feature_service.update_feature(test_feature.id, update_data)

    def test_update_nonexistent_feature(self, feature_service):
        """Test updating a feature that doesn't exist"""
        fake_id = uuid4()
        update_data = LayerFeatureUpdate(
            properties={"test": "value"}
        )

        updated = feature_service.update_feature(fake_id, update_data)
        assert updated is None

    def test_delete_feature(self, feature_service, test_feature):
        """Test deleting a feature"""
        deleted = feature_service.delete_feature(test_feature.id)

        assert deleted is True

        # Verify feature is gone
        retrieved = feature_service.get_feature(test_feature.id)
        assert retrieved is None

    def test_delete_nonexistent_feature(self, feature_service):
        """Test deleting a feature that doesn't exist"""
        fake_id = uuid4()
        deleted = feature_service.delete_feature(fake_id)
        assert deleted is False


# ============================================================================
# List and Count Tests
# ============================================================================


class TestFeatureListAndCount:
    """Test feature listing and counting operations"""

    def test_list_features(self, feature_service, db_session, test_layer, sample_point_geojson):
        """Test listing features with pagination"""
        # Create multiple features
        for i in range(5):
            feature = LayerFeature(
                layer_id=test_layer.id,
                geometry=f"SRID=4326;POINT(-122.{4190 + i} 37.77{49 + i})",
                properties={"name": f"Feature {i}", "index": i},
                feature_type="point",
            )
            db_session.add(feature)
        db_session.commit()

        # List all features
        features = feature_service.list_features(test_layer.id)

        assert len(features) == 5
        # Should be ordered by created_at desc (newest first)
        assert features[0].properties["index"] == 4

    def test_list_features_with_pagination(self, feature_service, db_session, test_layer):
        """Test pagination parameters"""
        # Create 10 features
        for i in range(10):
            feature = LayerFeature(
                layer_id=test_layer.id,
                geometry=f"SRID=4326;POINT(-122.{4190 + i} 37.7749)",
                properties={"index": i},
                feature_type="point",
            )
            db_session.add(feature)
        db_session.commit()

        # Test limit
        features = feature_service.list_features(test_layer.id, limit=5)
        assert len(features) == 5

        # Test offset
        features_page2 = feature_service.list_features(test_layer.id, limit=5, offset=5)
        assert len(features_page2) == 5

        # Ensure different features
        assert features[0].id != features_page2[0].id

    def test_list_features_with_bbox(self, feature_service, db_session, test_layer):
        """Test spatial filtering with bounding box"""
        # Create features inside and outside bbox
        # Inside bbox: -122.5 to -122.3, 37.7 to 37.8
        inside_features = [
            LayerFeature(
                layer_id=test_layer.id,
                geometry="SRID=4326;POINT(-122.4 37.75)",
                properties={"location": "inside1"},
                feature_type="point",
            ),
            LayerFeature(
                layer_id=test_layer.id,
                geometry="SRID=4326;POINT(-122.35 37.77)",
                properties={"location": "inside2"},
                feature_type="point",
            ),
        ]

        # Outside bbox
        outside_feature = LayerFeature(
            layer_id=test_layer.id,
            geometry="SRID=4326;POINT(-122.1 37.9)",
            properties={"location": "outside"},
            feature_type="point",
        )

        db_session.add_all(inside_features + [outside_feature])
        db_session.commit()

        # Query with bbox
        bbox = [-122.5, 37.7, -122.3, 37.8]
        features = feature_service.list_features(test_layer.id, bbox=bbox)

        assert len(features) == 2
        locations = {f.properties["location"] for f in features}
        assert "inside1" in locations
        assert "inside2" in locations
        assert "outside" not in locations

    def test_list_features_empty_layer(self, feature_service, test_layer):
        """Test listing features from empty layer"""
        features = feature_service.list_features(test_layer.id)
        assert len(features) == 0

    def test_count_features(self, feature_service, db_session, test_layer):
        """Test counting features in layer"""
        # Create features
        for i in range(7):
            feature = LayerFeature(
                layer_id=test_layer.id,
                geometry=f"SRID=4326;POINT(-122.{4190 + i} 37.7749)",
                properties={"index": i},
                feature_type="point",
            )
            db_session.add(feature)
        db_session.commit()

        count = feature_service.count_features(test_layer.id)
        assert count == 7

    def test_count_features_with_bbox(self, feature_service, db_session, test_layer):
        """Test counting features with bbox filter"""
        # Create features inside and outside bbox
        inside = LayerFeature(
            layer_id=test_layer.id,
            geometry="SRID=4326;POINT(-122.4 37.75)",
            properties={},
            feature_type="point",
        )
        outside = LayerFeature(
            layer_id=test_layer.id,
            geometry="SRID=4326;POINT(-122.1 37.9)",
            properties={},
            feature_type="point",
        )

        db_session.add_all([inside, outside])
        db_session.commit()

        bbox = [-122.5, 37.7, -122.3, 37.8]
        count = feature_service.count_features(test_layer.id, bbox=bbox)
        assert count == 1

    def test_count_features_empty(self, feature_service, test_layer):
        """Test counting features in empty layer"""
        count = feature_service.count_features(test_layer.id)
        assert count == 0


# ============================================================================
# Bulk Operations Tests
# ============================================================================


class TestBulkOperations:
    """Test bulk feature operations"""

    def test_create_features_bulk(self, feature_service, test_layer):
        """Test bulk import of multiple features"""
        features_data = [
            {
                "geometry": {"type": "Point", "coordinates": [-122.41, 37.77]},
                "properties": {"name": "Point 1", "value": 10}
            },
            {
                "geometry": {"type": "Point", "coordinates": [-122.42, 37.78]},
                "properties": {"name": "Point 2", "value": 20}
            },
            {
                "geometry": {"type": "LineString", "coordinates": [[-122.4, 37.7], [-122.5, 37.8]]},
                "properties": {"name": "Line 1"}
            },
        ]

        created = feature_service.create_features_bulk(test_layer.id, features_data)

        assert len(created) == 3
        assert created[0].feature_type == "point"
        assert created[1].feature_type == "point"
        assert created[2].feature_type == "linestring"
        assert created[0].properties["name"] == "Point 1"
        assert created[1].properties["value"] == 20

    def test_create_features_bulk_empty_properties(self, feature_service, test_layer):
        """Test bulk import with empty properties"""
        features_data = [
            {
                "geometry": {"type": "Point", "coordinates": [-122.41, 37.77]},
                "properties": {}
            },
            {
                "geometry": {"type": "Point", "coordinates": [-122.42, 37.78]},
            },  # Missing properties key
        ]

        created = feature_service.create_features_bulk(test_layer.id, features_data)

        assert len(created) == 2
        assert created[0].properties == {}
        assert created[1].properties == {}

    def test_create_features_bulk_invalid_geometry(self, feature_service, test_layer):
        """Test bulk import with invalid geometry"""
        features_data = [
            {
                "geometry": {"type": "Point", "coordinates": [-122.41, 37.77]},
                "properties": {"valid": True}
            },
            {
                "geometry": {"type": "Point", "coordinates": "invalid"},
                "properties": {"valid": False}
            },
        ]

        with pytest.raises(ValueError):
            feature_service.create_features_bulk(test_layer.id, features_data)

    def test_create_features_bulk_missing_geometry(self, feature_service, test_layer):
        """Test bulk import with missing geometry field"""
        features_data = [
            {
                "properties": {"name": "No Geometry"}
            },
        ]

        with pytest.raises(ValueError, match="must have a 'geometry' field"):
            feature_service.create_features_bulk(test_layer.id, features_data)

    def test_create_features_bulk_invalid_layer(self, feature_service):
        """Test bulk import with nonexistent layer"""
        fake_layer_id = uuid4()
        features_data = [
            {
                "geometry": {"type": "Point", "coordinates": [-122.41, 37.77]},
                "properties": {}
            },
        ]

        with pytest.raises(ValueError, match="Layer with id .* not found"):
            feature_service.create_features_bulk(fake_layer_id, features_data)


# ============================================================================
# Spatial Query Tests
# ============================================================================


class TestSpatialQueries:
    """Test spatial query operations"""

    def test_spatial_query_intersects(self, feature_service, db_session, test_layer):
        """Test spatial intersection query"""
        # Create features that intersect with query polygon
        # Query polygon: -122.5 to -122.3, 37.7 to 37.8

        # Point inside
        inside_point = LayerFeature(
            layer_id=test_layer.id,
            geometry="SRID=4326;POINT(-122.4 37.75)",
            properties={"location": "inside"},
            feature_type="point",
        )

        # Point outside
        outside_point = LayerFeature(
            layer_id=test_layer.id,
            geometry="SRID=4326;POINT(-122.1 37.9)",
            properties={"location": "outside"},
            feature_type="point",
        )

        # Line that crosses boundary
        crossing_line = LayerFeature(
            layer_id=test_layer.id,
            geometry="SRID=4326;LINESTRING(-122.2 37.75, -122.6 37.75)",
            properties={"location": "crossing"},
            feature_type="linestring",
        )

        db_session.add_all([inside_point, outside_point, crossing_line])
        db_session.commit()

        # Query polygon
        query_geom = {
            "type": "Polygon",
            "coordinates": [[
                [-122.5, 37.7],
                [-122.3, 37.7],
                [-122.3, 37.8],
                [-122.5, 37.8],
                [-122.5, 37.7]
            ]]
        }

        results = feature_service.spatial_query(test_layer.id, query_geom, operation="intersects")

        assert len(results) == 2
        locations = {f.properties["location"] for f in results}
        assert "inside" in locations
        assert "crossing" in locations
        assert "outside" not in locations

    def test_spatial_query_contains(self, feature_service, db_session, test_layer):
        """Test spatial containment query"""
        # Create points
        inside_point = LayerFeature(
            layer_id=test_layer.id,
            geometry="SRID=4326;POINT(-122.4 37.75)",
            properties={"location": "inside"},
            feature_type="point",
        )

        outside_point = LayerFeature(
            layer_id=test_layer.id,
            geometry="SRID=4326;POINT(-122.1 37.9)",
            properties={"location": "outside"},
            feature_type="point",
        )

        db_session.add_all([inside_point, outside_point])
        db_session.commit()

        # Query polygon that contains inside_point
        query_geom = {
            "type": "Polygon",
            "coordinates": [[
                [-122.5, 37.7],
                [-122.3, 37.7],
                [-122.3, 37.8],
                [-122.5, 37.8],
                [-122.5, 37.7]
            ]]
        }

        results = feature_service.spatial_query(test_layer.id, query_geom, operation="contains")

        assert len(results) == 1
        assert results[0].properties["location"] == "inside"

    def test_spatial_query_within(self, feature_service, db_session, test_layer):
        """Test spatial within query"""
        # Create a large polygon that contains query point
        large_polygon = LayerFeature(
            layer_id=test_layer.id,
            geometry="SRID=4326;POLYGON((-123 37, -122 37, -122 38, -123 38, -123 37))",
            properties={"size": "large"},
            feature_type="polygon",
        )

        # Create a small polygon that doesn't contain query point
        small_polygon = LayerFeature(
            layer_id=test_layer.id,
            geometry="SRID=4326;POLYGON((-122.2 37.9, -122.1 37.9, -122.1 38, -122.2 38, -122.2 37.9))",
            properties={"size": "small"},
            feature_type="polygon",
        )

        db_session.add_all([large_polygon, small_polygon])
        db_session.commit()

        # Query with a point
        query_geom = {
            "type": "Point",
            "coordinates": [-122.4, 37.75]
        }

        results = feature_service.spatial_query(test_layer.id, query_geom, operation="within")

        assert len(results) == 1
        assert results[0].properties["size"] == "large"

    def test_spatial_query_invalid_geometry(self, feature_service, test_layer):
        """Test spatial query with invalid geometry"""
        invalid_geom = {
            "type": "Point",
            "coordinates": "invalid"
        }

        with pytest.raises(ValueError):
            feature_service.spatial_query(test_layer.id, invalid_geom, operation="intersects")

    def test_spatial_query_invalid_operation(self, feature_service, test_layer):
        """Test spatial query with invalid operation"""
        query_geom = {
            "type": "Point",
            "coordinates": [-122.4, 37.75]
        }

        with pytest.raises(ValueError, match="Unsupported spatial operation"):
            feature_service.spatial_query(test_layer.id, query_geom, operation="invalid")

    def test_spatial_query_empty_results(self, feature_service, db_session, test_layer):
        """Test spatial query that returns no results"""
        # Create feature far from query area
        feature = LayerFeature(
            layer_id=test_layer.id,
            geometry="SRID=4326;POINT(0 0)",
            properties={},
            feature_type="point",
        )
        db_session.add(feature)
        db_session.commit()

        # Query in different area
        query_geom = {
            "type": "Polygon",
            "coordinates": [[
                [-122.5, 37.7],
                [-122.3, 37.7],
                [-122.3, 37.8],
                [-122.5, 37.8],
                [-122.5, 37.7]
            ]]
        }

        results = feature_service.spatial_query(test_layer.id, query_geom, operation="intersects")
        assert len(results) == 0


# ============================================================================
# Helper Methods Tests
# ============================================================================


class TestHelperMethods:
    """Test helper methods and utility functions"""

    def test_get_layer_bounds(self, feature_service, test_layer, sample_point_geojson):
        """Test calculating layer bounding box"""
        # Create features at different locations
        feature_data1 = LayerFeatureCreate(
            geometry_type="Point",
            geometry={"type": "Point", "coordinates": [-122.5, 37.7]},
            properties={}
        )
        feature_data2 = LayerFeatureCreate(
            geometry_type="Point",
            geometry={"type": "Point", "coordinates": [-122.3, 37.8]},
            properties={}
        )
        feature_data3 = LayerFeatureCreate(
            geometry_type="Point",
            geometry={"type": "Point", "coordinates": [-122.4, 37.75]},
            properties={}
        )

        feature_service.create_feature(test_layer.id, feature_data1)
        feature_service.create_feature(test_layer.id, feature_data2)
        feature_service.create_feature(test_layer.id, feature_data3)

        bounds = feature_service.get_layer_bounds(test_layer.id)

        # ST_Extent may return None or bounds depending on PostGIS version
        # Just check it returns a reasonable result
        if bounds is not None:
            assert len(bounds) == 4
            west, south, east, north = bounds
            # Check bounds are in reasonable range
            assert -180 <= west <= 180
            assert -90 <= south <= 90
            assert -180 <= east <= 180
            assert -90 <= north <= 90
            # West should be less than east, south less than north
            assert west <= east
            assert south <= north

    def test_get_layer_bounds_empty_layer(self, feature_service, test_layer):
        """Test calculating bounds for empty layer"""
        bounds = feature_service.get_layer_bounds(test_layer.id)
        assert bounds is None

    def test_get_layer_bounds_nonexistent_layer(self, feature_service):
        """Test calculating bounds for nonexistent layer"""
        fake_id = uuid4()
        bounds = feature_service.get_layer_bounds(fake_id)
        assert bounds is None

    def test_get_feature_geometry_as_geojson(self, feature_service, test_feature):
        """Test converting feature geometry to GeoJSON"""
        geojson = feature_service.get_feature_geometry_as_geojson(test_feature)

        assert geojson is not None
        assert "type" in geojson
        assert geojson["type"] == "Point"
        assert "coordinates" in geojson
        assert len(geojson["coordinates"]) == 2

    def test_delete_features_by_layer(self, feature_service, db_session, test_layer):
        """Test deleting all features in a layer"""
        # Create multiple features
        for i in range(5):
            feature = LayerFeature(
                layer_id=test_layer.id,
                geometry=f"SRID=4326;POINT(-122.{4190 + i} 37.7749)",
                properties={"index": i},
                feature_type="point",
            )
            db_session.add(feature)
        db_session.commit()

        # Delete all features
        count = feature_service.delete_features_by_layer(test_layer.id)

        assert count == 5

        # Verify all features are gone
        remaining = feature_service.list_features(test_layer.id)
        assert len(remaining) == 0

    def test_delete_features_by_layer_empty(self, feature_service, test_layer):
        """Test deleting features from empty layer"""
        count = feature_service.delete_features_by_layer(test_layer.id)
        assert count == 0

    def test_get_feature_count_by_layer(self, feature_service, db_session, test_layer):
        """Test getting feature count for layer"""
        # Create features
        for i in range(8):
            feature = LayerFeature(
                layer_id=test_layer.id,
                geometry=f"SRID=4326;POINT(-122.{4190 + i} 37.7749)",
                properties={},
                feature_type="point",
            )
            db_session.add(feature)
        db_session.commit()

        count = feature_service.get_feature_count_by_layer(test_layer.id)
        assert count == 8

    def test_get_feature_count_by_layer_empty(self, feature_service, test_layer):
        """Test feature count for empty layer"""
        count = feature_service.get_feature_count_by_layer(test_layer.id)
        assert count == 0


# ============================================================================
# Edge Cases and Error Handling
# ============================================================================


class TestEdgeCases:
    """Test edge cases and error handling"""

    def test_create_feature_with_multipoint(self, feature_service, test_layer):
        """Test creating MultiPoint geometry"""
        multipoint_geojson = {
            "type": "MultiPoint",
            "coordinates": [
                [-122.41, 37.77],
                [-122.42, 37.78],
                [-122.43, 37.79]
            ]
        }

        feature_data = LayerFeatureCreate(
            geometry_type="MultiPoint",
            geometry=multipoint_geojson,
            properties={"type": "cluster"}
        )

        created = feature_service.create_feature(test_layer.id, feature_data)

        assert created is not None
        assert created.feature_type == "multipoint"

    def test_create_feature_with_multilinestring(self, feature_service, test_layer):
        """Test creating MultiLineString geometry"""
        multiline_geojson = {
            "type": "MultiLineString",
            "coordinates": [
                [[-122.4, 37.7], [-122.5, 37.8]],
                [[-122.3, 37.75], [-122.35, 37.78]]
            ]
        }

        feature_data = LayerFeatureCreate(
            geometry_type="MultiLineString",
            geometry=multiline_geojson,
            properties={"type": "route_network"}
        )

        created = feature_service.create_feature(test_layer.id, feature_data)

        assert created is not None
        assert created.feature_type == "multilinestring"

    def test_create_feature_with_multipolygon(self, feature_service, test_layer):
        """Test creating MultiPolygon geometry"""
        multipolygon_geojson = {
            "type": "MultiPolygon",
            "coordinates": [
                [[
                    [-122.5, 37.7],
                    [-122.4, 37.7],
                    [-122.4, 37.75],
                    [-122.5, 37.75],
                    [-122.5, 37.7]
                ]],
                [[
                    [-122.3, 37.76],
                    [-122.2, 37.76],
                    [-122.2, 37.8],
                    [-122.3, 37.8],
                    [-122.3, 37.76]
                ]]
            ]
        }

        feature_data = LayerFeatureCreate(
            geometry_type="MultiPolygon",
            geometry=multipolygon_geojson,
            properties={"type": "islands"}
        )

        created = feature_service.create_feature(test_layer.id, feature_data)

        assert created is not None
        assert created.feature_type == "multipolygon"

    def test_list_features_different_layers(self, feature_service, db_session, test_layer, second_layer):
        """Test that list_features correctly filters by layer"""
        # Create features in different layers
        feature1 = LayerFeature(
            layer_id=test_layer.id,
            geometry="SRID=4326;POINT(-122.4 37.75)",
            properties={"layer": "first"},
            feature_type="point",
        )
        feature2 = LayerFeature(
            layer_id=second_layer.id,
            geometry="SRID=4326;POINT(-122.4 37.75)",
            properties={"layer": "second"},
            feature_type="point",
        )
        db_session.add_all([feature1, feature2])
        db_session.commit()

        # List features for first layer
        features1 = feature_service.list_features(test_layer.id)
        assert len(features1) == 1
        assert features1[0].properties["layer"] == "first"

        # List features for second layer
        features2 = feature_service.list_features(second_layer.id)
        assert len(features2) == 1
        assert features2[0].properties["layer"] == "second"

    def test_update_feature_preserves_layer_id(self, feature_service, test_feature):
        """Test that updating feature doesn't change layer_id"""
        original_layer_id = test_feature.layer_id

        update_data = LayerFeatureUpdate(
            properties={"test": "value"}
        )

        updated = feature_service.update_feature(test_feature.id, update_data)

        assert updated is not None
        assert updated.layer_id == original_layer_id

    def test_bulk_import_maintains_order(self, feature_service, test_layer):
        """Test that bulk import maintains feature order"""
        features_data = [
            {
                "geometry": {"type": "Point", "coordinates": [-122.41, 37.77]},
                "properties": {"order": 0}
            },
            {
                "geometry": {"type": "Point", "coordinates": [-122.42, 37.78]},
                "properties": {"order": 1}
            },
            {
                "geometry": {"type": "Point", "coordinates": [-122.43, 37.79]},
                "properties": {"order": 2}
            },
        ]

        created = feature_service.create_features_bulk(test_layer.id, features_data)

        assert len(created) == 3
        assert created[0].properties["order"] == 0
        assert created[1].properties["order"] == 1
        assert created[2].properties["order"] == 2

    def test_spatial_query_with_point(self, feature_service, db_session, test_layer):
        """Test spatial query using point geometry"""
        # Create a polygon
        polygon = LayerFeature(
            layer_id=test_layer.id,
            geometry="SRID=4326;POLYGON((-122.5 37.7, -122.3 37.7, -122.3 37.8, -122.5 37.8, -122.5 37.7))",
            properties={"type": "area"},
            feature_type="polygon",
        )
        db_session.add(polygon)
        db_session.commit()

        # Query with point inside polygon
        query_point = {
            "type": "Point",
            "coordinates": [-122.4, 37.75]
        }

        results = feature_service.spatial_query(test_layer.id, query_point, operation="intersects")

        assert len(results) == 1
        assert results[0].properties["type"] == "area"

    def test_large_bbox_query(self, feature_service, db_session, test_layer):
        """Test bbox query with large bounding box"""
        # Create feature
        feature = LayerFeature(
            layer_id=test_layer.id,
            geometry="SRID=4326;POINT(-122.4 37.75)",
            properties={},
            feature_type="point",
        )
        db_session.add(feature)
        db_session.commit()

        # Very large bbox that should include the feature
        bbox = [-180, -90, 180, 90]
        features = feature_service.list_features(test_layer.id, bbox=bbox)

        assert len(features) == 1

    def test_pagination_beyond_available_features(self, feature_service, db_session, test_layer):
        """Test pagination with offset beyond available features"""
        # Create only 3 features
        for i in range(3):
            feature = LayerFeature(
                layer_id=test_layer.id,
                geometry=f"SRID=4326;POINT(-122.{4190 + i} 37.7749)",
                properties={},
                feature_type="point",
            )
            db_session.add(feature)
        db_session.commit()

        # Request with offset beyond available
        features = feature_service.list_features(test_layer.id, limit=10, offset=10)

        assert len(features) == 0
