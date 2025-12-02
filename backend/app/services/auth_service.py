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


# Factory function to create singleton instance
@lru_cache()
def get_auth_service() -> ClerkAuthService:
    """
    Get singleton instance of ClerkAuthService.

    The JWKS URL is constructed from the Clerk instance domain.
    For pk_test_ZGlzY3JldGUtZ29iYmxlci0xNi5jbGVyay5hY2NvdW50cy5kZXYk
    the decoded instance is: discrete-gobbler-16.clerk.accounts.dev

    Returns:
        ClerkAuthService instance
    """
    # Extract Clerk instance from environment or use default
    # The publishable key pk_test_ZGlzY3JldGUtZ29iYmxlci0xNi5jbGVyay5hY2NvdW50cy5kZXYk
    # decodes to: discrete-gobbler-16.clerk.accounts.dev
    clerk_instance = "discrete-gobbler-16.clerk.accounts.dev"
    jwks_url = f"https://{clerk_instance}/.well-known/jwks.json"

    return ClerkAuthService(jwks_url=jwks_url)


# Export singleton instance
auth_service = get_auth_service()
