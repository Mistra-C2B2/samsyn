"""
FastAPI dependencies for authentication and database sessions.

Provides three authentication strategies:
1. get_current_user_optional: Returns Optional[User], for public endpoints
2. get_current_user: Returns User or raises 401, for protected endpoints
3. get_current_user_or_sync: Creates user from JWT if not in DB (default strategy)
"""

from typing import Annotated, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services.auth_service import auth_service
from app.services.user_service import UserService
from app.schemas.user import UserCreate

# HTTP Bearer token security scheme
security = HTTPBearer(auto_error=False)


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
