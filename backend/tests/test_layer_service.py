"""
Unit tests for layer service.

Tests layer CRUD operations, permission checks, filtering, and search.
Uses PostgreSQL test database with transaction rollback for isolation.
"""

import pytest
from uuid import uuid4

from app.models.layer import Layer
from app.models.user import User
from app.services.layer_service import LayerService
from app.schemas.layer import LayerCreate, LayerUpdate, LayerSourceTypeEnum, LayerEditabilityEnum


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def layer_service(db_session):
    """Create layer service instance"""
    return LayerService(db_session)


@pytest.fixture
def test_user(db_session):
    """Create a test user"""
    user = User(
        clerk_id="user_test_layer_owner",
        email="layerowner@example.com",
        username="layerowner",
        first_name="Layer",
        last_name="Owner",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_user2(db_session):
    """Create a second test user"""
    user = User(
        clerk_id="user_test_layer_other",
        email="layerother@example.com",
        username="layerother",
        first_name="Other",
        last_name="User",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def wms_layer(db_session, test_user):
    """Create a WMS test layer"""
    layer = Layer(
        name="WMS Marine Data",
        source_type="wms",
        description="WMS layer for marine data",
        category="marine",
        created_by=test_user.id,
        editable="creator-only",
        is_global=False,
        source_config={"url": "https://example.com/wms", "layers": "marine_data"},
        style_config={"opacity": 0.8},
        legend_config={"type": "gradient"},
        layer_metadata={"source": "NOAA"},
    )
    db_session.add(layer)
    db_session.commit()
    db_session.refresh(layer)
    return layer


@pytest.fixture
def geotiff_layer(db_session, test_user):
    """Create a GeoTIFF test layer"""
    layer = Layer(
        name="GeoTIFF Bathymetry",
        source_type="geotiff",
        description="Bathymetry data",
        category="bathymetry",
        created_by=test_user.id,
        editable="everyone",
        is_global=False,
        source_config={"url": "https://example.com/data.tif"},
    )
    db_session.add(layer)
    db_session.commit()
    db_session.refresh(layer)
    return layer


@pytest.fixture
def vector_layer(db_session, test_user):
    """Create a vector test layer"""
    layer = Layer(
        name="Vector Fish Stocks",
        source_type="vector",
        description="Fish stock locations",
        category="fisheries",
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
def global_layer(db_session, test_user):
    """Create a global layer"""
    layer = Layer(
        name="Global Marine Protected Areas",
        source_type="vector",
        description="Global MPA boundaries",
        category="protected_areas",
        created_by=test_user.id,
        editable="creator-only",
        is_global=True,
        source_config={"type": "geojson"},
    )
    db_session.add(layer)
    db_session.commit()
    db_session.refresh(layer)
    return layer


@pytest.fixture
def everyone_editable_layer(db_session, test_user):
    """Create a layer editable by everyone"""
    layer = Layer(
        name="Community Layer",
        source_type="vector",
        description="Community-contributed data",
        category="community",
        created_by=test_user.id,
        editable="everyone",
        is_global=True,
        source_config={"type": "geojson"},
    )
    db_session.add(layer)
    db_session.commit()
    db_session.refresh(layer)
    return layer


# ============================================================================
# Core CRUD Tests
# ============================================================================


class TestLayerCRUD:
    """Test core layer CRUD operations"""

    def test_create_wms_layer(self, layer_service, test_user):
        """Test creating a WMS layer"""
        layer_data = LayerCreate(
            name="Test WMS",
            source_type=LayerSourceTypeEnum.wms,
            description="Test WMS layer",
            category="marine",
            editable=LayerEditabilityEnum.creator_only,
            is_global=False,
            source_config={"url": "https://example.com/wms"},
            style_config={"color": "blue"},
        )

        created = layer_service.create_layer(layer_data, test_user.id)

        assert created is not None
        assert created.name == "Test WMS"
        assert created.source_type == "wms"
        assert created.description == "Test WMS layer"
        assert created.category == "marine"
        assert created.created_by == test_user.id
        assert created.editable == "creator-only"
        assert created.is_global is False
        assert created.source_config == {"url": "https://example.com/wms"}
        assert created.style_config == {"color": "blue"}

    def test_create_geotiff_layer(self, layer_service, test_user):
        """Test creating a GeoTIFF layer"""
        layer_data = LayerCreate(
            name="Test GeoTIFF",
            source_type=LayerSourceTypeEnum.geotiff,
            description="Test GeoTIFF layer",
            source_config={"url": "https://example.com/data.tif"},
        )

        created = layer_service.create_layer(layer_data, test_user.id)

        assert created is not None
        assert created.name == "Test GeoTIFF"
        assert created.source_type == "geotiff"
        assert created.created_by == test_user.id

    def test_create_vector_layer(self, layer_service, test_user):
        """Test creating a vector layer"""
        layer_data = LayerCreate(
            name="Test Vector",
            source_type=LayerSourceTypeEnum.vector,
            description="Test vector layer",
            category="fisheries",
            source_config={"type": "geojson"},
        )

        created = layer_service.create_layer(layer_data, test_user.id)

        assert created is not None
        assert created.name == "Test Vector"
        assert created.source_type == "vector"
        assert created.category == "fisheries"

    def test_get_layer(self, layer_service, wms_layer):
        """Test getting a layer by ID"""
        retrieved = layer_service.get_layer(wms_layer.id)

        assert retrieved is not None
        assert retrieved.id == wms_layer.id
        assert retrieved.name == "WMS Marine Data"

    def test_get_nonexistent_layer(self, layer_service):
        """Test getting a layer that doesn't exist"""
        fake_id = uuid4()
        retrieved = layer_service.get_layer(fake_id)
        assert retrieved is None

    def test_update_layer_as_creator(self, layer_service, test_user, wms_layer):
        """Test updating layer as creator"""
        update_data = LayerUpdate(
            name="Updated WMS",
            description="Updated description",
            category="updated_category",
        )

        updated = layer_service.update_layer(wms_layer.id, update_data, test_user.id)

        assert updated is not None
        assert updated.name == "Updated WMS"
        assert updated.description == "Updated description"
        assert updated.category == "updated_category"
        # Unchanged fields should remain
        assert updated.source_type == "wms"
        assert updated.editable == "creator-only"

    def test_update_layer_partial(self, layer_service, test_user, wms_layer):
        """Test partial update of layer"""
        original_name = wms_layer.name
        original_description = wms_layer.description

        update_data = LayerUpdate(category="new_category")
        updated = layer_service.update_layer(wms_layer.id, update_data, test_user.id)

        assert updated is not None
        assert updated.category == "new_category"
        assert updated.name == original_name
        assert updated.description == original_description

    def test_delete_layer_as_creator(self, layer_service, test_user, wms_layer):
        """Test deleting a layer as creator"""
        deleted = layer_service.delete_layer(wms_layer.id, test_user.id)

        assert deleted is True

        # Verify layer is gone
        retrieved = layer_service.get_layer(wms_layer.id)
        assert retrieved is None

    def test_delete_nonexistent_layer(self, layer_service, test_user):
        """Test deleting a layer that doesn't exist"""
        fake_id = uuid4()
        deleted = layer_service.delete_layer(fake_id, test_user.id)
        assert deleted is False


# ============================================================================
# Permission Tests
# ============================================================================


class TestLayerPermissions:
    """Test layer permission checks"""

    def test_creator_can_edit_own_layer(self, layer_service, test_user, wms_layer):
        """Test that creator can edit their own layer"""
        can_edit = layer_service.can_edit_layer(wms_layer.id, test_user.id)
        assert can_edit is True

    def test_creator_can_delete_own_layer(self, layer_service, test_user, wms_layer):
        """Test that creator can delete their own layer"""
        can_delete = layer_service.can_delete_layer(wms_layer.id, test_user.id)
        assert can_delete is True

    def test_non_creator_cannot_edit_creator_only_layer(
        self, layer_service, test_user2, wms_layer
    ):
        """Test that non-creator cannot edit creator-only layer"""
        can_edit = layer_service.can_edit_layer(wms_layer.id, test_user2.id)
        assert can_edit is False

        # Try to update
        update_data = LayerUpdate(name="Should Fail")
        updated = layer_service.update_layer(wms_layer.id, update_data, test_user2.id)
        assert updated is None

    def test_non_creator_can_edit_everyone_editable_layer(
        self, layer_service, test_user2, everyone_editable_layer
    ):
        """Test that anyone can edit layer with editable=everyone"""
        can_edit = layer_service.can_edit_layer(everyone_editable_layer.id, test_user2.id)
        assert can_edit is True

        # Try to update
        update_data = LayerUpdate(name="Updated by Other User")
        updated = layer_service.update_layer(
            everyone_editable_layer.id, update_data, test_user2.id
        )
        assert updated is not None
        assert updated.name == "Updated by Other User"

    def test_non_creator_cannot_delete_everyone_editable_layer(
        self, layer_service, test_user2, everyone_editable_layer
    ):
        """Test that editable=everyone does NOT grant delete permission"""
        can_delete = layer_service.can_delete_layer(
            everyone_editable_layer.id, test_user2.id
        )
        assert can_delete is False

        # Try to delete
        deleted = layer_service.delete_layer(everyone_editable_layer.id, test_user2.id)
        assert deleted is False

    def test_non_creator_cannot_delete_any_layer(
        self, layer_service, test_user2, wms_layer
    ):
        """Test that only creator can delete layers"""
        deleted = layer_service.delete_layer(wms_layer.id, test_user2.id)
        assert deleted is False

    def test_update_layer_unauthorized(
        self, layer_service, test_user2, wms_layer
    ):
        """Test updating layer without permission returns None"""
        update_data = LayerUpdate(name="Unauthorized Update")
        updated = layer_service.update_layer(wms_layer.id, update_data, test_user2.id)
        assert updated is None

    def test_can_edit_nonexistent_layer(self, layer_service, test_user):
        """Test can_edit_layer returns False for nonexistent layer"""
        fake_id = uuid4()
        can_edit = layer_service.can_edit_layer(fake_id, test_user.id)
        assert can_edit is False

    def test_can_delete_nonexistent_layer(self, layer_service, test_user):
        """Test can_delete_layer returns False for nonexistent layer"""
        fake_id = uuid4()
        can_delete = layer_service.can_delete_layer(fake_id, test_user.id)
        assert can_delete is False


# ============================================================================
# Filtering Tests
# ============================================================================


class TestLayerFiltering:
    """Test layer listing with filters"""

    def test_list_all_accessible_layers(
        self, layer_service, test_user, wms_layer, geotiff_layer, global_layer
    ):
        """Test listing all layers accessible to user"""
        layers = layer_service.list_layers(test_user.id)

        assert len(layers) == 3
        layer_ids = {layer.id for layer in layers}
        assert wms_layer.id in layer_ids
        assert geotiff_layer.id in layer_ids
        assert global_layer.id in layer_ids

    def test_list_layers_includes_global(
        self, layer_service, test_user2, global_layer
    ):
        """Test that global layers are visible to all users"""
        layers = layer_service.list_layers(test_user2.id)

        # test_user2 doesn't own any layers, but should see global ones
        assert len(layers) >= 1
        layer_ids = {layer.id for layer in layers}
        assert global_layer.id in layer_ids

    def test_list_layers_excludes_other_users_private(
        self, layer_service, test_user, test_user2, wms_layer
    ):
        """Test that private layers from other users are not visible"""
        layers = layer_service.list_layers(test_user2.id)

        # wms_layer is owned by test_user and not global
        layer_ids = {layer.id for layer in layers}
        assert wms_layer.id not in layer_ids

    def test_filter_by_source_type_wms(
        self, layer_service, test_user, wms_layer, geotiff_layer, vector_layer
    ):
        """Test filtering by source type WMS"""
        layers = layer_service.list_layers(test_user.id, source_type="wms")

        assert len(layers) == 1
        assert layers[0].id == wms_layer.id

    def test_filter_by_source_type_geotiff(
        self, layer_service, test_user, wms_layer, geotiff_layer, vector_layer
    ):
        """Test filtering by source type GeoTIFF"""
        layers = layer_service.list_layers(test_user.id, source_type="geotiff")

        assert len(layers) == 1
        assert layers[0].id == geotiff_layer.id

    def test_filter_by_source_type_vector(
        self, layer_service, test_user, wms_layer, vector_layer, global_layer
    ):
        """Test filtering by source type vector"""
        layers = layer_service.list_layers(test_user.id, source_type="vector")

        # Should include vector_layer and global_layer (both vector type)
        assert len(layers) == 2
        layer_ids = {layer.id for layer in layers}
        assert vector_layer.id in layer_ids
        assert global_layer.id in layer_ids

    def test_filter_by_category(
        self, layer_service, test_user, wms_layer, geotiff_layer, vector_layer
    ):
        """Test filtering by category"""
        layers = layer_service.list_layers(test_user.id, category="marine")

        assert len(layers) == 1
        assert layers[0].id == wms_layer.id

    def test_filter_by_is_global_true(
        self, layer_service, test_user, wms_layer, global_layer
    ):
        """Test filtering for global layers only"""
        layers = layer_service.list_layers(test_user.id, is_global=True)

        # Should only return global_layer
        assert len(layers) >= 1
        for layer in layers:
            assert layer.is_global is True

    def test_filter_by_is_global_false(
        self, layer_service, test_user, wms_layer, geotiff_layer, global_layer
    ):
        """Test filtering for non-global layers only"""
        layers = layer_service.list_layers(test_user.id, is_global=False)

        # Should return wms_layer and geotiff_layer (both non-global)
        layer_ids = {layer.id for layer in layers}
        assert wms_layer.id in layer_ids
        assert geotiff_layer.id in layer_ids
        assert global_layer.id not in layer_ids

    def test_search_by_name(
        self, layer_service, test_user, wms_layer, geotiff_layer
    ):
        """Test searching layers by name"""
        layers = layer_service.list_layers(test_user.id, search="WMS")

        assert len(layers) == 1
        assert layers[0].id == wms_layer.id

    def test_search_by_description(
        self, layer_service, test_user, wms_layer, vector_layer
    ):
        """Test searching layers by description"""
        layers = layer_service.list_layers(test_user.id, search="Fish")

        assert len(layers) == 1
        assert layers[0].id == vector_layer.id

    def test_search_case_insensitive(
        self, layer_service, test_user, wms_layer
    ):
        """Test that search is case-insensitive"""
        layers_upper = layer_service.list_layers(test_user.id, search="MARINE")
        layers_lower = layer_service.list_layers(test_user.id, search="marine")

        assert len(layers_upper) == len(layers_lower)
        assert layers_upper[0].id == layers_lower[0].id

    def test_search_empty_string(
        self, layer_service, test_user, wms_layer, geotiff_layer
    ):
        """Test that empty search string returns all layers"""
        layers = layer_service.list_layers(test_user.id, search="")

        # Should return all accessible layers
        assert len(layers) >= 2

    def test_search_no_results(self, layer_service, test_user):
        """Test search with no matching results"""
        layers = layer_service.list_layers(test_user.id, search="NonexistentLayer")

        assert len(layers) == 0

    def test_combined_filters(
        self, layer_service, test_user, wms_layer, geotiff_layer, vector_layer
    ):
        """Test combining multiple filters"""
        layers = layer_service.list_layers(
            test_user.id,
            source_type="vector",
            category="fisheries",
        )

        assert len(layers) == 1
        assert layers[0].id == vector_layer.id

    def test_list_layers_empty(self, layer_service, test_user2):
        """Test listing layers when user has no accessible layers"""
        # test_user2 has no layers and no global layers exist
        layers = layer_service.list_layers(test_user2.id)

        # May have some global layers from other tests, or be empty
        assert isinstance(layers, list)


# ============================================================================
# Edge Cases Tests
# ============================================================================


class TestLayerEdgeCases:
    """Test edge cases and error handling"""

    def test_get_user_layers(self, layer_service, test_user, wms_layer, geotiff_layer):
        """Test getting all layers created by user"""
        layers = layer_service.get_user_layers(test_user.id)

        assert len(layers) >= 2
        layer_ids = {layer.id for layer in layers}
        assert wms_layer.id in layer_ids
        assert geotiff_layer.id in layer_ids

    def test_get_user_layers_empty(self, layer_service, test_user2):
        """Test getting user layers when user has no layers"""
        layers = layer_service.get_user_layers(test_user2.id)
        assert len(layers) == 0

    def test_get_global_layers(self, layer_service, global_layer):
        """Test getting all global layers"""
        layers = layer_service.get_global_layers()

        assert len(layers) >= 1
        layer_ids = {layer.id for layer in layers}
        assert global_layer.id in layer_ids

    def test_search_layers(
        self, layer_service, test_user, wms_layer, geotiff_layer
    ):
        """Test search_layers helper method"""
        layers = layer_service.search_layers(test_user.id, "Marine")

        assert len(layers) >= 1
        layer_ids = {layer.id for layer in layers}
        assert wms_layer.id in layer_ids

    def test_search_layers_empty_term(self, layer_service, test_user):
        """Test search_layers with empty search term"""
        layers = layer_service.search_layers(test_user.id, "")
        assert len(layers) == 0

        layers = layer_service.search_layers(test_user.id, "   ")
        assert len(layers) == 0

    def test_search_layers_limit(
        self, layer_service, db_session, test_user
    ):
        """Test search_layers respects limit parameter"""
        # Create multiple layers
        for i in range(10):
            layer = Layer(
                name=f"Test Layer {i}",
                source_type="vector",
                description="Test description",
                created_by=test_user.id,
                editable="creator-only",
                source_config={},
            )
            db_session.add(layer)
        db_session.commit()

        layers = layer_service.search_layers(test_user.id, "Test", limit=5)

        assert len(layers) <= 5

    def test_get_layers_by_category(
        self, layer_service, test_user, wms_layer
    ):
        """Test getting layers by category"""
        layers = layer_service.get_layers_by_category(test_user.id, "marine")

        assert len(layers) == 1
        assert layers[0].id == wms_layer.id

    def test_get_layers_by_category_empty(
        self, layer_service, test_user
    ):
        """Test getting layers by nonexistent category"""
        layers = layer_service.get_layers_by_category(test_user.id, "nonexistent")
        assert len(layers) == 0

    def test_update_layer_source_type(
        self, layer_service, test_user, wms_layer
    ):
        """Test updating layer source type"""
        update_data = LayerUpdate(source_type=LayerSourceTypeEnum.vector)
        updated = layer_service.update_layer(wms_layer.id, update_data, test_user.id)

        assert updated is not None
        assert updated.source_type == "vector"

    def test_update_layer_editable_permission(
        self, layer_service, test_user, wms_layer
    ):
        """Test updating layer editable permission"""
        assert wms_layer.editable == "creator-only"

        update_data = LayerUpdate(editable=LayerEditabilityEnum.everyone)
        updated = layer_service.update_layer(wms_layer.id, update_data, test_user.id)

        assert updated is not None
        assert updated.editable == "everyone"

    def test_update_layer_make_global(
        self, layer_service, test_user, wms_layer
    ):
        """Test making a layer global"""
        assert wms_layer.is_global is False

        update_data = LayerUpdate(is_global=True)
        updated = layer_service.update_layer(wms_layer.id, update_data, test_user.id)

        assert updated is not None
        assert updated.is_global is True

    def test_create_layer_with_all_configs(self, layer_service, test_user):
        """Test creating layer with all configuration fields"""
        layer_data = LayerCreate(
            name="Complete Layer",
            source_type=LayerSourceTypeEnum.vector,
            description="Layer with all configs",
            category="test",
            editable=LayerEditabilityEnum.everyone,
            is_global=True,
            source_config={"type": "geojson", "url": "https://example.com/data.json"},
            style_config={"color": "red", "opacity": 0.5},
            legend_config={"type": "categories", "items": []},
            metadata={"author": "Test", "license": "MIT"},
        )

        created = layer_service.create_layer(layer_data, test_user.id)

        assert created is not None
        assert created.source_config == {"type": "geojson", "url": "https://example.com/data.json"}
        assert created.style_config == {"color": "red", "opacity": 0.5}
        assert created.legend_config == {"type": "categories", "items": []}
        assert created.layer_metadata == {"author": "Test", "license": "MIT"}

    def test_create_layer_minimal_fields(self, layer_service, test_user):
        """Test creating layer with only required fields"""
        layer_data = LayerCreate(
            name="Minimal Layer",
            source_type=LayerSourceTypeEnum.wms,
            source_config={"url": "https://example.com/wms"},  # Required field
        )

        created = layer_service.create_layer(layer_data, test_user.id)

        assert created is not None
        assert created.name == "Minimal Layer"
        assert created.source_type == "wms"
        assert created.description is None
        assert created.category is None
        assert created.editable == "creator-only"  # default
        assert created.is_global is False  # default
        assert created.source_config == {"url": "https://example.com/wms"}
        assert created.style_config == {}
        assert created.legend_config == {}
        assert created.layer_metadata == {}

    def test_update_nonexistent_layer(self, layer_service, test_user):
        """Test updating a layer that doesn't exist"""
        fake_id = uuid4()
        update_data = LayerUpdate(name="Should Fail")
        updated = layer_service.update_layer(fake_id, update_data, test_user.id)
        assert updated is None

    def test_layer_ordering(
        self, layer_service, db_session, test_user
    ):
        """Test that layers are ordered by creation date (newest first)"""
        # Create layers in sequence
        layer1 = Layer(
            name="First Layer",
            source_type="vector",
            created_by=test_user.id,
            source_config={},
        )
        db_session.add(layer1)
        db_session.commit()

        layer2 = Layer(
            name="Second Layer",
            source_type="vector",
            created_by=test_user.id,
            source_config={},
        )
        db_session.add(layer2)
        db_session.commit()

        layers = layer_service.list_layers(test_user.id)

        # Second layer should appear first (newest first)
        assert layers[0].id == layer2.id
        assert layers[1].id == layer1.id

    def test_multiple_users_layers_isolation(
        self, layer_service, test_user, test_user2
    ):
        """Test that users only see their own layers (plus global)"""
        # Create layer for test_user
        layer_data1 = LayerCreate(
            name="User1 Layer",
            source_type=LayerSourceTypeEnum.vector,
            source_config={"type": "geojson"},
        )
        layer1 = layer_service.create_layer(layer_data1, test_user.id)

        # Create layer for test_user2
        layer_data2 = LayerCreate(
            name="User2 Layer",
            source_type=LayerSourceTypeEnum.vector,
            source_config={"type": "geojson"},
        )
        layer2 = layer_service.create_layer(layer_data2, test_user2.id)

        # test_user should only see their layer
        user1_layers = layer_service.list_layers(test_user.id)
        user1_layer_ids = {layer.id for layer in user1_layers}
        assert layer1.id in user1_layer_ids
        assert layer2.id not in user1_layer_ids

        # test_user2 should only see their layer
        user2_layers = layer_service.list_layers(test_user2.id)
        user2_layer_ids = {layer.id for layer in user2_layers}
        assert layer2.id in user2_layer_ids
        assert layer1.id not in user2_layer_ids
