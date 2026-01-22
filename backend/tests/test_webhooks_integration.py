"""
Integration tests for Clerk webhook endpoints.

Tests the full webhook flow including database operations.
Uses the test endpoint (no signature verification) for local testing.
"""

import pytest
from fastapi.testclient import TestClient

from app.database import get_db
from app.main import app
from app.models.map import Map
from app.models.user import User
from app.services.user_service import UserService


@pytest.fixture
def client(db_session):
    """Create test client with database override"""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def user_service(db_session):
    """Create user service instance"""
    return UserService(db_session)


class TestWebhookIntegrationUserCreated:
    """Integration tests for user.created webhook event"""

    def test_create_user_full_flow(self, client, db_session, user_service):
        """Test complete user creation flow through webhook"""
        payload = {
            "type": "user.created",
            "data": {
                "id": "user_integration_test_001",
                "email_addresses": [
                    {
                        "id": "email_001",
                        "email_address": "integration@example.com",
                    }
                ],
                "primary_email_address_id": "email_001",
                "username": "integrationtest",
                "first_name": "Integration",
                "last_name": "Test",
                "profile_image_url": "https://example.com/avatar.jpg",
            },
        }

        # Send webhook via test endpoint
        response = client.post("/api/v1/test-webhooks/clerk", json=payload)

        # Verify response
        assert response.status_code == 200
        json_response = response.json()
        assert json_response["status"] == "success"
        assert json_response["event"] == "user.created"
        assert json_response["created"] is True

        # Verify user in database
        user = user_service.get_by_clerk_id("user_integration_test_001")
        assert user is not None
        assert user.email == "integration@example.com"
        assert user.username == "integrationtest"
        assert user.first_name == "Integration"
        assert user.last_name == "Test"
        assert user.profile_image_url == "https://example.com/avatar.jpg"

    def test_create_user_duplicate_webhook(self, client, db_session, user_service):
        """Test that duplicate webhook deliveries are handled gracefully"""
        payload = {
            "type": "user.created",
            "data": {
                "id": "user_integration_test_002",
                "email_addresses": [
                    {
                        "id": "email_002",
                        "email_address": "duplicate@example.com",
                    }
                ],
                "primary_email_address_id": "email_002",
                "username": "duplicatetest",
            },
        }

        # First webhook delivery
        response1 = client.post("/api/v1/test-webhooks/clerk", json=payload)
        assert response1.status_code == 200
        assert response1.json()["created"] is True

        # Second webhook delivery (duplicate)
        response2 = client.post("/api/v1/test-webhooks/clerk", json=payload)
        assert response2.status_code == 200
        assert response2.json()["created"] is False  # Not created, found existing

        # Verify only one user exists
        users = (
            db_session.query(User).filter_by(clerk_id="user_integration_test_002").all()
        )
        assert len(users) == 1


class TestWebhookIntegrationUserUpdated:
    """Integration tests for user.updated webhook event"""

    def test_update_user_full_flow(self, client, db_session, user_service):
        """Test complete user update flow through webhook"""
        # First create a user
        from app.schemas.user import UserCreate

        user_data = UserCreate(
            clerk_id="user_integration_test_003",
            email="original@example.com",
            username="original",
            first_name="Original",
            last_name="Name",
        )
        user_service.create_user(user_data)

        # Now update via webhook
        payload = {
            "type": "user.updated",
            "data": {
                "id": "user_integration_test_003",
                "email_addresses": [
                    {
                        "id": "email_003",
                        "email_address": "updated@example.com",
                    }
                ],
                "primary_email_address_id": "email_003",
                "username": "updated",
                "first_name": "Updated",
                "last_name": "Name",
            },
        }

        response = client.post("/api/v1/test-webhooks/clerk", json=payload)

        # Verify response
        assert response.status_code == 200
        assert response.json()["status"] == "success"

        # Verify user was updated
        user = user_service.get_by_clerk_id("user_integration_test_003")
        assert user.email == "updated@example.com"
        assert user.username == "updated"
        assert user.first_name == "Updated"


class TestWebhookIntegrationUserDeleted:
    """Integration tests for user.deleted webhook event"""

    def test_delete_user_full_flow(self, client, db_session, user_service):
        """Test complete user deletion flow through webhook"""
        # Create a user
        from app.schemas.user import UserCreate

        user_data = UserCreate(
            clerk_id="user_integration_test_004",
            email="todelete@example.com",
            username="todelete",
        )
        user_service.create_user(user_data)

        # Delete via webhook
        payload = {
            "type": "user.deleted",
            "data": {
                "id": "user_integration_test_004",
            },
        }

        response = client.post("/api/v1/test-webhooks/clerk", json=payload)

        # Verify response
        assert response.status_code == 200
        assert response.json()["status"] == "success"

        # Verify user was deleted
        deleted_user = user_service.get_by_clerk_id("user_integration_test_004")
        assert deleted_user is None

        # Verify placeholder was created
        placeholder = user_service.get_by_clerk_id(UserService.DELETED_USER_CLERK_ID)
        assert placeholder is not None
        assert placeholder.clerk_id == "system_deleted_user"

    def test_delete_user_with_ownership_transfer(
        self, client, db_session, user_service
    ):
        """Test that user deletion transfers ownership to placeholder"""
        # Create a user
        from app.schemas.user import UserCreate

        user_data = UserCreate(
            clerk_id="user_integration_test_005",
            email="owner@example.com",
            username="owner",
        )
        user = user_service.create_user(user_data)

        # Create a map owned by this user
        user_map = Map(
            name="Test Map",
            description="Map to test ownership transfer",
            created_by=user.id,
        )
        db_session.add(user_map)
        db_session.flush()

        # Delete user via webhook
        payload = {
            "type": "user.deleted",
            "data": {
                "id": "user_integration_test_005",
            },
        }

        response = client.post("/api/v1/test-webhooks/clerk", json=payload)
        assert response.status_code == 200

        # Verify map ownership was transferred to placeholder
        placeholder = user_service.get_by_clerk_id(UserService.DELETED_USER_CLERK_ID)
        db_session.refresh(user_map)

        assert user_map.created_by == placeholder.id
        assert user_map.name == "Test Map"  # Map still exists


class TestWebhookIntegrationEndToEnd:
    """End-to-end integration tests for complete webhook lifecycle"""

    def test_complete_user_lifecycle(self, client, db_session, user_service):
        """Test create -> update -> delete lifecycle"""
        clerk_id = "user_lifecycle_test"

        # 1. Create user
        create_payload = {
            "type": "user.created",
            "data": {
                "id": clerk_id,
                "email_addresses": [
                    {"id": "email_lc", "email_address": "lifecycle@example.com"}
                ],
                "primary_email_address_id": "email_lc",
                "username": "lifecycle",
                "first_name": "Life",
                "last_name": "Cycle",
            },
        }

        response = client.post("/api/v1/test-webhooks/clerk", json=create_payload)
        assert response.status_code == 200
        assert response.json()["created"] is True

        user = user_service.get_by_clerk_id(clerk_id)
        assert user.username == "lifecycle"

        # 2. Update user
        update_payload = {
            "type": "user.updated",
            "data": {
                "id": clerk_id,
                "email_addresses": [
                    {"id": "email_lc", "email_address": "updated_lifecycle@example.com"}
                ],
                "primary_email_address_id": "email_lc",
                "username": "updated_lifecycle",
                "first_name": "Updated",
            },
        }

        response = client.post("/api/v1/test-webhooks/clerk", json=update_payload)
        assert response.status_code == 200

        user = user_service.get_by_clerk_id(clerk_id)
        assert user.username == "updated_lifecycle"
        assert user.first_name == "Updated"

        # 3. Delete user
        delete_payload = {
            "type": "user.deleted",
            "data": {"id": clerk_id},
        }

        response = client.post("/api/v1/test-webhooks/clerk", json=delete_payload)
        assert response.status_code == 200

        user = user_service.get_by_clerk_id(clerk_id)
        assert user is None

    def test_multiple_users_independent(self, client, db_session, user_service):
        """Test that multiple users can be managed independently"""
        # Create first user
        payload1 = {
            "type": "user.created",
            "data": {
                "id": "user_multi_001",
                "email_addresses": [{"id": "e1", "email_address": "user1@example.com"}],
                "primary_email_address_id": "e1",
                "username": "user1",
            },
        }

        # Create second user
        payload2 = {
            "type": "user.created",
            "data": {
                "id": "user_multi_002",
                "email_addresses": [{"id": "e2", "email_address": "user2@example.com"}],
                "primary_email_address_id": "e2",
                "username": "user2",
            },
        }

        # Create both users
        response1 = client.post("/api/v1/test-webhooks/clerk", json=payload1)
        response2 = client.post("/api/v1/test-webhooks/clerk", json=payload2)

        assert response1.status_code == 200
        assert response2.status_code == 200

        # Verify both exist
        user1 = user_service.get_by_clerk_id("user_multi_001")
        user2 = user_service.get_by_clerk_id("user_multi_002")

        assert user1 is not None
        assert user2 is not None
        assert user1.id != user2.id
        assert user1.username == "user1"
        assert user2.username == "user2"

        # Delete first user
        delete_payload = {
            "type": "user.deleted",
            "data": {"id": "user_multi_001"},
        }

        response = client.post("/api/v1/test-webhooks/clerk", json=delete_payload)
        assert response.status_code == 200

        # Verify first deleted, second still exists
        user1 = user_service.get_by_clerk_id("user_multi_001")
        user2 = user_service.get_by_clerk_id("user_multi_002")

        assert user1 is None
        assert user2 is not None
