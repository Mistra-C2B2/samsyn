"""
Integration tests for TiTiler proxy with URL whitelist enforcement.

Tests that TiTiler endpoints only allow whitelisted URLs from the database.
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.database import get_db
from app.main import app
from app.models.layer import Layer
from app.models.user import User


@pytest.fixture
def client(db_session):
    """Create test client with database override."""

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_session):
    """Create a test user."""
    user = User(
        clerk_id="user_titiler_test",
        email="titiler@example.com",
        username="titilertest",
        first_name="TiTiler",
        last_name="Test",
    )
    db_session.add(user)
    db_session.flush()
    db_session.refresh(user)
    return user


@pytest.fixture
def whitelisted_layer(db_session, test_user):
    """Create a GeoTIFF layer with whitelisted URL."""
    layer = Layer(
        name="Whitelisted Layer",
        source_type="geotiff",
        description="Layer with whitelisted URL",
        created_by=test_user.id,
        source_config={"cog_url": "https://example.com/allowed.tif"},
    )
    db_session.add(layer)
    db_session.flush()
    db_session.refresh(layer)
    return layer


@pytest.fixture
def template_layer(db_session, test_user):
    """Create a GeoTIFF layer with template URL."""
    layer = Layer(
        name="Template Layer",
        source_type="geotiff",
        description="Layer with template URL",
        created_by=test_user.id,
        source_config={"cog_url_template": "https://tiles.example.com/{z}/{x}/{y}.tif"},
    )
    db_session.add(layer)
    db_session.flush()
    db_session.refresh(layer)
    return layer


@pytest.fixture
def mock_titiler_image_response():
    """Mock successful TiTiler image response."""
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.content = b"fake_png_data"
    mock_response.headers = {"content-type": "image/png"}

    # Mock raise_for_status to do nothing (success)
    async def mock_raise_for_status():
        pass

    mock_response.raise_for_status = mock_raise_for_status

    return mock_response


@pytest.fixture
def mock_titiler_json_response():
    """Mock successful TiTiler JSON response."""
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.headers = {"content-type": "application/json"}

    # Mock raise_for_status to do nothing (success)
    async def mock_raise_for_status():
        pass

    mock_response.raise_for_status = mock_raise_for_status

    # Mock json() to return data directly (not a coroutine)
    def mock_json():
        return {
            "bounds": [-180, -90, 180, 90],
            "minzoom": 0,
            "maxzoom": 22,
        }

    mock_response.json = mock_json

    return mock_response


# ============================================================================
# Tile Endpoint Tests
# ============================================================================


class TestTileEndpoint:
    """Tests for GET /api/v1/titiler/tiles/{z}/{x}/{y}"""

    @patch("app.api.v1.titiler.settings.TITILER_URL", "http://titiler:8000")
    @patch("app.api.v1.titiler.httpx.AsyncClient")
    async def test_whitelisted_url_succeeds(
        self,
        mock_client,
        client,
        db_session,
        whitelisted_layer,
        mock_titiler_image_response,
    ):
        """Test whitelisted URL succeeds."""
        # Mock httpx client
        mock_client_instance = AsyncMock()
        mock_client_instance.__aenter__.return_value = mock_client_instance
        mock_client_instance.__aexit__.return_value = None
        mock_client_instance.get.return_value = mock_titiler_image_response
        mock_client.return_value = mock_client_instance

        # Make request with whitelisted URL
        response = client.get(
            "/api/v1/titiler/tiles/10/500/500",
            params={"url": "https://example.com/allowed.tif"},
        )

        assert response.status_code == 200
        assert response.content == b"fake_png_data"

    def test_non_whitelisted_url_rejected(self, client, db_session):
        """Test non-whitelisted URL returns 403."""
        # Make request with non-whitelisted URL
        response = client.get(
            "/api/v1/titiler/tiles/10/500/500",
            params={"url": "https://evil.com/malicious.tif"},
        )

        assert response.status_code == 403
        assert "not authorized" in response.json()["detail"].lower()

    @patch("app.api.v1.titiler.settings.TITILER_URL", "http://titiler:8000")
    @patch("app.api.v1.titiler.httpx.AsyncClient")
    async def test_template_url_succeeds(
        self,
        mock_client,
        client,
        db_session,
        template_layer,
        mock_titiler_image_response,
    ):
        """Test template URL matching succeeds."""
        # Mock httpx client
        mock_client_instance = AsyncMock()
        mock_client_instance.__aenter__.return_value = mock_client_instance
        mock_client_instance.__aexit__.return_value = None
        mock_client_instance.get.return_value = mock_titiler_image_response
        mock_client.return_value = mock_client_instance

        # Make request with URL matching template
        response = client.get(
            "/api/v1/titiler/tiles/10/500/500",
            params={"url": "https://tiles.example.com/10/500/500.tif"},
        )

        assert response.status_code == 200

    def test_template_url_no_match_rejected(self, client, db_session, template_layer):
        """Test non-matching template URL is rejected."""
        # Make request with URL not matching template
        response = client.get(
            "/api/v1/titiler/tiles/10/500/500",
            params={"url": "https://different.example.com/10/500/500.tif"},
        )

        assert response.status_code == 403

    def test_unauthenticated_access_allowed_for_whitelisted(
        self, client, db_session, whitelisted_layer
    ):
        """Test unauthenticated users can access whitelisted URLs."""
        # No authentication headers - should still work if URL is whitelisted
        # Note: This will fail at TiTiler connection, but should pass whitelist check
        response = client.get(
            "/api/v1/titiler/tiles/10/500/500",
            params={"url": "https://example.com/allowed.tif"},
        )

        # Should not return 401 (auth required)
        # Will return 503 (TiTiler not configured) or 502 (connection failed)
        # but NOT 403 (whitelist rejection) since URL is whitelisted
        assert response.status_code != 401
        assert response.status_code != 403

    def test_titiler_not_configured(self, client, db_session, whitelisted_layer):
        """Test 503 when TiTiler URL not configured."""
        with patch("app.api.v1.titiler.settings.TITILER_URL", ""):
            response = client.get(
                "/api/v1/titiler/tiles/10/500/500",
                params={"url": "https://example.com/allowed.tif"},
            )

            assert response.status_code == 503
            assert "not configured" in response.json()["detail"].lower()


# ============================================================================
# Info Endpoint Tests
# ============================================================================


class TestInfoEndpoint:
    """Tests for GET /api/v1/titiler/info"""

    @patch("app.api.v1.titiler.settings.TITILER_URL", "http://titiler:8000")
    @patch("app.api.v1.titiler.httpx.AsyncClient")
    async def test_whitelisted_url_succeeds(
        self,
        mock_client,
        client,
        db_session,
        whitelisted_layer,
        mock_titiler_json_response,
    ):
        """Test whitelisted URL succeeds."""
        # Mock httpx client
        mock_client_instance = AsyncMock()
        mock_client_instance.__aenter__.return_value = mock_client_instance
        mock_client_instance.__aexit__.return_value = None
        mock_client_instance.get.return_value = mock_titiler_json_response
        mock_client.return_value = mock_client_instance

        response = client.get(
            "/api/v1/titiler/info", params={"url": "https://example.com/allowed.tif"}
        )

        assert response.status_code == 200

    def test_non_whitelisted_url_rejected(self, client, db_session):
        """Test non-whitelisted URL returns 403."""
        response = client.get(
            "/api/v1/titiler/info", params={"url": "https://evil.com/malicious.tif"}
        )

        assert response.status_code == 403


# ============================================================================
# Statistics Endpoint Tests
# ============================================================================


class TestStatisticsEndpoint:
    """Tests for GET /api/v1/titiler/statistics"""

    @patch("app.api.v1.titiler.settings.TITILER_URL", "http://titiler:8000")
    @patch("app.api.v1.titiler.httpx.AsyncClient")
    async def test_whitelisted_url_succeeds(
        self,
        mock_client,
        client,
        db_session,
        whitelisted_layer,
        mock_titiler_json_response,
    ):
        """Test whitelisted URL succeeds."""
        # Mock httpx client
        mock_client_instance = AsyncMock()
        mock_client_instance.__aenter__.return_value = mock_client_instance
        mock_client_instance.__aexit__.return_value = None
        mock_client_instance.get.return_value = mock_titiler_json_response
        mock_client.return_value = mock_client_instance

        response = client.get(
            "/api/v1/titiler/statistics",
            params={"url": "https://example.com/allowed.tif"},
        )

        assert response.status_code == 200

    def test_non_whitelisted_url_rejected(self, client, db_session):
        """Test non-whitelisted URL returns 403."""
        response = client.get(
            "/api/v1/titiler/statistics",
            params={"url": "https://evil.com/malicious.tif"},
        )

        assert response.status_code == 403


# ============================================================================
# Preview Endpoint Tests
# ============================================================================


class TestPreviewEndpoint:
    """Tests for GET /api/v1/titiler/preview"""

    @patch("app.api.v1.titiler.settings.TITILER_URL", "http://titiler:8000")
    @patch("app.api.v1.titiler.httpx.AsyncClient")
    async def test_whitelisted_url_succeeds(
        self,
        mock_client,
        client,
        db_session,
        whitelisted_layer,
        mock_titiler_image_response,
    ):
        """Test whitelisted URL succeeds."""
        # Mock httpx client
        mock_client_instance = AsyncMock()
        mock_client_instance.__aenter__.return_value = mock_client_instance
        mock_client_instance.__aexit__.return_value = None
        mock_client_instance.get.return_value = mock_titiler_image_response
        mock_client.return_value = mock_client_instance

        response = client.get(
            "/api/v1/titiler/preview", params={"url": "https://example.com/allowed.tif"}
        )

        assert response.status_code == 200

    def test_non_whitelisted_url_rejected(self, client, db_session):
        """Test non-whitelisted URL returns 403."""
        response = client.get(
            "/api/v1/titiler/preview", params={"url": "https://evil.com/malicious.tif"}
        )

        assert response.status_code == 403


# ============================================================================
# URL Normalization Tests
# ============================================================================


class TestURLNormalization:
    """Tests for URL normalization during whitelist checking."""

    @patch("app.api.v1.titiler.settings.TITILER_URL", "http://titiler:8000")
    @patch("app.api.v1.titiler.httpx.AsyncClient")
    async def test_trailing_slash_normalized(
        self,
        mock_client,
        client,
        db_session,
        whitelisted_layer,
        mock_titiler_json_response,
    ):
        """Test URL with trailing slash is normalized and matches."""
        # Mock httpx client
        mock_client_instance = AsyncMock()
        mock_client_instance.__aenter__.return_value = mock_client_instance
        mock_client_instance.__aexit__.return_value = None
        mock_client_instance.get.return_value = mock_titiler_json_response
        mock_client.return_value = mock_client_instance

        # URL in DB: https://example.com/allowed.tif
        # Request with trailing slash - should normalize and match
        response = client.get(
            "/api/v1/titiler/info",
            params={"url": "https://example.com/allowed.tif/"},
        )

        assert response.status_code == 200

    @patch("app.api.v1.titiler.settings.TITILER_URL", "http://titiler:8000")
    @patch("app.api.v1.titiler.httpx.AsyncClient")
    async def test_case_insensitive_domain(
        self,
        mock_client,
        client,
        db_session,
        whitelisted_layer,
        mock_titiler_json_response,
    ):
        """Test domain case insensitivity."""
        # Mock httpx client
        mock_client_instance = AsyncMock()
        mock_client_instance.__aenter__.return_value = mock_client_instance
        mock_client_instance.__aexit__.return_value = None
        mock_client_instance.get.return_value = mock_titiler_json_response
        mock_client.return_value = mock_client_instance

        # URL in DB: https://example.com/allowed.tif
        # Request with uppercase domain - should normalize and match
        response = client.get(
            "/api/v1/titiler/info",
            params={"url": "https://EXAMPLE.COM/allowed.tif"},
        )

        assert response.status_code == 200
