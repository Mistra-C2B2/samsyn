"""
User Pydantic schemas for request/response validation.

These schemas handle data validation for:
- User creation from Clerk webhooks
- User updates from Clerk webhooks
- User API responses
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class UserBase(BaseModel):
    """Base user fields shared across schemas"""

    email: EmailStr
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_image_url: Optional[str] = None


class UserCreate(UserBase):
    """
    Schema for creating a user from Clerk webhook.

    Includes clerk_id which is required for syncing with Clerk.
    """

    clerk_id: str


class UserUpdate(BaseModel):
    """
    Schema for updating user from Clerk webhook.

    All fields are optional to support partial updates.
    """

    email: Optional[EmailStr] = None
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_image_url: Optional[str] = None


class UserResponse(UserBase):
    """
    Schema for user API responses.

    Includes id, clerk_id, and timestamps.
    Safe to expose publicly (no sensitive data).
    """

    id: UUID
    clerk_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )  # Allows creation from SQLAlchemy models
