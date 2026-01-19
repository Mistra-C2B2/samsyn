"""
Clerk authentication service for JWT verification.

This service:
- Fetches JWKS (JSON Web Key Set) from Clerk
- Caches JWKS to minimize network calls
- Verifies JWT signatures using RS256 algorithm
- Decodes and returns token payload
"""

import httpx
import time
from jose import jwt, JWTError
from fastapi import HTTPException, status
from typing import Dict, Any, Optional
from functools import lru_cache

from app.config import settings


class ClerkAuthService:
    """Service for Clerk JWT verification using JWKS"""

    def __init__(self, jwks_url: str):
        """
        Initialize auth service.

        Args:
            jwks_url: Clerk JWKS endpoint URL
                     Format: https://{clerk_instance}/.well-known/jwks.json
                     Example: https://discrete-gobbler-16.clerk.accounts.dev/.well-known/jwks.json
        """
        self.jwks_url = jwks_url
        self._jwks_cache: Optional[Dict] = None
        self._jwks_cache_time: float = 0
        self._jwks_cache_ttl: int = 3600  # Cache for 1 hour

    async def get_jwks(self) -> Dict[str, Any]:
        """
        Fetch JWKS from Clerk with caching.

        JWKS (JSON Web Key Set) contains public keys for JWT verification.
        Cached for 1 hour to reduce network calls since Clerk's keys rarely change.

        Returns:
            JWKS dictionary containing public keys

        Raises:
            HTTPException: If unable to fetch JWKS from Clerk
        """
        current_time = time.time()

        # Return cached JWKS if still valid
        if (
            self._jwks_cache
            and current_time - self._jwks_cache_time < self._jwks_cache_ttl
        ):
            return self._jwks_cache

        # Fetch fresh JWKS
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(self.jwks_url, timeout=10.0)
                response.raise_for_status()
                self._jwks_cache = response.json()
                self._jwks_cache_time = current_time
                return self._jwks_cache
            except httpx.HTTPError as e:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Unable to fetch JWKS from Clerk: {str(e)}",
                )

    async def verify_token(self, token: str) -> Dict[str, Any]:
        """
        Verify Clerk JWT token and return decoded payload.

        Process:
        1. Get JWKS from Clerk (cached)
        2. Extract key ID (kid) from token header
        3. Find matching public key in JWKS
        4. Verify signature using RS256
        5. Return decoded payload

        Args:
            token: JWT token from Authorization header

        Returns:
            Decoded token payload containing user claims:
            - sub: Clerk user ID (our clerk_id)
            - email: User email
            - username, first_name, last_name, picture: Optional profile data

        Raises:
            HTTPException: If token is invalid, expired, or malformed
        """
        try:
            # Get JWKS for verification
            jwks = await self.get_jwks()

            # Decode token header to get key ID (kid)
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get("kid")

            if not kid:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token missing key ID (kid)",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Find matching key in JWKS
            key = None
            for jwk_key in jwks.get("keys", []):
                if jwk_key.get("kid") == kid:
                    key = jwk_key
                    break

            if not key:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Unable to find matching key in JWKS",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Verify and decode token
            # Note: Clerk doesn't use audience claim, so we skip verification
            payload = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                options={
                    "verify_aud": False,  # Clerk doesn't use audience
                    "verify_exp": True,  # Verify expiration
                },
            )

            return payload

        except JWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )

    async def validate_user_email(self, email: str) -> bool:
        """
        Validate if user exists in Clerk by email.

        Calls Clerk API to check if a user with the given email exists.

        Args:
            email: Email address to validate

        Returns:
            True if user exists in Clerk, False otherwise

        Raises:
            HTTPException: If unable to communicate with Clerk API
        """
        if not settings.CLERK_SECRET_KEY:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Clerk authentication is not configured",
            )

        # Clerk API endpoint for user search by email
        clerk_api_url = "https://api.clerk.com/v1/users"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    clerk_api_url,
                    params={"email_address": [email]},  # httpx handles proper URL encoding
                    headers={
                        "Authorization": f"Bearer {settings.CLERK_SECRET_KEY}",
                        "Content-Type": "application/json",
                    },
                    timeout=10.0,
                )
                response.raise_for_status()
                data = response.json()

                # Clerk API returns an array of users directly
                # An empty array [] means no users found
                return isinstance(data, list) and len(data) > 0

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    # User not found
                    return False
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Unable to validate user with Clerk: {str(e)}",
                )
            except httpx.HTTPError as e:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"Unable to communicate with Clerk API: {str(e)}",
                )

    async def get_user_by_clerk_id(self, clerk_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch user details from Clerk by their Clerk user ID.

        This is useful when JWT doesn't contain email (Clerk's default behavior)
        and we need to fetch user details to create a local user record.

        Args:
            clerk_id: Clerk user ID (e.g., "user_abc123")

        Returns:
            Dict with user details including email, or None if not found:
            - id: Clerk user ID
            - email: Primary email address
            - username: Username (if set)
            - first_name: First name
            - last_name: Last name
            - profile_image_url: Profile picture URL

        Raises:
            HTTPException: If unable to communicate with Clerk API
        """
        if not settings.CLERK_SECRET_KEY:
            return None

        clerk_api_url = f"https://api.clerk.com/v1/users/{clerk_id}"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    clerk_api_url,
                    headers={
                        "Authorization": f"Bearer {settings.CLERK_SECRET_KEY}",
                        "Content-Type": "application/json",
                    },
                    timeout=10.0,
                )
                response.raise_for_status()
                data = response.json()

                # Extract primary email from email_addresses array
                email = None
                email_addresses = data.get("email_addresses", [])
                primary_email_id = data.get("primary_email_address_id")

                for email_obj in email_addresses:
                    if email_obj.get("id") == primary_email_id:
                        email = email_obj.get("email_address")
                        break

                # Fall back to first email if primary not found
                if not email and email_addresses:
                    email = email_addresses[0].get("email_address")

                return {
                    "id": data.get("id"),
                    "email": email,
                    "username": data.get("username"),
                    "first_name": data.get("first_name"),
                    "last_name": data.get("last_name"),
                    "profile_image_url": data.get("image_url"),
                }

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    return None
                # Log but don't fail - we can still create user with placeholder
                return None
            except httpx.HTTPError:
                # Network error - don't fail, just return None
                return None


# Factory function to create singleton instance
@lru_cache()
def get_auth_service() -> ClerkAuthService:
    """
    Get singleton instance of ClerkAuthService.

    The JWKS URL is configured via the CLERK_JWKS_URL environment variable.
    This URL points to Clerk's JSON Web Key Set endpoint used for verifying JWTs.

    Returns:
        ClerkAuthService instance

    Raises:
        ValueError: If CLERK_JWKS_URL is not configured
    """
    if not settings.CLERK_JWKS_URL:
        raise ValueError(
            "CLERK_JWKS_URL environment variable is not set. "
            "Please add CLERK_JWKS_URL to your .env file.\n"
            "Format: https://your-clerk-instance.clerk.accounts.dev/.well-known/jwks.json\n"
            "You can find your instance domain in the Clerk Dashboard."
        )

    return ClerkAuthService(jwks_url=settings.CLERK_JWKS_URL)


# Export singleton instance
auth_service = get_auth_service()
