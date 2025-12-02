"""
User service for database operations.

Handles all user CRUD operations including:
- User lookup by Clerk ID or internal ID
- User creation from webhooks
- User updates from webhooks
- User deletion with ownership reassignment
- Deleted user placeholder management
"""

from uuid import UUID
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.user import User
from app.models.map import Map
from app.models.layer import Layer
from app.models.comment import Comment
from app.models.collaborator import MapCollaborator
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    """Service for user database operations"""

    # Deleted user placeholder constants
    DELETED_USER_CLERK_ID = "system_deleted_user"
    DELETED_USER_EMAIL = "deleted@samsyn.system"

    def __init__(self, db: Session):
        self.db = db

    def get_by_clerk_id(self, clerk_id: str) -> Optional[User]:
        """
        Get user by Clerk ID.

        Args:
            clerk_id: Clerk user ID from JWT or webhook

        Returns:
            User if found, None otherwise
        """
        return self.db.query(User).filter(User.clerk_id == clerk_id).first()

    def get_by_id(self, user_id: UUID) -> Optional[User]:
        """
        Get user by internal UUID.

        Args:
            user_id: Internal user ID

        Returns:
            User if found, None otherwise
        """
        return self.db.query(User).filter(User.id == user_id).first()

    def create_user(self, user_data: UserCreate) -> User:
        """
        Create new user from webhook data.

        Args:
            user_data: User creation schema from Clerk webhook

        Returns:
            Created user instance

        Raises:
            IntegrityError: If user with clerk_id already exists
        """
        user = User(
            clerk_id=user_data.clerk_id,
            email=user_data.email,
            username=user_data.username,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            profile_image_url=user_data.profile_image_url,
        )

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        return user

    def update_user(self, clerk_id: str, user_data: UserUpdate) -> Optional[User]:
        """
        Update user from webhook data.

        Only updates fields that are provided (partial update).

        Args:
            clerk_id: Clerk user ID
            user_data: Partial update schema

        Returns:
            Updated user or None if not found
        """
        user = self.get_by_clerk_id(clerk_id)

        if not user:
            return None

        # Update only provided fields
        update_dict = user_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(user, field, value)

        self.db.commit()
        self.db.refresh(user)

        return user

    def get_or_create_deleted_user_placeholder(self) -> User:
        """
        Get or create system placeholder for deleted users.

        This placeholder receives ownership of maps, layers, and comments
        when a user is deleted from Clerk.

        Returns:
            Deleted user placeholder account
        """
        # Try to get existing placeholder
        placeholder = self.get_by_clerk_id(self.DELETED_USER_CLERK_ID)

        if placeholder:
            return placeholder

        # Create placeholder
        placeholder_data = UserCreate(
            clerk_id=self.DELETED_USER_CLERK_ID,
            email=self.DELETED_USER_EMAIL,
            username="Deleted User",
            first_name="Deleted",
            last_name="User",
            profile_image_url=None,
        )

        try:
            placeholder = self.create_user(placeholder_data)
            return placeholder
        except IntegrityError:
            # Race condition - another request created it
            self.db.rollback()
            placeholder = self.get_by_clerk_id(self.DELETED_USER_CLERK_ID)
            if not placeholder:
                raise RuntimeError("Failed to create deleted user placeholder")
            return placeholder

    def delete_user(self, clerk_id: str) -> bool:
        """
        Delete user and reassign ownership to placeholder.

        This method:
        1. Gets or creates the deleted user placeholder
        2. Transfers ownership of all maps to placeholder
        3. Transfers ownership of all layers to placeholder
        4. Reassigns all comments to placeholder
        5. Updates collaborator records
        6. Deletes the user

        Args:
            clerk_id: Clerk user ID

        Returns:
            True if deleted, False if not found
        """
        user = self.get_by_clerk_id(clerk_id)

        if not user:
            return False

        # Get or create placeholder
        placeholder = self.get_or_create_deleted_user_placeholder()

        # Transfer ownership of maps
        self.db.query(Map).filter(Map.created_by == user.id).update(
            {Map.created_by: placeholder.id}, synchronize_session=False
        )

        # Transfer ownership of layers
        self.db.query(Layer).filter(Layer.created_by == user.id).update(
            {Layer.created_by: placeholder.id}, synchronize_session=False
        )

        # Reassign comments
        self.db.query(Comment).filter(Comment.author_id == user.id).update(
            {Comment.author_id: placeholder.id}, synchronize_session=False
        )

        # Update collaborator records - reassign to placeholder
        self.db.query(MapCollaborator).filter(
            MapCollaborator.user_id == user.id
        ).update({MapCollaborator.user_id: placeholder.id}, synchronize_session=False)

        # Delete the user
        self.db.delete(user)
        self.db.commit()

        return True

    def get_or_create(
        self, clerk_id: str, user_data: UserCreate
    ) -> tuple[User, bool]:
        """
        Get existing user or create new one.

        Handles race conditions where multiple webhook deliveries arrive
        simultaneously or JWT sync creates user before webhook.

        Args:
            clerk_id: Clerk user ID
            user_data: User creation data

        Returns:
            Tuple of (user, created) where created is True if new user
        """
        user = self.get_by_clerk_id(clerk_id)

        if user:
            return user, False

        try:
            user = self.create_user(user_data)
            return user, True
        except IntegrityError:
            # Race condition - another request created user
            self.db.rollback()
            user = self.get_by_clerk_id(clerk_id)
            if not user:
                # This shouldn't happen, but handle it gracefully
                raise RuntimeError(f"Failed to create or retrieve user: {clerk_id}")
            return user, False
