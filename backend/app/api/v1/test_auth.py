"""
Test authentication endpoints for manual testing.

These endpoints are temporary and used for validating the authentication
system during Phase 2 implementation.

TODO: Remove this file after Phase 2 testing is complete.
"""

from typing import Annotated, Optional
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, get_current_user_optional
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter(prefix="/test", tags=["test"])


@router.get("/auth/required")
async def test_auth_required(
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Test endpoint that requires authentication.

    Returns user data if authentication is successful.
    Returns 401 if no valid token provided.

    Usage:
    ```bash
    # Without token (should return 401)
    curl http://localhost:8000/api/v1/test/auth/required

    # With token (should return user data)
    curl -H "Authorization: Bearer YOUR_TOKEN" \\
      http://localhost:8000/api/v1/test/auth/required
    ```
    """
    return {
        "message": "Authentication successful",
        "user": UserResponse.model_validate(current_user),
    }


@router.get("/auth/optional")
async def test_auth_optional(
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)],
):
    """
    Test endpoint with optional authentication.

    Works with or without authentication.
    Shows different responses based on auth status.

    Usage:
    ```bash
    # Without token
    curl http://localhost:8000/api/v1/test/auth/optional

    # With token
    curl -H "Authorization: Bearer YOUR_TOKEN" \\
      http://localhost:8000/api/v1/test/auth/optional
    ```
    """
    if current_user:
        return {
            "message": "Authenticated",
            "user": UserResponse.model_validate(current_user),
        }
    else:
        return {"message": "Not authenticated", "user": None}


@router.get("/health")
async def test_health():
    """
    Simple health check endpoint.

    Doesn't require authentication.
    """
    return {"status": "ok", "message": "Test endpoints are working"}
