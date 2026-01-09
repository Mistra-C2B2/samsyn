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

    def _find_new_map_owner(self, map_id: UUID, current_owner_id: UUID) -> Optional[UUID]:
        """
        Find the best candidate to become the new map owner.

        Priority:
        1. Oldest editor collaborator (by created_at)
        2. Oldest viewer collaborator (by created_at)
        3. None (caller should use placeholder)

        Args:
            map_id: Map UUID
            current_owner_id: Current owner's UUID (to exclude)

        Returns:
            User UUID of new owner, or None if no suitable candidate
        """
        # Try to find an editor first
        editor = (
            self.db.query(MapCollaborator)
            .filter(
                MapCollaborator.map_id == map_id,
                MapCollaborator.role == "editor",
                MapCollaborator.user_id != current_owner_id,
            )
            .order_by(MapCollaborator.created_at.asc())
            .first()
        )

        if editor:
            return editor.user_id

        # Fall back to viewer
        viewer = (
            self.db.query(MapCollaborator)
            .filter(
                MapCollaborator.map_id == map_id,
                MapCollaborator.role == "viewer",
                MapCollaborator.user_id != current_owner_id,
            )
            .order_by(MapCollaborator.created_at.asc())
            .first()
        )

        if viewer:
            return viewer.user_id

        return None

    async def _delete_from_clerk(self, clerk_id: str) -> bool:
        """
        Delete user from Clerk using Backend API.

        Args:
            clerk_id: Clerk user ID

        Returns:
            True if deleted or already gone, False on error
        """
        import httpx
        from app.config import settings

        if not settings.CLERK_SECRET_KEY:
            # Clerk not configured - skip
            print("Warning: CLERK_SECRET_KEY not configured, skipping Clerk deletion")
            return True

        clerk_api_url = f"https://api.clerk.com/v1/users/{clerk_id}"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.delete(
                    clerk_api_url,
                    headers={
                        "Authorization": f"Bearer {settings.CLERK_SECRET_KEY}",
                        "Content-Type": "application/json",
                    },
                    timeout=10.0,
                )
                response.raise_for_status()
                return True
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    # User already deleted from Clerk
                    return True
                # Log error but don't fail - local deletion succeeded
                print(f"Warning: Failed to delete user from Clerk: {e}")
                return False
            except httpx.HTTPError as e:
                print(f"Warning: Failed to delete user from Clerk: {e}")
                return False

    async def delete_user_with_smart_transfer(self, clerk_id: str) -> bool:
        """
        Delete user with smart ownership transfer for maps.

        This method implements GDPR-compliant user deletion with intelligent
        ownership transfer:

        1. For each map owned by the user:
           a. Find oldest editor collaborator → promote to owner
           b. If no editors: find oldest viewer → promote to owner
           c. If no collaborators: transfer to deleted user placeholder
           d. Remove promoted collaborator from MapCollaborator table

        2. Layers: Transfer all to placeholder (no collaborator concept)

        3. Comments: Transfer all to placeholder (anonymize)

        4. Collaborator records: Delete all records where user is a collaborator

        5. Delete user from database

        6. Delete user from Clerk via Backend API

        Args:
            clerk_id: Clerk user ID

        Returns:
            True if deleted successfully, False if user not found
        """
        user = self.get_by_clerk_id(clerk_id)

        if not user:
            return False

        user_id = user.id  # Store user ID before any commits
        print(f"DEBUG: Deleting user {clerk_id} (internal ID: {user_id})")

        # Get or create placeholder for items that can't be transferred
        placeholder = self.get_or_create_deleted_user_placeholder()

        # Ensure placeholder has a valid ID
        if not placeholder.id:
            raise RuntimeError("Deleted user placeholder has no ID")

        placeholder_id = placeholder.id  # Store ID to avoid session issues
        print(f"DEBUG: Placeholder ID: {placeholder_id}")

        # Step 1: Smart transfer of map ownership
        # Re-fetch user after potential commit in get_or_create_deleted_user_placeholder
        user = self.get_by_clerk_id(clerk_id)
        if not user:
            raise RuntimeError("User disappeared after placeholder creation")

        # Get map IDs first (just IDs, not full objects to avoid relationship issues)
        user_map_ids = [
            m.id for m in self.db.query(Map.id).filter(Map.created_by == user_id).all()
        ]
        print(f"DEBUG: Found {len(user_map_ids)} maps owned by user")

        for map_id in user_map_ids:
            new_owner_id = self._find_new_map_owner(map_id, user_id)
            print(f"DEBUG: Map {map_id} - new_owner_id: {new_owner_id}, will use placeholder: {new_owner_id is None}")

            target_owner_id = new_owner_id if new_owner_id else placeholder_id

            # Use bulk update to avoid relationship issues
            self.db.query(Map).filter(Map.id == map_id).update(
                {Map.created_by: target_owner_id}, synchronize_session=False
            )

            if new_owner_id:
                # Remove the promoted collaborator from the collaborators list
                self.db.query(MapCollaborator).filter(
                    MapCollaborator.map_id == map_id,
                    MapCollaborator.user_id == new_owner_id,
                ).delete(synchronize_session=False)

            print(f"DEBUG: Map {map_id} created_by set to: {target_owner_id}")

        # Step 2: Transfer layers to placeholder (bulk update)
        self.db.query(Layer).filter(Layer.created_by == user_id).update(
            {Layer.created_by: placeholder_id}, synchronize_session=False
        )

        # Step 3: Transfer comments to placeholder (bulk update, anonymize)
        self.db.query(Comment).filter(Comment.author_id == user_id).update(
            {Comment.author_id: placeholder_id}, synchronize_session=False
        )

        # Step 4: Remove user from all collaborations they're part of
        self.db.query(MapCollaborator).filter(
            MapCollaborator.user_id == user_id
        ).delete(synchronize_session=False)

        # Step 5: Delete the user from database
        # Note: We use user_id to re-fetch since the user object may be stale
        user_to_delete = self.db.query(User).filter(User.id == user_id).first()
        if user_to_delete:
            self.db.delete(user_to_delete)
        self.db.commit()
        print("DEBUG: User deleted and committed")

        # Step 6: Delete from Clerk (async)
        await self._delete_from_clerk(clerk_id)

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
