"""
FastAPI dependencies for authentication and database sessions.

Provides authentication strategies:
1. get_current_user_optional: Returns Optional[User], for public endpoints
2. get_current_user: Returns User or raises 401, for protected endpoints
3. get_current_user_or_sync: Creates user from JWT if not in DB (default strategy)
4. get_current_admin: Returns User if admin or raises 403, for admin-only endpoints
"""

from typing import Annotated, Any, Dict, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate
from app.services.auth_service import auth_service
from app.services.user_service import UserService

# HTTP Bearer token security scheme
security = HTTPBearer(auto_error=False)


def is_admin_from_payload(payload: Dict[str, Any]) -> bool:
    """
    Check if user is admin from JWT payload.

    Clerk stores custom claims in publicMetadata, which is included in the JWT
    under the 'public_metadata' or 'publicMetadata' key.

    Args:
        payload: Decoded JWT payload

    Returns:
        True if user has isAdmin=true in publicMetadata
    """
    # Clerk may use either key format
    public_metadata = (
        payload.get("public_metadata") or payload.get("publicMetadata") or {}
    )
    return public_metadata.get("isAdmin") is True


async def get_current_user_or_sync(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> Optional[User]:
    """
    Get current user, creating from JWT if not in database.

    This is the default auth strategy. It handles the edge case where a user
    has a valid JWT but hasn't been synced to the database yet via webhook.

    Flow:
    1. Extract Bearer token from Authorization header
    2. Verify JWT signature via auth_service
    3. Extract clerk_id from token payload
    4. Lookup user in database
    5. If not found, create user from JWT claims
    6. Return user or None if no token provided

    Args:
        credentials: HTTP Bearer credentials from Authorization header
        db: Database session

    Returns:
        User instance if authenticated, None if no token provided

    Raises:
        HTTPException: If token is invalid or expired
    """
    if not credentials:
        return None

    # Verify JWT token
    token = credentials.credentials
    payload = await auth_service.verify_token(token)

    # Get clerk_id from token payload (Clerk uses 'sub' claim for user ID)
    clerk_id = payload.get("sub")

    if not clerk_id:
        return None

    # Try to get user from database
    user_service = UserService(db)
    user = user_service.get_by_clerk_id(clerk_id)

    if user:
        return user

    # User not in DB yet - create from JWT claims or Clerk API
    # This handles the case where webhook hasn't fired yet

    # First, try to get email from JWT payload
    email = payload.get("email")
    username = payload.get("username")
    first_name = payload.get("first_name")
    last_name = payload.get("last_name")
    profile_image_url = payload.get("picture")

    # If email not in JWT (Clerk's default), fetch from Clerk API
    if not email:
        clerk_user = await auth_service.get_user_by_clerk_id(clerk_id)
        if clerk_user:
            email = clerk_user.get("email")
            username = username or clerk_user.get("username")
            first_name = first_name or clerk_user.get("first_name")
            last_name = last_name or clerk_user.get("last_name")
            profile_image_url = profile_image_url or clerk_user.get("profile_image_url")

    # Fall back to placeholder only if Clerk API also failed
    if not email:
        email = f"{clerk_id}@unknown.com"

    user_data = UserCreate(
        clerk_id=clerk_id,
        email=email,
        username=username,
        first_name=first_name,
        last_name=last_name,
        profile_image_url=profile_image_url,
    )

    # Use get_or_create to handle race conditions
    user, _ = user_service.get_or_create(clerk_id, user_data)
    return user


async def get_current_user_optional(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> Optional[User]:
    """
    Optional authentication - returns None if no token provided.

    Use this for endpoints that enhance the experience when authenticated
    but also work without authentication.

    Example: List maps endpoint that shows public maps + user's private maps

    Args:
        credentials: HTTP Bearer credentials from Authorization header
        db: Database session

    Returns:
        User instance if authenticated, None otherwise

    Note:
        This uses get_current_user_or_sync internally, so it will create
        users from JWT if they don't exist in DB yet.
    """
    return await get_current_user_or_sync(credentials, db)


async def get_current_user(
    user: Annotated[Optional[User], Depends(get_current_user_or_sync)],
) -> User:
    """
    Required authentication - raises 401 if no valid token.

    This is the standard dependency for protected endpoints.
    Use this for all endpoints that require authentication.

    Args:
        user: User from get_current_user_or_sync dependency

    Returns:
        User instance (guaranteed to be not None)

    Raises:
        HTTPException 401: If no valid authentication provided

    Example:
        @router.post("/maps")
        async def create_map(
            current_user: Annotated[User, Depends(get_current_user)],
        ):
            # current_user is guaranteed to be a User instance
            pass
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_admin(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """
    Admin-only authentication - raises 401 if not authenticated, 403 if not admin.

    Use this dependency for admin-only endpoints like managing global layers,
    WMS servers, and system settings.

    The admin check is performed by verifying publicMetadata.isAdmin in the JWT
    payload. This is set in the Clerk Dashboard for each admin user.

    Args:
        credentials: HTTP Bearer credentials from Authorization header
        db: Database session

    Returns:
        User instance (guaranteed to be admin)

    Raises:
        HTTPException 401: If no valid authentication provided
        HTTPException 403: If user is not an admin

    Example:
        @router.post("/admin/global-layers")
        async def create_global_layer(
            current_admin: Annotated[User, Depends(get_current_admin)],
        ):
            # current_admin is guaranteed to be an admin user
            pass
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify JWT and get payload
    token = credentials.credentials
    payload = await auth_service.verify_token(token)

    # Check admin status from JWT payload
    if not is_admin_from_payload(payload):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    # Get or create user (same as get_current_user_or_sync)
    clerk_id = payload.get("sub")
    if not clerk_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user ID",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_service = UserService(db)
    user = user_service.get_by_clerk_id(clerk_id)

    if user:
        return user

    # Create user from JWT if not exists
    email = payload.get("email")
    if not email:
        clerk_user = await auth_service.get_user_by_clerk_id(clerk_id)
        if clerk_user:
            email = clerk_user.get("email")

    if not email:
        email = f"{clerk_id}@unknown.com"

    user_data = UserCreate(
        clerk_id=clerk_id,
        email=email,
        username=payload.get("username"),
        first_name=payload.get("first_name"),
        last_name=payload.get("last_name"),
        profile_image_url=payload.get("picture"),
    )

    user, _ = user_service.get_or_create(clerk_id, user_data)
    return user
