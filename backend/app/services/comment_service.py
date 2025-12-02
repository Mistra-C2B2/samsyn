"""
Comment service for database operations.

Handles all comment CRUD operations including:
- Comment creation on maps and layers
- Comment retrieval and listing with filtering
- Threaded comment queries with nested replies
- Comment updates and deletion
- Resolution status management
- Reply counting and pagination
"""

from uuid import UUID
from typing import Optional, List
from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from fastapi import HTTPException, status

from app.models.comment import Comment
from app.models.map import Map
from app.models.layer import Layer
from app.schemas.comment import CommentCreate, CommentUpdate


class CommentService:
    """Service for comment database operations"""

    def __init__(self, db: Session):
        self.db = db

    # ========================================================================
    # Core CRUD Operations
    # ========================================================================

    def create_comment(
        self, comment_data: CommentCreate, author_id: UUID
    ) -> Comment:
        """
        Create a new comment on a map or layer.

        Validates that:
        - The target map or layer exists
        - If parent_id is provided, parent exists and is on the same target

        Args:
            comment_data: Comment creation schema
            author_id: UUID of the comment author

        Returns:
            Created Comment instance

        Raises:
            HTTPException: If target or parent validation fails
        """
        # Validate target exists (map or layer)
        if comment_data.map_id:
            map_obj = self.db.query(Map).filter(Map.id == comment_data.map_id).first()
            if not map_obj:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Map with id {comment_data.map_id} not found"
                )

        if comment_data.layer_id:
            layer = self.db.query(Layer).filter(Layer.id == comment_data.layer_id).first()
            if not layer:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Layer with id {comment_data.layer_id} not found"
                )

        # Validate parent comment if provided
        if comment_data.parent_id:
            parent = self.db.query(Comment).filter(
                Comment.id == comment_data.parent_id
            ).first()

            if not parent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Parent comment with id {comment_data.parent_id} not found"
                )

            # Validate parent is on the same target (map or layer)
            if comment_data.map_id and parent.map_id != comment_data.map_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Parent comment must be on the same map"
                )

            if comment_data.layer_id and parent.layer_id != comment_data.layer_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Parent comment must be on the same layer"
                )

        # Create comment
        comment = Comment(
            content=comment_data.content,
            author_id=author_id,
            map_id=comment_data.map_id,
            layer_id=comment_data.layer_id,
            parent_id=comment_data.parent_id,
        )

        self.db.add(comment)
        self.db.commit()
        self.db.refresh(comment)

        return comment

    def get_comment(self, comment_id: UUID) -> Optional[Comment]:
        """
        Get comment by ID with eager loading of author relationship.

        Args:
            comment_id: Comment UUID

        Returns:
            Comment if found, None otherwise
        """
        return (
            self.db.query(Comment)
            .options(joinedload(Comment.author))
            .filter(Comment.id == comment_id)
            .first()
        )

    def list_comments(
        self,
        map_id: Optional[UUID] = None,
        layer_id: Optional[UUID] = None,
        parent_id: Optional[UUID] = None,
        include_resolved: bool = True,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Comment]:
        """
        List comments with filtering and pagination.

        Supports filtering by:
        - map_id: Comments on a specific map
        - layer_id: Comments on a specific layer
        - parent_id: Direct replies to a specific comment
        - include_resolved: Whether to include resolved comments

        Args:
            map_id: Optional map UUID filter
            layer_id: Optional layer UUID filter
            parent_id: Optional parent comment UUID filter (for replies)
            include_resolved: Include resolved comments (default True)
            limit: Maximum number of comments to return (default 100)
            offset: Number of comments to skip (default 0)

        Returns:
            List of Comment instances matching filters
        """
        query = self.db.query(Comment).options(joinedload(Comment.author))

        # Apply filters
        if map_id is not None:
            query = query.filter(Comment.map_id == map_id)

        if layer_id is not None:
            query = query.filter(Comment.layer_id == layer_id)

        if parent_id is not None:
            query = query.filter(Comment.parent_id == parent_id)

        # Filter by resolution status
        if not include_resolved:
            query = query.filter(Comment.is_resolved == False)

        # Order by newest first
        query = query.order_by(Comment.created_at.desc())

        # Apply pagination
        query = query.limit(limit).offset(offset)

        return query.all()

    def count_comments(
        self,
        map_id: Optional[UUID] = None,
        layer_id: Optional[UUID] = None,
        parent_id: Optional[UUID] = None,
        include_resolved: bool = True,
    ) -> int:
        """
        Count comments matching the same filters as list_comments.

        Args:
            map_id: Optional map UUID filter
            layer_id: Optional layer UUID filter
            parent_id: Optional parent comment UUID filter
            include_resolved: Include resolved comments (default True)

        Returns:
            Total number of comments matching criteria
        """
        query = self.db.query(func.count(Comment.id))

        # Apply filters
        if map_id is not None:
            query = query.filter(Comment.map_id == map_id)

        if layer_id is not None:
            query = query.filter(Comment.layer_id == layer_id)

        if parent_id is not None:
            query = query.filter(Comment.parent_id == parent_id)

        # Filter by resolution status
        if not include_resolved:
            query = query.filter(Comment.is_resolved == False)

        return query.scalar() or 0

    def get_comment_thread(
        self, comment_id: UUID, max_depth: int = 10
    ) -> Optional[Comment]:
        """
        Get comment with all nested replies up to max_depth.

        Uses recursive loading to build the complete comment thread.
        Eager loads author relationships to avoid N+1 queries.

        Args:
            comment_id: Root comment UUID
            max_depth: Maximum nesting depth (default 10)

        Returns:
            Comment with populated replies attribute, or None if not found
        """
        # Get root comment with author
        comment = (
            self.db.query(Comment)
            .options(joinedload(Comment.author))
            .filter(Comment.id == comment_id)
            .first()
        )

        if not comment:
            return None

        # Recursively load replies
        self._load_replies(comment, max_depth)

        return comment

    def _load_replies(self, comment: Comment, remaining_depth: int):
        """
        Recursively load replies for a comment.

        Helper method for get_comment_thread.

        Args:
            comment: Comment instance to load replies for
            remaining_depth: Remaining nesting depth allowed
        """
        if remaining_depth <= 0:
            return

        # Load direct replies with authors
        replies = (
            self.db.query(Comment)
            .options(joinedload(Comment.author))
            .filter(Comment.parent_id == comment.id)
            .order_by(Comment.created_at.asc())
            .all()
        )

        # Attach replies to comment (override the lazy-loaded backref)
        comment.replies = replies

        # Recursively load nested replies
        for reply in replies:
            self._load_replies(reply, remaining_depth - 1)

    def update_comment(
        self, comment_id: UUID, comment_update: CommentUpdate
    ) -> Comment:
        """
        Update comment with partial data.

        Updates only provided fields and sets updated_at timestamp.

        Args:
            comment_id: Comment UUID
            comment_update: Partial update schema

        Returns:
            Updated Comment instance

        Raises:
            HTTPException: If comment not found
        """
        comment = self.db.query(Comment).filter(Comment.id == comment_id).first()

        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Comment with id {comment_id} not found"
            )

        # Update only provided fields
        update_dict = comment_update.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(comment, field, value)

        # Update timestamp
        comment.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(comment)

        return comment

    def delete_comment(self, comment_id: UUID) -> bool:
        """
        Delete comment and cascade to replies.

        Due to the self-referential foreign key with cascade,
        all nested replies will be automatically deleted.

        Args:
            comment_id: Comment UUID

        Returns:
            True if deleted, False if not found
        """
        comment = self.db.query(Comment).filter(Comment.id == comment_id).first()

        if not comment:
            return False

        self.db.delete(comment)
        self.db.commit()

        return True

    # ========================================================================
    # Resolution Management
    # ========================================================================

    def resolve_comment(self, comment_id: UUID, is_resolved: bool) -> Comment:
        """
        Update comment resolution status.

        Args:
            comment_id: Comment UUID
            is_resolved: New resolution status

        Returns:
            Updated Comment instance

        Raises:
            HTTPException: If comment not found
        """
        comment = self.db.query(Comment).filter(Comment.id == comment_id).first()

        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Comment with id {comment_id} not found"
            )

        comment.is_resolved = is_resolved
        comment.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(comment)

        return comment

    # ========================================================================
    # Reply Management
    # ========================================================================

    def get_replies(
        self, parent_id: UUID, limit: int = 50, offset: int = 0
    ) -> List[Comment]:
        """
        Get direct replies to a comment with pagination.

        Only returns immediate children (1 level deep).
        For full thread, use get_comment_thread().

        Args:
            parent_id: Parent comment UUID
            limit: Maximum number of replies to return (default 50)
            offset: Number of replies to skip (default 0)

        Returns:
            List of Comment instances that are direct replies
        """
        return (
            self.db.query(Comment)
            .options(joinedload(Comment.author))
            .filter(Comment.parent_id == parent_id)
            .order_by(Comment.created_at.asc())
            .limit(limit)
            .offset(offset)
            .all()
        )

    def get_reply_count(self, parent_id: UUID) -> int:
        """
        Get count of direct replies to a comment.

        Args:
            parent_id: Parent comment UUID

        Returns:
            Number of direct replies
        """
        return (
            self.db.query(func.count(Comment.id))
            .filter(Comment.parent_id == parent_id)
            .scalar() or 0
        )

    # ========================================================================
    # Bulk Operations
    # ========================================================================

    def delete_comments_by_map(self, map_id: UUID) -> int:
        """
        Delete all comments on a map.

        Typically called when a map is being deleted.
        Cascades to all replies.

        Args:
            map_id: Map UUID

        Returns:
            Number of comments deleted (top-level only, not including cascaded replies)
        """
        count = self.db.query(Comment).filter(Comment.map_id == map_id).count()

        self.db.query(Comment).filter(Comment.map_id == map_id).delete()
        self.db.commit()

        return count

    def delete_comments_by_layer(self, layer_id: UUID) -> int:
        """
        Delete all comments on a layer.

        Typically called when a layer is being deleted.
        Cascades to all replies.

        Args:
            layer_id: Layer UUID

        Returns:
            Number of comments deleted (top-level only, not including cascaded replies)
        """
        count = self.db.query(Comment).filter(Comment.layer_id == layer_id).count()

        self.db.query(Comment).filter(Comment.layer_id == layer_id).delete()
        self.db.commit()

        return count

    def get_comment_count_by_map(self, map_id: UUID) -> int:
        """
        Get total number of comments on a map.

        Args:
            map_id: Map UUID

        Returns:
            Comment count
        """
        return (
            self.db.query(func.count(Comment.id))
            .filter(Comment.map_id == map_id)
            .scalar() or 0
        )

    def get_comment_count_by_layer(self, layer_id: UUID) -> int:
        """
        Get total number of comments on a layer.

        Args:
            layer_id: Layer UUID

        Returns:
            Comment count
        """
        return (
            self.db.query(func.count(Comment.id))
            .filter(Comment.layer_id == layer_id)
            .scalar() or 0
        )
