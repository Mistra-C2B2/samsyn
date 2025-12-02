"""
Unit tests for Clerk authentication service.

Tests JWT verification, JWKS caching, and error handling.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from jose import jwt
from fastapi import HTTPException

from app.services.auth_service import ClerkAuthService


@pytest.fixture
def auth_service():
    """Create auth service instance for testing"""
    return ClerkAuthService(jwks_url="https://test.clerk.accounts.dev/.well-known/jwks.json")


@pytest.fixture
def mock_jwks():
    """Mock JWKS response from Clerk"""
    return {
        "keys": [
            {
                "kid": "test_key_1",
                "kty": "RSA",
                "use": "sig",
                "n": "test_n_value",
                "e": "AQAB",
            }
        ]
    }


@pytest.fixture
def valid_token_payload():
    """Valid JWT payload"""
    return {
        "sub": "user_test123",
        "email": "test@example.com",
        "username": "testuser",
        "first_name": "Test",
        "last_name": "User",
        "picture": "https://example.com/avatar.jpg",
    }


class TestJWKSFetching:
    """Test JWKS fetching and caching"""

    @pytest.mark.asyncio
    async def test_fetch_jwks_success(self, auth_service, mock_jwks):
        """Test successful JWKS fetch"""
        with patch("httpx.AsyncClient.get") as mock_get:
            # Mock successful HTTP response
            mock_response = Mock()
            mock_response.json.return_value = mock_jwks
            mock_response.raise_for_status = Mock()
            mock_get.return_value = mock_response

            # Use AsyncMock for async context manager
            mock_client = AsyncMock()
            mock_client.__aenter__.return_value.get = mock_get

            with patch("httpx.AsyncClient", return_value=mock_client):
                jwks = await auth_service.get_jwks()
                assert jwks == mock_jwks

    @pytest.mark.asyncio
    async def test_jwks_caching(self, auth_service, mock_jwks):
        """Test that JWKS is cached"""
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_response = Mock()
            mock_response.json.return_value = mock_jwks
            mock_response.raise_for_status = Mock()

            mock_get = AsyncMock(return_value=mock_response)
            mock_client.__aenter__.return_value.get = mock_get
            mock_client_class.return_value = mock_client

            # First call - should fetch
            jwks1 = await auth_service.get_jwks()
            assert mock_get.call_count == 1

            # Second call - should use cache
            jwks2 = await auth_service.get_jwks()
            assert mock_get.call_count == 1  # Still 1, not 2
            assert jwks1 == jwks2

    @pytest.mark.asyncio
    async def test_jwks_fetch_failure(self, auth_service):
        """Test handling of JWKS fetch failure"""
        import httpx

        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            # Raise httpx.HTTPError instead of generic Exception
            mock_client.__aenter__.return_value.get.side_effect = httpx.HTTPError("Network error")
            mock_client_class.return_value = mock_client

            with pytest.raises(HTTPException) as exc_info:
                await auth_service.get_jwks()

            assert exc_info.value.status_code == 503
            assert "Unable to fetch JWKS" in exc_info.value.detail


class TestJWTVerification:
    """Test JWT token verification"""

    @pytest.mark.asyncio
    async def test_verify_valid_token(self, auth_service, mock_jwks, valid_token_payload):
        """Test verification of valid JWT token"""
        # Mock JWKS fetch
        with patch.object(auth_service, "get_jwks", return_value=mock_jwks):
            # Mock JWT decoding
            with patch("app.services.auth_service.jwt") as mock_jwt:
                mock_jwt.get_unverified_header.return_value = {"kid": "test_key_1"}
                mock_jwt.decode.return_value = valid_token_payload

                payload = await auth_service.verify_token("valid_token")

                assert payload["sub"] == "user_test123"
                assert payload["email"] == "test@example.com"
                assert payload["username"] == "testuser"

    @pytest.mark.asyncio
    async def test_verify_token_missing_kid(self, auth_service, mock_jwks):
        """Test token verification fails when kid is missing"""
        with patch.object(auth_service, "get_jwks", return_value=mock_jwks):
            with patch("app.services.auth_service.jwt") as mock_jwt:
                # Mock token without kid
                mock_jwt.get_unverified_header.return_value = {}

                with pytest.raises(HTTPException) as exc_info:
                    await auth_service.verify_token("token_without_kid")

                assert exc_info.value.status_code == 401
                assert "missing key id" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_verify_token_key_not_found(self, auth_service, mock_jwks):
        """Test token verification fails when key not found in JWKS"""
        with patch.object(auth_service, "get_jwks", return_value=mock_jwks):
            with patch("app.services.auth_service.jwt") as mock_jwt:
                # Mock token with non-existent kid
                mock_jwt.get_unverified_header.return_value = {"kid": "non_existent_key"}

                with pytest.raises(HTTPException) as exc_info:
                    await auth_service.verify_token("token_with_bad_kid")

                assert exc_info.value.status_code == 401
                assert "Unable to find matching key" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_verify_expired_token(self, auth_service, mock_jwks):
        """Test token verification fails for expired token"""
        from jose import JWTError

        with patch.object(auth_service, "get_jwks", return_value=mock_jwks):
            with patch("app.services.auth_service.jwt") as mock_jwt:
                mock_jwt.get_unverified_header.return_value = {"kid": "test_key_1"}
                # Simulate expired token
                mock_jwt.decode.side_effect = JWTError("Token has expired")

                with pytest.raises(HTTPException) as exc_info:
                    await auth_service.verify_token("expired_token")

                assert exc_info.value.status_code == 401
                assert "Invalid token" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_verify_invalid_signature(self, auth_service, mock_jwks):
        """Test token verification fails for invalid signature"""
        from jose import JWTError

        with patch.object(auth_service, "get_jwks", return_value=mock_jwks):
            with patch("app.services.auth_service.jwt") as mock_jwt:
                mock_jwt.get_unverified_header.return_value = {"kid": "test_key_1"}
                # Simulate invalid signature
                mock_jwt.decode.side_effect = JWTError("Signature verification failed")

                with pytest.raises(HTTPException) as exc_info:
                    await auth_service.verify_token("invalid_signature_token")

                assert exc_info.value.status_code == 401
                assert "Invalid token" in exc_info.value.detail


class TestFactoryFunction:
    """Test auth service factory function"""

    def test_factory_creates_singleton(self):
        """Test that factory function creates singleton instance"""
        from app.services.auth_service import get_auth_service

        service1 = get_auth_service()
        service2 = get_auth_service()

        assert service1 is service2  # Same instance

    def test_factory_configures_jwks_url(self):
        """Test that factory function configures correct JWKS URL"""
        from app.services.auth_service import get_auth_service

        service = get_auth_service()

        # Should use discrete-gobbler-16.clerk.accounts.dev
        assert "discrete-gobbler-16.clerk.accounts.dev" in service.jwks_url
        assert ".well-known/jwks.json" in service.jwks_url
