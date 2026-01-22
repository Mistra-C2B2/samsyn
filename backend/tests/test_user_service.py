"""
Unit tests for user service.

Tests user CRUD operations, deleted user placeholder, and idempotency.
Uses PostgreSQL test database with transaction rollback for isolation.
"""

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.map import Map
from app.schemas.user import UserCreate, UserUpdate
from app.services.user_service import UserService


@pytest.fixture
def user_service(db_session):
    """Create user service instance"""
    return UserService(db_session)


@pytest.fixture
def sample_user_data():
    """Sample user data for testing"""
    return UserCreate(
        clerk_id="user_test123",
        email="test@example.com",
        username="testuser",
        first_name="Test",
        last_name="User",
        profile_image_url="https://example.com/avatar.jpg",
    )


class TestUserCreation:
    """Test user creation"""

    def test_create_user(self, user_service, sample_user_data):
        """Test creating a new user"""
        user = user_service.create_user(sample_user_data)

        assert user.clerk_id == "user_test123"
        assert user.email == "test@example.com"
        assert user.username == "testuser"
        assert user.first_name == "Test"
        assert user.last_name == "User"
        assert user.id is not None

    def test_create_duplicate_user_fails(self, user_service, sample_user_data):
        """Test that creating duplicate user fails"""
        # Create first user
        user_service.create_user(sample_user_data)

        # Try to create duplicate - should fail
        with pytest.raises(IntegrityError):
            user_service.create_user(sample_user_data)


class TestUserRetrieval:
    """Test user retrieval operations"""

    def test_get_by_clerk_id(self, user_service, sample_user_data):
        """Test getting user by Clerk ID"""
        # Create user
        created_user = user_service.create_user(sample_user_data)

        # Retrieve by clerk_id
        retrieved_user = user_service.get_by_clerk_id("user_test123")

        assert retrieved_user is not None
        assert retrieved_user.id == created_user.id
        assert retrieved_user.clerk_id == "user_test123"

    def test_get_by_clerk_id_not_found(self, user_service):
        """Test getting non-existent user returns None"""
        user = user_service.get_by_clerk_id("non_existent_user")
        assert user is None

    def test_get_by_id(self, user_service, sample_user_data):
        """Test getting user by internal ID"""
        # Create user
        created_user = user_service.create_user(sample_user_data)

        # Retrieve by id
        retrieved_user = user_service.get_by_id(created_user.id)

        assert retrieved_user is not None
        assert retrieved_user.id == created_user.id

    def test_get_by_id_not_found(self, user_service):
        """Test getting non-existent user by ID returns None"""
        from uuid import uuid4

        user = user_service.get_by_id(uuid4())
        assert user is None


class TestUserUpdate:
    """Test user update operations"""

    def test_update_user(self, user_service, sample_user_data):
        """Test updating user profile"""
        # Create user
        user_service.create_user(sample_user_data)

        # Update user
        update_data = UserUpdate(
            email="updated@example.com",
            first_name="Updated",
            last_name="Name",
        )
        updated_user = user_service.update_user("user_test123", update_data)

        assert updated_user is not None
        assert updated_user.email == "updated@example.com"
        assert updated_user.first_name == "Updated"
        assert updated_user.last_name == "Name"
        # Username should remain unchanged
        assert updated_user.username == "testuser"

    def test_update_partial_fields(self, user_service, sample_user_data):
        """Test updating only some fields"""
        # Create user
        user_service.create_user(sample_user_data)

        # Update only email
        update_data = UserUpdate(email="newemail@example.com")
        updated_user = user_service.update_user("user_test123", update_data)

        assert updated_user.email == "newemail@example.com"
        assert updated_user.first_name == "Test"  # Unchanged
        assert updated_user.username == "testuser"  # Unchanged

    def test_update_nonexistent_user(self, user_service):
        """Test updating non-existent user returns None"""
        update_data = UserUpdate(email="test@example.com")
        result = user_service.update_user("non_existent_user", update_data)

        assert result is None


class TestGetOrCreate:
    """Test get_or_create idempotency"""

    def test_get_or_create_new_user(self, user_service, sample_user_data):
        """Test get_or_create creates new user"""
        user, created = user_service.get_or_create("user_test123", sample_user_data)

        assert created is True
        assert user.clerk_id == "user_test123"

    def test_get_or_create_existing_user(self, user_service, sample_user_data):
        """Test get_or_create returns existing user"""
        # Create user first
        first_user = user_service.create_user(sample_user_data)

        # Try to get_or_create again
        user, created = user_service.get_or_create("user_test123", sample_user_data)

        assert created is False
        assert user.id == first_user.id

    def test_get_or_create_idempotency(self, user_service, sample_user_data):
        """Test get_or_create is idempotent"""
        # Call multiple times
        user1, created1 = user_service.get_or_create("user_test123", sample_user_data)
        user2, created2 = user_service.get_or_create("user_test123", sample_user_data)
        user3, created3 = user_service.get_or_create("user_test123", sample_user_data)

        # Only first call should create
        assert created1 is True
        assert created2 is False
        assert created3 is False

        # All should return same user
        assert user1.id == user2.id == user3.id


class TestDeletedUserPlaceholder:
    """Test deleted user placeholder management"""

    def test_get_or_create_deleted_user_placeholder(self, user_service):
        """Test creating deleted user placeholder"""
        placeholder = user_service.get_or_create_deleted_user_placeholder()

        assert placeholder is not None
        assert placeholder.clerk_id == UserService.DELETED_USER_CLERK_ID
        assert placeholder.email == UserService.DELETED_USER_EMAIL
        assert placeholder.username == "Deleted User"

    def test_deleted_user_placeholder_idempotency(self, user_service):
        """Test placeholder is created only once"""
        placeholder1 = user_service.get_or_create_deleted_user_placeholder()
        placeholder2 = user_service.get_or_create_deleted_user_placeholder()

        assert placeholder1.id == placeholder2.id


class TestUserDeletion:
    """Test user deletion with ownership reassignment"""

    def test_delete_user_simple(self, user_service, sample_user_data):
        """Test deleting a user"""
        # Create user
        user_service.create_user(sample_user_data)

        # Delete user
        deleted = user_service.delete_user("user_test123")

        assert deleted is True

        # Verify user is gone
        user = user_service.get_by_clerk_id("user_test123")
        assert user is None

    def test_delete_nonexistent_user(self, user_service):
        """Test deleting non-existent user returns False"""
        deleted = user_service.delete_user("non_existent_user")
        assert deleted is False

    def test_delete_user_reassigns_ownership(
        self, user_service, sample_user_data, db_session
    ):
        """Test that deleting user reassigns ownership to placeholder"""
        # Create user
        user = user_service.create_user(sample_user_data)

        # Create some content owned by this user
        user_map = Map(
            name="Test Map",
            description="Test Description",
            created_by=user.id,
        )
        db_session.add(user_map)
        db_session.flush()

        # Delete user
        user_service.delete_user("user_test123")

        # Verify placeholder was created
        placeholder = user_service.get_or_create_deleted_user_placeholder()

        # Verify map ownership was transferred
        db_session.refresh(user_map)
        assert user_map.created_by == placeholder.id

    def test_delete_user_preserves_collaborator_data(
        self, user_service, sample_user_data, db_session
    ):
        """Test that deleting user preserves data for collaborators"""
        # Create owner and collaborator
        owner = user_service.create_user(sample_user_data)

        collaborator_data = UserCreate(
            clerk_id="user_collab456",
            email="collab@example.com",
            username="collaborator",
        )
        user_service.create_user(collaborator_data)

        # Create map owned by first user
        owner_map = Map(
            name="Shared Map",
            description="Map with collaborators",
            created_by=owner.id,
        )
        db_session.add(owner_map)
        db_session.flush()

        # Delete owner
        user_service.delete_user("user_test123")

        # Map should still exist (owned by placeholder)
        db_session.refresh(owner_map)
        assert owner_map is not None
        placeholder = user_service.get_by_clerk_id(UserService.DELETED_USER_CLERK_ID)
        assert owner_map.created_by == placeholder.id

        # Collaborator should still exist
        still_exists = user_service.get_by_clerk_id("user_collab456")
        assert still_exists is not None


class TestEdgeCases:
    """Test edge cases and error handling"""

    def test_create_user_with_minimal_data(self, user_service):
        """Test creating user with only required fields"""
        minimal_data = UserCreate(
            clerk_id="user_minimal",
            email="minimal@example.com",
        )

        user = user_service.create_user(minimal_data)

        assert user.clerk_id == "user_minimal"
        assert user.email == "minimal@example.com"
        assert user.username is None
        assert user.first_name is None

    def test_update_user_empty_update(self, user_service, sample_user_data):
        """Test updating user with no fields (should be no-op)"""
        # Create user
        user_service.create_user(sample_user_data)

        # Update with empty data
        update_data = UserUpdate()
        updated_user = user_service.update_user("user_test123", update_data)

        # User should be unchanged
        assert updated_user.email == "test@example.com"
        assert updated_user.username == "testuser"
