"""
Unit tests for map service.

Tests map CRUD operations, permission checks, collaborator management,
and layer management. Uses PostgreSQL test database with transaction
rollback for isolation.
"""

from uuid import uuid4

import pytest

from app.models.collaborator import MapCollaborator
from app.models.layer import Layer, MapLayer
from app.models.map import Map
from app.models.user import User
from app.schemas.map import MapCreate, MapPermissionEnum, MapUpdate
from app.services.map_service import MapService

# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def map_service(db_session):
    """Create map service instance"""
    return MapService(db_session)


@pytest.fixture
def test_user(db_session):
    """Create a test user"""
    user = User(
        clerk_id="user_test_owner",
        email="owner@example.com",
        username="testowner",
        first_name="Test",
        last_name="Owner",
    )
    db_session.add(user)
    db_session.flush()
    db_session.refresh(user)
    return user


@pytest.fixture
def other_user(db_session):
    """Create another test user"""
    user = User(
        clerk_id="user_test_other",
        email="other@example.com",
        username="testother",
        first_name="Other",
        last_name="User",
    )
    db_session.add(user)
    db_session.flush()
    db_session.refresh(user)
    return user


@pytest.fixture
def third_user(db_session):
    """Create a third test user"""
    user = User(
        clerk_id="user_test_third",
        email="third@example.com",
        username="testthird",
        first_name="Third",
        last_name="User",
    )
    db_session.add(user)
    db_session.flush()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_map(db_session, test_user):
    """Create a test map owned by test_user"""
    map_obj = Map(
        name="Test Map",
        description="A test map",
        created_by=test_user.id,
        view_permission="private",
        edit_permission="private",
        center_lat=40.7128,
        center_lng=-74.0060,
        zoom=10.0,
        map_metadata={"key": "value"},
    )
    db_session.add(map_obj)
    db_session.flush()
    db_session.refresh(map_obj)
    return map_obj


@pytest.fixture
def collaborators_map(db_session, test_user):
    """Create a map with collaborators permission"""
    map_obj = Map(
        name="Collaborators Map",
        description="Map with collaborators permission",
        created_by=test_user.id,
        view_permission="collaborators",
        edit_permission="collaborators",
        center_lat=40.7128,
        center_lng=-74.0060,
        zoom=10.0,
    )
    db_session.add(map_obj)
    db_session.flush()
    db_session.refresh(map_obj)
    return map_obj


@pytest.fixture
def public_map(db_session, test_user):
    """Create a public map"""
    map_obj = Map(
        name="Public Map",
        description="A public map",
        created_by=test_user.id,
        view_permission="public",
        edit_permission="public",
        center_lat=0.0,
        center_lng=0.0,
        zoom=2.0,
    )
    db_session.add(map_obj)
    db_session.flush()
    db_session.refresh(map_obj)
    return map_obj


@pytest.fixture
def test_layer(db_session, test_user):
    """Create a test layer"""
    layer = Layer(
        name="Test Layer",
        source_type="vector",
        description="A test layer",
        created_by=test_user.id,
        source_config={"type": "geojson"},
        style_config={"color": "blue"},
    )
    db_session.add(layer)
    db_session.flush()
    db_session.refresh(layer)
    return layer


@pytest.fixture
def second_layer(db_session, test_user):
    """Create a second test layer"""
    layer = Layer(
        name="Second Layer",
        source_type="wms",
        description="Another test layer",
        created_by=test_user.id,
        source_config={"url": "https://example.com/wms"},
    )
    db_session.add(layer)
    db_session.flush()
    db_session.refresh(layer)
    return layer


# ============================================================================
# Core CRUD Tests
# ============================================================================


class TestMapCRUD:
    """Test core map CRUD operations"""

    def test_list_user_maps_owned(self, map_service, test_user, test_map):
        """Test listing maps owned by user"""
        maps = map_service.list_user_maps(test_user.id)

        assert len(maps) == 1
        assert maps[0].id == test_map.id
        assert maps[0].name == "Test Map"

    def test_list_user_maps_shared(
        self, map_service, db_session, test_user, other_user, test_map
    ):
        """Test listing maps shared with user via collaborator"""
        # Add other_user as collaborator
        collaborator = MapCollaborator(
            map_id=test_map.id,
            user_id=other_user.id,
            role="viewer",
        )
        db_session.add(collaborator)
        db_session.flush()

        # Other user should see the map
        maps = map_service.list_user_maps(other_user.id)

        assert len(maps) == 1
        assert maps[0].id == test_map.id

    def test_list_user_maps_empty(self, map_service, other_user):
        """Test listing maps when user has no maps"""
        maps = map_service.list_user_maps(other_user.id)
        assert len(maps) == 0

    def test_get_map_as_owner(self, map_service, test_user, test_map):
        """Test getting map as owner"""
        retrieved = map_service.get_map(test_map.id, test_user.id)

        assert retrieved is not None
        assert retrieved.id == test_map.id
        assert retrieved.name == "Test Map"

    def test_create_map(self, map_service, test_user):
        """Test creating a new map"""
        map_data = MapCreate(
            name="New Map",
            description="A new test map",
            view_permission=MapPermissionEnum.private,
            edit_permission=MapPermissionEnum.private,
            center_lat=51.5074,
            center_lng=-0.1278,
            zoom=12.0,
            map_metadata={"city": "London"},
        )

        created = map_service.create_map(map_data, test_user.id)

        assert created is not None
        assert created.name == "New Map"
        assert created.description == "A new test map"
        assert created.created_by == test_user.id
        assert created.view_permission == "private"
        assert created.edit_permission == "private"
        assert created.center_lat == 51.5074
        assert created.center_lng == -0.1278
        assert created.zoom == 12.0
        assert created.map_metadata == {"city": "London"}

    def test_update_map(self, map_service, test_user, test_map):
        """Test updating map properties"""
        update_data = MapUpdate(
            name="Updated Map",
            description="Updated description",
            zoom=15.0,
        )

        updated = map_service.update_map(test_map.id, update_data, test_user.id)

        assert updated is not None
        assert updated.name == "Updated Map"
        assert updated.description == "Updated description"
        assert updated.zoom == 15.0
        # Unchanged fields should remain
        assert updated.center_lat == 40.7128
        assert updated.view_permission == "private"
        assert updated.edit_permission == "private"

    def test_delete_map(self, map_service, test_user, test_map):
        """Test deleting a map"""
        deleted = map_service.delete_map(test_map.id, test_user.id)

        assert deleted is True

        # Verify map is gone
        retrieved = map_service.get_map(test_map.id, test_user.id)
        assert retrieved is None


# ============================================================================
# Permission Tests
# ============================================================================


class TestMapPermissions:
    """Test map permission checks"""

    def test_get_map_private_as_non_owner(self, map_service, test_map, other_user):
        """Test that non-owner cannot view private map"""
        retrieved = map_service.get_map(test_map.id, other_user.id)
        assert retrieved is None

    def test_get_map_collaborators_with_access(
        self, map_service, db_session, collaborators_map, other_user
    ):
        """Test that collaborator can view map with collaborators permission"""
        # Add other_user as collaborator
        collaborator = MapCollaborator(
            map_id=collaborators_map.id,
            user_id=other_user.id,
            role="viewer",
        )
        db_session.add(collaborator)
        db_session.flush()

        # Collaborator should see the map
        retrieved = map_service.get_map(collaborators_map.id, other_user.id)
        assert retrieved is not None
        assert retrieved.id == collaborators_map.id

    def test_get_map_collaborators_without_access(
        self, map_service, collaborators_map, other_user
    ):
        """Test that non-collaborator cannot view collaborators map"""
        retrieved = map_service.get_map(collaborators_map.id, other_user.id)
        assert retrieved is None

    def test_get_map_public_anonymous(self, map_service, public_map, other_user):
        """Test that anyone can view public map"""
        retrieved = map_service.get_map(public_map.id, other_user.id)
        assert retrieved is not None
        assert retrieved.id == public_map.id

    def test_update_map_requires_edit_permission(
        self, map_service, db_session, test_map, other_user
    ):
        """Test that editor can update map"""
        # Set edit_permission to "collaborators" so editors can edit
        test_map.edit_permission = "collaborators"
        db_session.flush()

        # Add other_user as editor
        collaborator = MapCollaborator(
            map_id=test_map.id,
            user_id=other_user.id,
            role="editor",
        )
        db_session.add(collaborator)
        db_session.flush()

        # Editor should be able to update
        update_data = MapUpdate(name="Updated by Editor")
        updated = map_service.update_map(test_map.id, update_data, other_user.id)

        assert updated is not None
        assert updated.name == "Updated by Editor"

    def test_update_map_viewer_cannot(
        self, map_service, db_session, test_map, other_user
    ):
        """Test that viewer cannot update map"""
        # Add other_user as viewer
        collaborator = MapCollaborator(
            map_id=test_map.id,
            user_id=other_user.id,
            role="viewer",
        )
        db_session.add(collaborator)
        db_session.flush()

        # Viewer should not be able to update
        update_data = MapUpdate(name="Should Fail")
        updated = map_service.update_map(test_map.id, update_data, other_user.id)

        assert updated is None

    def test_delete_map_owner_only(self, map_service, db_session, test_map, other_user):
        """Test that only owner can delete map"""
        # Add other_user as editor
        collaborator = MapCollaborator(
            map_id=test_map.id,
            user_id=other_user.id,
            role="editor",
        )
        db_session.add(collaborator)
        db_session.flush()

        # Editor cannot delete
        deleted = map_service.delete_map(test_map.id, other_user.id)
        assert deleted is False

        # Map should still exist
        retrieved = map_service.get_map(test_map.id, test_map.created_by)
        assert retrieved is not None

    def test_can_view_map_permission_checks(
        self,
        map_service,
        test_map,
        public_map,
        collaborators_map,
        test_user,
        other_user,
    ):
        """Test can_view_map for different permission levels"""
        # Owner can view private map
        assert map_service.can_view_map(test_map.id, test_user.id) is True

        # Non-owner cannot view private map
        assert map_service.can_view_map(test_map.id, other_user.id) is False

        # Anyone can view public map
        assert map_service.can_view_map(public_map.id, other_user.id) is True

        # Non-collaborator cannot view collaborators map
        assert map_service.can_view_map(collaborators_map.id, other_user.id) is False

    def test_can_edit_map_permission_checks(
        self, map_service, db_session, test_map, test_user, other_user
    ):
        """Test can_edit_map for different roles"""
        # Set edit_permission to "collaborators" so editors can edit
        test_map.edit_permission = "collaborators"
        db_session.flush()

        # Owner can edit
        assert map_service.can_edit_map(test_map.id, test_user.id) is True

        # Non-collaborator cannot edit
        assert map_service.can_edit_map(test_map.id, other_user.id) is False

        # Viewer cannot edit
        viewer = MapCollaborator(
            map_id=test_map.id,
            user_id=other_user.id,
            role="viewer",
        )
        db_session.add(viewer)
        db_session.flush()
        assert map_service.can_edit_map(test_map.id, other_user.id) is False

        # Update to editor - now can edit
        viewer.role = "editor"
        db_session.flush()
        assert map_service.can_edit_map(test_map.id, other_user.id) is True


# ============================================================================
# Collaborator Management Tests
# ============================================================================


class TestCollaboratorManagement:
    """Test collaborator management operations"""

    def test_add_collaborator(self, map_service, test_map, test_user, other_user):
        """Test adding a collaborator to a map"""
        collaborator = map_service.add_collaborator(
            test_map.id, other_user.id, "viewer", test_user.id
        )

        assert collaborator is not None
        assert collaborator.map_id == test_map.id
        assert collaborator.user_id == other_user.id
        assert collaborator.role == "viewer"

    def test_add_collaborator_duplicate(
        self, map_service, db_session, test_map, test_user, other_user
    ):
        """Test that adding duplicate collaborator fails"""
        # Add first time
        first = map_service.add_collaborator(
            test_map.id, other_user.id, "viewer", test_user.id
        )
        assert first is not None

        # Try to add again - should fail
        duplicate = map_service.add_collaborator(
            test_map.id, other_user.id, "editor", test_user.id
        )
        assert duplicate is None

    def test_add_editor_requires_owner(
        self, map_service, db_session, test_map, test_user, other_user, third_user
    ):
        """Test that only owner can add editors"""
        # Add other_user as editor
        editor = MapCollaborator(
            map_id=test_map.id,
            user_id=other_user.id,
            role="editor",
        )
        db_session.add(editor)
        db_session.flush()

        # Editor cannot add another editor
        result = map_service.add_collaborator(
            test_map.id, third_user.id, "editor", other_user.id
        )
        assert result is None

        # Owner can add editor
        result = map_service.add_collaborator(
            test_map.id, third_user.id, "editor", test_user.id
        )
        assert result is not None

    def test_editor_can_add_viewer(
        self, map_service, db_session, test_map, test_user, other_user, third_user
    ):
        """Test that editor can add viewers"""
        # Add other_user as editor
        editor = MapCollaborator(
            map_id=test_map.id,
            user_id=other_user.id,
            role="editor",
        )
        db_session.add(editor)
        db_session.flush()

        # Editor can add viewer
        result = map_service.add_collaborator(
            test_map.id, third_user.id, "viewer", other_user.id
        )
        assert result is not None
        assert result.role == "viewer"

    def test_update_collaborator_role(
        self, map_service, db_session, test_map, test_user, other_user
    ):
        """Test updating a collaborator's role"""
        # Add collaborator as viewer
        collaborator = MapCollaborator(
            map_id=test_map.id,
            user_id=other_user.id,
            role="viewer",
        )
        db_session.add(collaborator)
        db_session.flush()

        # Update to editor
        updated = map_service.update_collaborator(
            test_map.id, other_user.id, "editor", test_user.id
        )

        assert updated is not None
        assert updated.role == "editor"

    def test_update_collaborator_requires_owner(
        self, map_service, db_session, test_map, test_user, other_user, third_user
    ):
        """Test that only owner can update collaborator roles"""
        # Add two collaborators
        editor = MapCollaborator(
            map_id=test_map.id,
            user_id=other_user.id,
            role="editor",
        )
        viewer = MapCollaborator(
            map_id=test_map.id,
            user_id=third_user.id,
            role="viewer",
        )
        db_session.add_all([editor, viewer])
        db_session.flush()

        # Editor cannot update viewer's role
        result = map_service.update_collaborator(
            test_map.id, third_user.id, "editor", other_user.id
        )
        assert result is None

    def test_remove_collaborator(
        self, map_service, db_session, test_map, test_user, other_user
    ):
        """Test removing a collaborator from a map"""
        # Add collaborator
        collaborator = MapCollaborator(
            map_id=test_map.id,
            user_id=other_user.id,
            role="viewer",
        )
        db_session.add(collaborator)
        db_session.flush()

        # Remove collaborator
        removed = map_service.remove_collaborator(
            test_map.id, other_user.id, test_user.id
        )
        assert removed is True

        # Verify collaborator is gone
        result = (
            db_session.query(MapCollaborator)
            .filter(
                MapCollaborator.map_id == test_map.id,
                MapCollaborator.user_id == other_user.id,
            )
            .first()
        )
        assert result is None

    def test_remove_collaborator_requires_owner(
        self, map_service, db_session, test_map, test_user, other_user, third_user
    ):
        """Test that only owner can remove collaborators"""
        # Add two collaborators
        editor = MapCollaborator(
            map_id=test_map.id,
            user_id=other_user.id,
            role="editor",
        )
        viewer = MapCollaborator(
            map_id=test_map.id,
            user_id=third_user.id,
            role="viewer",
        )
        db_session.add_all([editor, viewer])
        db_session.flush()

        # Editor cannot remove viewer
        removed = map_service.remove_collaborator(
            test_map.id, third_user.id, other_user.id
        )
        assert removed is False

    def test_list_collaborators(
        self, map_service, db_session, test_map, test_user, other_user, third_user
    ):
        """Test listing all collaborators of a map"""
        # Add collaborators
        editor = MapCollaborator(
            map_id=test_map.id,
            user_id=other_user.id,
            role="editor",
        )
        viewer = MapCollaborator(
            map_id=test_map.id,
            user_id=third_user.id,
            role="viewer",
        )
        db_session.add_all([editor, viewer])
        db_session.flush()

        # List collaborators
        collaborators = map_service.list_collaborators(test_map.id, test_user.id)

        assert collaborators is not None
        assert len(collaborators) == 2
        user_ids = {c.user_id for c in collaborators}
        assert other_user.id in user_ids
        assert third_user.id in user_ids

    def test_list_collaborators_unauthorized(self, map_service, test_map, other_user):
        """Test that unauthorized user cannot list collaborators"""
        collaborators = map_service.list_collaborators(test_map.id, other_user.id)
        assert collaborators is None


# ============================================================================
# Layer Management Tests
# ============================================================================


class TestLayerManagement:
    """Test layer management operations in maps"""

    def test_add_layer_to_map(self, map_service, test_map, test_layer, test_user):
        """Test adding a layer to a map"""
        map_layer = map_service.add_layer_to_map(
            test_map.id,
            test_layer.id,
            test_user.id,
            display_order=1,
            is_visible=True,
            opacity=80,
        )

        assert map_layer is not None
        assert map_layer.map_id == test_map.id
        assert map_layer.layer_id == test_layer.id
        assert map_layer.order == 1
        assert map_layer.visible is True
        assert map_layer.opacity == 80

    def test_add_layer_duplicate(
        self, map_service, db_session, test_map, test_layer, test_user
    ):
        """Test that adding same layer twice fails"""
        # Add first time
        first = map_service.add_layer_to_map(test_map.id, test_layer.id, test_user.id)
        assert first is not None

        # Try to add again - should fail
        duplicate = map_service.add_layer_to_map(
            test_map.id, test_layer.id, test_user.id
        )
        assert duplicate is None

    def test_remove_layer_from_map(
        self, map_service, db_session, test_map, test_layer, test_user
    ):
        """Test removing a layer from a map"""
        # Add layer first
        map_layer = MapLayer(
            map_id=test_map.id,
            layer_id=test_layer.id,
            order=0,
            visible=True,
            opacity=100,
        )
        db_session.add(map_layer)
        db_session.flush()

        # Remove layer
        removed = map_service.remove_layer_from_map(
            test_map.id, test_layer.id, test_user.id
        )
        assert removed is True

        # Verify layer association is gone
        result = (
            db_session.query(MapLayer)
            .filter(
                MapLayer.map_id == test_map.id,
                MapLayer.layer_id == test_layer.id,
            )
            .first()
        )
        assert result is None

    def test_update_map_layer(
        self, map_service, db_session, test_map, test_layer, test_user
    ):
        """Test updating layer properties in a map"""
        # Add layer first
        map_layer = MapLayer(
            map_id=test_map.id,
            layer_id=test_layer.id,
            order=0,
            visible=True,
            opacity=100,
        )
        db_session.add(map_layer)
        db_session.flush()

        # Update layer properties
        updates = {"visible": False, "opacity": 50, "order": 5}
        updated = map_service.update_map_layer(
            test_map.id, test_layer.id, updates, test_user.id
        )

        assert updated is not None
        assert updated.visible is False
        assert updated.opacity == 50
        assert updated.order == 5

    def test_reorder_layers(
        self, map_service, db_session, test_map, test_layer, second_layer, test_user
    ):
        """Test reordering all layers in a map"""
        # Add two layers
        layer1 = MapLayer(
            map_id=test_map.id,
            layer_id=test_layer.id,
            order=0,
        )
        layer2 = MapLayer(
            map_id=test_map.id,
            layer_id=second_layer.id,
            order=1,
        )
        db_session.add_all([layer1, layer2])
        db_session.flush()

        # Reorder layers
        layer_orders = [
            {"layer_id": test_layer.id, "order": 1},
            {"layer_id": second_layer.id, "order": 0},
        ]
        result = map_service.reorder_layers(test_map.id, layer_orders, test_user.id)

        assert result is True

        # Verify new order
        db_session.refresh(layer1)
        db_session.refresh(layer2)
        assert layer1.order == 1
        assert layer2.order == 0

    def test_layer_operations_require_edit_permission(
        self, map_service, db_session, test_map, test_layer, other_user
    ):
        """Test that layer operations require edit permission"""
        # other_user is not a collaborator

        # Cannot add layer
        result = map_service.add_layer_to_map(test_map.id, test_layer.id, other_user.id)
        assert result is None

        # Add layer as owner for next tests
        map_layer = MapLayer(
            map_id=test_map.id,
            layer_id=test_layer.id,
            order=0,
        )
        db_session.add(map_layer)
        db_session.flush()

        # Cannot remove layer
        result = map_service.remove_layer_from_map(
            test_map.id, test_layer.id, other_user.id
        )
        assert result is False

        # Cannot update layer
        result = map_service.update_map_layer(
            test_map.id, test_layer.id, {"visible": False}, other_user.id
        )
        assert result is None

        # Cannot reorder layers
        result = map_service.reorder_layers(
            test_map.id, [{"layer_id": test_layer.id, "order": 0}], other_user.id
        )
        assert result is False

    def test_editor_can_manage_layers(
        self, map_service, db_session, test_map, test_layer, other_user
    ):
        """Test that editor collaborator can manage layers"""
        # Set edit_permission to "collaborators" so editors can manage layers
        test_map.edit_permission = "collaborators"
        db_session.flush()

        # Add other_user as editor
        editor = MapCollaborator(
            map_id=test_map.id,
            user_id=other_user.id,
            role="editor",
        )
        db_session.add(editor)
        db_session.flush()

        # Editor can add layer
        result = map_service.add_layer_to_map(test_map.id, test_layer.id, other_user.id)
        assert result is not None

        # Editor can update layer
        result = map_service.update_map_layer(
            test_map.id, test_layer.id, {"opacity": 75}, other_user.id
        )
        assert result is not None

        # Editor can remove layer
        result = map_service.remove_layer_from_map(
            test_map.id, test_layer.id, other_user.id
        )
        assert result is True


# ============================================================================
# Edge Cases and Error Handling
# ============================================================================


class TestEdgeCases:
    """Test edge cases and error handling"""

    def test_get_nonexistent_map(self, map_service, test_user):
        """Test getting a map that doesn't exist"""
        fake_id = uuid4()
        result = map_service.get_map(fake_id, test_user.id)
        assert result is None

    def test_update_nonexistent_map(self, map_service, test_user):
        """Test updating a map that doesn't exist"""
        fake_id = uuid4()
        update_data = MapUpdate(name="Should Fail")
        result = map_service.update_map(fake_id, update_data, test_user.id)
        assert result is None

    def test_delete_nonexistent_map(self, map_service, test_user):
        """Test deleting a map that doesn't exist"""
        fake_id = uuid4()
        result = map_service.delete_map(fake_id, test_user.id)
        assert result is False

    def test_add_collaborator_invalid_user(self, map_service, test_map, test_user):
        """Test adding collaborator with invalid user_id"""
        fake_user_id = uuid4()
        result = map_service.add_collaborator(
            test_map.id, fake_user_id, "viewer", test_user.id
        )
        # Should return None due to foreign key violation
        assert result is None

    def test_add_collaborator_invalid_map(self, map_service, test_user, other_user):
        """Test adding collaborator to invalid map"""
        fake_map_id = uuid4()
        result = map_service.add_collaborator(
            fake_map_id, other_user.id, "viewer", test_user.id
        )
        assert result is None

    def test_add_layer_invalid_layer(self, map_service, test_map, test_user):
        """Test adding invalid layer to map"""
        fake_layer_id = uuid4()
        result = map_service.add_layer_to_map(test_map.id, fake_layer_id, test_user.id)
        assert result is None

    def test_add_layer_invalid_map(self, map_service, test_layer, test_user):
        """Test adding layer to invalid map"""
        fake_map_id = uuid4()
        result = map_service.add_layer_to_map(fake_map_id, test_layer.id, test_user.id)
        assert result is None

    def test_get_user_role_in_map(
        self, map_service, db_session, test_map, test_user, other_user, third_user
    ):
        """Test getting user's role in map for all role types"""
        # Owner role
        role = map_service.get_user_role_in_map(test_map.id, test_user.id)
        assert role == "owner"

        # Add editor
        editor = MapCollaborator(
            map_id=test_map.id,
            user_id=other_user.id,
            role="editor",
        )
        db_session.add(editor)
        db_session.flush()

        # Editor role
        role = map_service.get_user_role_in_map(test_map.id, other_user.id)
        assert role == "editor"

        # Add viewer
        viewer = MapCollaborator(
            map_id=test_map.id,
            user_id=third_user.id,
            role="viewer",
        )
        db_session.add(viewer)
        db_session.flush()

        # Viewer role
        role = map_service.get_user_role_in_map(test_map.id, third_user.id)
        assert role == "viewer"

        # No role (different user)
        fake_user_id = uuid4()
        role = map_service.get_user_role_in_map(test_map.id, fake_user_id)
        assert role is None

    def test_get_user_role_invalid_map(self, map_service, test_user):
        """Test getting user role in nonexistent map"""
        fake_map_id = uuid4()
        role = map_service.get_user_role_in_map(fake_map_id, test_user.id)
        assert role is None

    def test_cannot_add_owner_as_collaborator(self, map_service, test_map, test_user):
        """Test that map owner cannot be added as collaborator"""
        result = map_service.add_collaborator(
            test_map.id, test_user.id, "viewer", test_user.id
        )
        assert result is None

    def test_remove_nonexistent_collaborator(
        self, map_service, test_map, test_user, other_user
    ):
        """Test removing collaborator that doesn't exist"""
        # other_user is not a collaborator
        result = map_service.remove_collaborator(
            test_map.id, other_user.id, test_user.id
        )
        assert result is False

    def test_update_nonexistent_collaborator(
        self, map_service, test_map, test_user, other_user
    ):
        """Test updating collaborator that doesn't exist"""
        result = map_service.update_collaborator(
            test_map.id, other_user.id, "editor", test_user.id
        )
        assert result is None

    def test_remove_layer_not_in_map(
        self, map_service, test_map, test_layer, test_user
    ):
        """Test removing layer that's not in map"""
        # Layer is not added to map
        result = map_service.remove_layer_from_map(
            test_map.id, test_layer.id, test_user.id
        )
        assert result is False

    def test_update_layer_not_in_map(
        self, map_service, test_map, test_layer, test_user
    ):
        """Test updating layer that's not in map"""
        result = map_service.update_map_layer(
            test_map.id, test_layer.id, {"opacity": 50}, test_user.id
        )
        assert result is None

    def test_reorder_layers_with_string_uuid(
        self, map_service, db_session, test_map, test_layer, test_user
    ):
        """Test reorder_layers accepts string UUIDs"""
        # Add layer
        map_layer = MapLayer(
            map_id=test_map.id,
            layer_id=test_layer.id,
            order=0,
        )
        db_session.add(map_layer)
        db_session.flush()

        # Reorder with string UUID
        layer_orders = [
            {"layer_id": str(test_layer.id), "order": 5},
        ]
        result = map_service.reorder_layers(test_map.id, layer_orders, test_user.id)

        assert result is True
        db_session.refresh(map_layer)
        assert map_layer.order == 5

    def test_delete_map_cascades_to_collaborators(
        self, map_service, db_session, test_map, test_user, other_user
    ):
        """Test that deleting map removes all collaborators"""
        # Add collaborator
        collaborator = MapCollaborator(
            map_id=test_map.id,
            user_id=other_user.id,
            role="viewer",
        )
        db_session.add(collaborator)
        db_session.flush()

        # Delete map
        map_service.delete_map(test_map.id, test_user.id)

        # Verify collaborator is gone
        result = (
            db_session.query(MapCollaborator)
            .filter(MapCollaborator.map_id == test_map.id)
            .first()
        )
        assert result is None

    def test_delete_map_cascades_to_map_layers(
        self, map_service, db_session, test_map, test_layer, test_user
    ):
        """Test that deleting map removes all map-layer associations"""
        # Add layer
        map_layer = MapLayer(
            map_id=test_map.id,
            layer_id=test_layer.id,
            order=0,
        )
        db_session.add(map_layer)
        db_session.flush()

        # Delete map
        map_service.delete_map(test_map.id, test_user.id)

        # Verify map-layer association is gone
        result = (
            db_session.query(MapLayer).filter(MapLayer.map_id == test_map.id).first()
        )
        assert result is None

        # But layer itself should still exist
        layer = db_session.query(Layer).filter(Layer.id == test_layer.id).first()
        assert layer is not None

    def test_partial_map_update(self, map_service, test_map, test_user):
        """Test updating only specific fields leaves others unchanged"""
        original_name = test_map.name
        original_zoom = test_map.zoom

        # Update only description
        update_data = MapUpdate(description="New description only")
        updated = map_service.update_map(test_map.id, update_data, test_user.id)

        assert updated is not None
        assert updated.description == "New description only"
        assert updated.name == original_name
        assert updated.zoom == original_zoom

    def test_update_map_permission(self, map_service, test_map, test_user):
        """Test updating map permission level"""
        assert test_map.view_permission == "private"
        assert test_map.edit_permission == "private"

        update_data = MapUpdate(
            view_permission=MapPermissionEnum.public,
            edit_permission=MapPermissionEnum.public,
        )
        updated = map_service.update_map(test_map.id, update_data, test_user.id)

        assert updated is not None
        assert updated.view_permission == "public"
        assert updated.edit_permission == "public"

    def test_can_view_nonexistent_map(self, map_service, test_user):
        """Test can_view_map returns False for nonexistent map"""
        fake_id = uuid4()
        result = map_service.can_view_map(fake_id, test_user.id)
        assert result is False

    def test_can_edit_nonexistent_map(self, map_service, test_user):
        """Test can_edit_map returns False for nonexistent map"""
        fake_id = uuid4()
        result = map_service.can_edit_map(fake_id, test_user.id)
        assert result is False
