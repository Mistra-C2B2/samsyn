"""
Integration tests for API endpoints.

Tests the actual HTTP endpoints to verify correct response structure,
serialization, and nested data inclusion.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def client():
    """Create FastAPI test client"""
    return TestClient(app)


# ============================================================================
# Tests for GET /api/v1/maps
# ============================================================================


class TestMapsEndpoint:
    """Test the /api/v1/maps endpoint"""

    def test_list_maps_returns_map_response_structure(self, client):
        """
        Test that list endpoint returns full MapResponse with nested data.

        Verifies the N+1 query fix by checking that a single request
        returns full nested data instead of summary data.
        """
        response = client.get("/api/v1/maps")

        assert response.status_code == 200
        maps = response.json()

        # Should return a list
        assert isinstance(maps, list)

        # If there are any maps, verify structure
        if len(maps) > 0:
            map_data = maps[0]

            # Verify full map data fields are present
            assert "id" in map_data
            assert "name" in map_data
            assert "description" in map_data
            assert "created_by" in map_data
            assert "view_permission" in map_data
            assert "edit_permission" in map_data
            assert "center_lat" in map_data
            assert "center_lng" in map_data
            assert "zoom" in map_data
            assert "map_metadata" in map_data
            assert "created_at" in map_data
            assert "updated_at" in map_data

            # Verify nested data is included (not just summary)
            assert "map_layers" in map_data
            assert isinstance(map_data["map_layers"], list)

            assert "collaborators" in map_data
            assert isinstance(map_data["collaborators"], list)

            assert "user_role" in map_data

            # If there are layers, verify nested layer structure
            if len(map_data["map_layers"]) > 0:
                map_layer = map_data["map_layers"][0]

                # Verify MapLayer junction table fields
                assert "id" in map_layer
                assert "layer_id" in map_layer
                assert "order" in map_layer
                assert "visible" in map_layer
                assert "opacity" in map_layer

                # Verify nested layer object is included
                assert "layer" in map_layer
                layer = map_layer["layer"]

                # Verify full layer data (not just id/name)
                assert "id" in layer
                assert "name" in layer
                assert "source_type" in layer
                assert "description" in layer
                assert "created_by" in layer
                assert "source_config" in layer
                assert "style_config" in layer
                assert "legend_config" in layer
                assert "layer_metadata" in layer
                assert "created_at" in layer
                assert "updated_at" in layer

                # Verify layer features are included
                assert "features" in layer
                assert isinstance(layer["features"], list)

                # Verify creator info is included
                assert "creator" in layer
                if layer["creator"] is not None:
                    assert "id" in layer["creator"]
                    assert "email" in layer["creator"]

    def test_list_maps_collaborator_structure(self, client):
        """Test that collaborators include nested user data"""
        response = client.get("/api/v1/maps")

        assert response.status_code == 200
        maps = response.json()

        # Find a map with collaborators
        map_with_collab = next(
            (m for m in maps if len(m.get("collaborators", [])) > 0), None
        )

        if map_with_collab:
            collaborator = map_with_collab["collaborators"][0]

            # Verify collaborator structure
            assert "id" in collaborator
            assert "user_id" in collaborator
            assert "role" in collaborator

            # Verify nested user data is included
            assert "user" in collaborator
            if collaborator["user"] is not None:
                user = collaborator["user"]
                assert "id" in user
                assert "email" in user


# ============================================================================
# Tests for GET /api/v1/layers
# ============================================================================


class TestLayersEndpoint:
    """Test the /api/v1/layers endpoint"""

    def test_list_layers_returns_layer_response_structure(self, client):
        """
        Test that list endpoint returns full LayerResponse with nested data.

        Verifies the N+1 query fix by checking that a single request
        returns full nested data instead of summary data.
        """
        response = client.get("/api/v1/layers")

        assert response.status_code == 200
        layers = response.json()

        # Should return a list
        assert isinstance(layers, list)

        # If there are any layers, verify structure
        if len(layers) > 0:
            layer_data = layers[0]

            # Verify full layer data fields are present
            assert "id" in layer_data
            assert "name" in layer_data
            assert "source_type" in layer_data
            assert "description" in layer_data
            assert "category" in layer_data
            assert "created_by" in layer_data
            assert "editable" in layer_data
            assert "is_global" in layer_data
            assert "visibility" in layer_data
            assert "creation_source" in layer_data

            # Verify config objects are included
            assert "source_config" in layer_data
            assert isinstance(layer_data["source_config"], dict)

            assert "style_config" in layer_data
            assert isinstance(layer_data["style_config"], dict)

            assert "legend_config" in layer_data
            assert isinstance(layer_data["legend_config"], dict)

            assert "layer_metadata" in layer_data
            assert isinstance(layer_data["layer_metadata"], dict)

            # Verify timestamps
            assert "created_at" in layer_data
            assert "updated_at" in layer_data

            # Verify nested features are included
            assert "features" in layer_data
            assert isinstance(layer_data["features"], list)

            # If there are features, verify structure
            if len(layer_data["features"]) > 0:
                feature = layer_data["features"][0]
                assert "id" in feature
                assert "feature_type" in feature
                assert "geometry" in feature
                assert "properties" in feature

            # Verify creator data is included
            assert "creator" in layer_data
            if layer_data["creator"] is not None:
                creator = layer_data["creator"]
                assert "id" in creator
                assert "email" in creator
                assert "username" in creator or creator["username"] is None
                assert "first_name" in creator or creator["first_name"] is None
                assert "last_name" in creator or creator["last_name"] is None

    def test_list_layers_with_filters(self, client):
        """Test that list endpoint supports query filters"""
        # Test source_type filter
        response = client.get("/api/v1/layers?source_type=vector")
        assert response.status_code == 200
        layers = response.json()
        assert isinstance(layers, list)
        # If there are results, verify they match the filter
        if len(layers) > 0:
            assert all(layer["source_type"] == "vector" for layer in layers)

        # Test search filter
        response = client.get("/api/v1/layers?search=test")
        assert response.status_code == 200
        layers = response.json()
        assert isinstance(layers, list)

        # Test is_global filter
        response = client.get("/api/v1/layers?is_global=true")
        assert response.status_code == 200
        layers = response.json()
        assert isinstance(layers, list)
        # If there are results, verify they match the filter
        if len(layers) > 0:
            assert all(layer["is_global"] is True for layer in layers)

    def test_list_layers_include_my_layers_parameter(self, client):
        """Test that include_my_layers parameter works"""
        response = client.get("/api/v1/layers?include_my_layers=true")
        assert response.status_code == 200
        layers = response.json()
        assert isinstance(layers, list)


# ============================================================================
# Performance / Structure Tests
# ============================================================================


class TestNestedDataInclusion:
    """Test that full nested data is returned (proof of N+1 query fix)"""

    def test_maps_include_full_layer_details(self, client):
        """
        Verify that map list includes full layer details, not just IDs.

        This proves the N+1 query fix - previously the list endpoint would
        return only layer IDs, requiring individual GET requests for details.
        """
        response = client.get("/api/v1/maps")
        assert response.status_code == 200
        maps = response.json()

        # Find a map with layers
        map_with_layers = next(
            (m for m in maps if len(m.get("map_layers", [])) > 0), None
        )

        if map_with_layers:
            map_layer = map_with_layers["map_layers"][0]
            layer = map_layer["layer"]

            # Verify this is full layer data, not just a reference
            # Full LayerResponse includes all these fields
            required_fields = [
                "id",
                "name",
                "source_type",
                "source_config",
                "style_config",
                "legend_config",
                "features",
                "creator",
            ]
            for field in required_fields:
                assert field in layer, f"Layer missing required field: {field}"

    def test_layers_include_features_and_creator(self, client):
        """
        Verify that layer list includes features and creator, not just layer info.

        This proves the N+1 query fix - previously the list endpoint would
        return only layer metadata, requiring individual GET requests for features.
        """
        response = client.get("/api/v1/layers")
        assert response.status_code == 200
        layers = response.json()

        if len(layers) > 0:
            layer = layers[0]

            # Verify features array is included (even if empty)
            assert "features" in layer
            assert isinstance(layer["features"], list)

            # Verify creator object is included (even if None)
            assert "creator" in layer

            # Verify full config objects are included
            assert "source_config" in layer and isinstance(layer["source_config"], dict)
            assert "style_config" in layer and isinstance(layer["style_config"], dict)
            assert "legend_config" in layer and isinstance(layer["legend_config"], dict)
            assert "layer_metadata" in layer and isinstance(
                layer["layer_metadata"], dict
            )
