"""
Integration tests for Clerk webhook endpoint.

Tests webhook event handling, signature verification, and user synchronization.
Uses PostgreSQL test database with transaction rollback for isolation.
"""

import pytest
from unittest.mock import patch, Mock
from fastapi.testclient import TestClient

from app.main import app
from app.database import get_db
from app.services.user_service import UserService
from app.models.user import User


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
def mock_webhook_secret():
    """Mock webhook secret for testing"""
    return "whsec_test_secret"


@pytest.fixture
def user_created_payload():
    """Sample user.created webhook payload from Clerk"""
    return {
        "type": "user.created",
        "data": {
            "id": "user_test123",
            "email_addresses": [
                {
                    "id": "email_123",
                    "email_address": "test@example.com",
                }
            ],
            "primary_email_address_id": "email_123",
            "username": "testuser",
            "first_name": "Test",
            "last_name": "User",
            "profile_image_url": "https://example.com/avatar.jpg",
        },
    }


@pytest.fixture
def user_updated_payload():
    """Sample user.updated webhook payload"""
    return {
        "type": "user.updated",
        "data": {
            "id": "user_test123",
            "email_addresses": [
                {
                    "id": "email_123",
                    "email_address": "updated@example.com",
                }
            ],
            "primary_email_address_id": "email_123",
            "username": "updateduser",
            "first_name": "Updated",
            "last_name": "Name",
        },
    }


@pytest.fixture
def user_deleted_payload():
    """Sample user.deleted webhook payload"""
    return {
        "type": "user.deleted",
        "data": {
            "id": "user_test123",
        },
    }


class TestWebhookSignatureVerification:
    """Test webhook signature verification"""

    def test_webhook_fails_without_secret(self, client, user_created_payload):
        """Test webhook fails when secret not configured"""
        with patch("app.config.settings.CLERK_WEBHOOK_SECRET", ""):
            response = client.post(
                "/api/v1/webhooks/clerk",
                json=user_created_payload,
                headers={
                    "svix-id": "msg_test",
                    "svix-timestamp": "1234567890",
                    "svix-signature": "v1,test_signature",
                },
            )
            assert response.status_code == 500
            assert "not configured" in response.json()["detail"]

    def test_webhook_fails_invalid_signature(self, client, user_created_payload, mock_webhook_secret):
        """Test webhook fails with invalid signature"""
        from svix.webhooks import WebhookVerificationError

        with patch("app.config.settings.CLERK_WEBHOOK_SECRET", mock_webhook_secret):
            # Mock the entire Webhook class
            with patch("app.api.v1.webhooks.Webhook") as mock_webhook_class:
                mock_webhook_instance = Mock()
                mock_webhook_instance.verify.side_effect = WebhookVerificationError("Invalid signature")
                mock_webhook_class.return_value = mock_webhook_instance

                response = client.post(
                    "/api/v1/webhooks/clerk",
                    json=user_created_payload,
                    headers={
                        "svix-id": "msg_test",
                        "svix-timestamp": "1234567890",
                        "svix-signature": "v1,invalid_signature",
                    },
                )
                assert response.status_code == 400
                assert "verification failed" in response.json()["detail"].lower()


class TestUserCreatedEvent:
    """Test user.created webhook event"""

    def test_user_created_success(self, client, user_created_payload, mock_webhook_secret, db_session):
        """Test successful user creation from webhook"""
        with patch("app.config.settings.CLERK_WEBHOOK_SECRET", mock_webhook_secret):
            # Mock the entire Webhook class
            with patch("app.api.v1.webhooks.Webhook") as mock_webhook_class:
                mock_webhook_instance = Mock()
                mock_webhook_instance.verify.return_value = user_created_payload
                mock_webhook_class.return_value = mock_webhook_instance

                response = client.post(
                    "/api/v1/webhooks/clerk",
                    json=user_created_payload,
                    headers={
                        "svix-id": "msg_test",
                        "svix-timestamp": "1234567890",
                        "svix-signature": "v1,valid_signature",
                    },
                )

                assert response.status_code == 200
                assert response.json()["status"] == "success"

                # Verify user was created in database
                user_service = UserService(db_session)
                user = user_service.get_by_clerk_id("user_test123")
                assert user is not None
                assert user.email == "test@example.com"
                assert user.username == "testuser"
                assert user.first_name == "Test"

    def test_user_created_duplicate_webhook(self, client, user_created_payload, mock_webhook_secret, db_session):
        """Test duplicate webhook delivery is handled gracefully"""
        with patch("app.config.settings.CLERK_WEBHOOK_SECRET", mock_webhook_secret):
            # Mock the entire Webhook class
            with patch("app.api.v1.webhooks.Webhook") as mock_webhook_class:
                mock_webhook_instance = Mock()
                mock_webhook_instance.verify.return_value = user_created_payload
                mock_webhook_class.return_value = mock_webhook_instance

                # First webhook delivery
                response1 = client.post(
                    "/api/v1/webhooks/clerk",
                    json=user_created_payload,
                    headers={
                        "svix-id": "msg_test1",
                        "svix-timestamp": "1234567890",
                        "svix-signature": "v1,valid_signature",
                    },
                )
                assert response1.status_code == 200

                # Duplicate webhook delivery
                response2 = client.post(
                    "/api/v1/webhooks/clerk",
                    json=user_created_payload,
                    headers={
                        "svix-id": "msg_test2",
                        "svix-timestamp": "1234567891",
                        "svix-signature": "v1,valid_signature",
                    },
                )
                assert response2.status_code == 200

                # Verify only one user exists
                user_service = UserService(db_session)
                users = db_session.query(User).filter_by(clerk_id="user_test123").all()
                assert len(users) == 1  # Only one user, not two

    def test_user_created_missing_required_data(self, client, mock_webhook_secret):
        """Test webhook fails gracefully when required data is missing"""
        invalid_payload = {
            "type": "user.created",
            "data": {
                "id": "user_test456",
                # Missing email_addresses
            },
        }

        with patch("app.config.settings.CLERK_WEBHOOK_SECRET", mock_webhook_secret):
            # Mock the entire Webhook class
            with patch("app.api.v1.webhooks.Webhook") as mock_webhook_class:
                mock_webhook_instance = Mock()
                mock_webhook_instance.verify.return_value = invalid_payload
                mock_webhook_class.return_value = mock_webhook_instance

                response = client.post(
                    "/api/v1/webhooks/clerk",
                    json=invalid_payload,
                    headers={
                        "svix-id": "msg_test",
                        "svix-timestamp": "1234567890",
                        "svix-signature": "v1,valid_signature",
                    },
                )

                # Should return 200 but with error status
                # (to prevent Clerk retries on bad data)
                assert response.status_code == 200
                assert response.json()["status"] == "error"


class TestUserUpdatedEvent:
    """Test user.updated webhook event"""

    def test_user_updated_success(self, client, user_created_payload, user_updated_payload, mock_webhook_secret, db_session):
        """Test successful user update from webhook"""
        # First create the user
        user_service = UserService(db_session)
        from app.schemas.user import UserCreate

        user_data = UserCreate(
            clerk_id="user_test123",
            email="test@example.com",
            username="testuser",
            first_name="Test",
            last_name="User",
        )
        user_service.create_user(user_data)

        # Now update via webhook
        with patch("app.config.settings.CLERK_WEBHOOK_SECRET", mock_webhook_secret):
            # Mock the entire Webhook class
            with patch("app.api.v1.webhooks.Webhook") as mock_webhook_class:
                mock_webhook_instance = Mock()
                mock_webhook_instance.verify.return_value = user_updated_payload
                mock_webhook_class.return_value = mock_webhook_instance

                response = client.post(
                    "/api/v1/webhooks/clerk",
                    json=user_updated_payload,
                    headers={
                        "svix-id": "msg_test",
                        "svix-timestamp": "1234567890",
                        "svix-signature": "v1,valid_signature",
                    },
                )

                assert response.status_code == 200

                # Verify user was updated
                user = user_service.get_by_clerk_id("user_test123")
                assert user.email == "updated@example.com"
                assert user.username == "updateduser"
                assert user.first_name == "Updated"

    def test_user_updated_nonexistent_user(self, client, user_updated_payload, mock_webhook_secret):
        """Test updating non-existent user"""
        with patch("app.config.settings.CLERK_WEBHOOK_SECRET", mock_webhook_secret):
            # Mock the entire Webhook class
            with patch("app.api.v1.webhooks.Webhook") as mock_webhook_class:
                mock_webhook_instance = Mock()
                mock_webhook_instance.verify.return_value = user_updated_payload
                mock_webhook_class.return_value = mock_webhook_instance

                response = client.post(
                    "/api/v1/webhooks/clerk",
                    json=user_updated_payload,
                    headers={
                        "svix-id": "msg_test",
                        "svix-timestamp": "1234567890",
                        "svix-signature": "v1,valid_signature",
                    },
                )

                # Should return 200 (acknowledges webhook)
                assert response.status_code == 200


class TestUserDeletedEvent:
    """Test user.deleted webhook event"""

    def test_user_deleted_success(self, client, user_deleted_payload, mock_webhook_secret, db_session):
        """Test successful user deletion from webhook"""
        # Create user first
        user_service = UserService(db_session)
        from app.schemas.user import UserCreate

        user_data = UserCreate(
            clerk_id="user_test123",
            email="test@example.com",
            username="testuser",
        )
        user_service.create_user(user_data)

        # Delete via webhook
        with patch("app.config.settings.CLERK_WEBHOOK_SECRET", mock_webhook_secret):
            # Mock the entire Webhook class
            with patch("app.api.v1.webhooks.Webhook") as mock_webhook_class:
                mock_webhook_instance = Mock()
                mock_webhook_instance.verify.return_value = user_deleted_payload
                mock_webhook_class.return_value = mock_webhook_instance

                response = client.post(
                    "/api/v1/webhooks/clerk",
                    json=user_deleted_payload,
                    headers={
                        "svix-id": "msg_test",
                        "svix-timestamp": "1234567890",
                        "svix-signature": "v1,valid_signature",
                    },
                )

                assert response.status_code == 200

                # Verify user was deleted
                user = user_service.get_by_clerk_id("user_test123")
                assert user is None

                # Verify placeholder was created
                placeholder = user_service.get_by_clerk_id(UserService.DELETED_USER_CLERK_ID)
                assert placeholder is not None

    def test_user_deleted_with_ownership_transfer(self, client, user_deleted_payload, mock_webhook_secret, db_session):
        """Test user deletion transfers ownership to placeholder"""
        # Create user and some content
        user_service = UserService(db_session)
        from app.schemas.user import UserCreate
        from app.models.map import Map

        user_data = UserCreate(
            clerk_id="user_test123",
            email="test@example.com",
        )
        user = user_service.create_user(user_data)

        # Create map owned by user
        user_map = Map(
            name="Test Map",
            created_by=user.id,
        )
        db_session.add(user_map)
        db_session.commit()

        # Delete via webhook
        with patch("app.config.settings.CLERK_WEBHOOK_SECRET", mock_webhook_secret):
            # Mock the entire Webhook class
            with patch("app.api.v1.webhooks.Webhook") as mock_webhook_class:
                mock_webhook_instance = Mock()
                mock_webhook_instance.verify.return_value = user_deleted_payload
                mock_webhook_class.return_value = mock_webhook_instance

                response = client.post(
                    "/api/v1/webhooks/clerk",
                    json=user_deleted_payload,
                    headers={
                        "svix-id": "msg_test",
                        "svix-timestamp": "1234567890",
                        "svix-signature": "v1,valid_signature",
                    },
                )

                assert response.status_code == 200

                # Verify map ownership was transferred
                placeholder = user_service.get_by_clerk_id(UserService.DELETED_USER_CLERK_ID)
                db_session.refresh(user_map)
                assert user_map.created_by == placeholder.id


class TestUnknownEvents:
    """Test handling of unknown webhook events"""

    def test_unknown_event_type(self, client, mock_webhook_secret):
        """Test unknown event types are logged but don't fail"""
        unknown_payload = {
            "type": "user.unknown_event",
            "data": {"id": "user_test"},
        }

        with patch("app.config.settings.CLERK_WEBHOOK_SECRET", mock_webhook_secret):
            # Mock the entire Webhook class
            with patch("app.api.v1.webhooks.Webhook") as mock_webhook_class:
                mock_webhook_instance = Mock()
                mock_webhook_instance.verify.return_value = unknown_payload
                mock_webhook_class.return_value = mock_webhook_instance

                response = client.post(
                    "/api/v1/webhooks/clerk",
                    json=unknown_payload,
                    headers={
                        "svix-id": "msg_test",
                        "svix-timestamp": "1234567890",
                        "svix-signature": "v1,valid_signature",
                    },
                )

                # Should acknowledge webhook even for unknown events
                assert response.status_code == 200
