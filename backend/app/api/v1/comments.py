"""
Comments API endpoints for threaded commenting on maps and layers.

Provides endpoints for:
- Comment CRUD (create, read, update, delete)
- Comment listing with filters (map_id, layer_id, parent_id)
- Threaded comment retrieval with nested replies
- Resolution status management

All endpoints require authentication via Clerk JWT tokens.
Authorization is enforced based on comment authorship.
"""

from uuid import UUID
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.comment import (
    CommentCreate,
    CommentUpdate,
    CommentResponse,
    CommentWithReplies,
)
from app.services.comment_service import CommentService

router = APIRouter(prefix="/comments", tags=["comments"])


# ============================================================================
# Helper Functions
# ============================================================================


def populate_comment_fields(comment, service: CommentService) -> CommentResponse:
    """
    Populate computed fields for a comment response.

    Adds:
    - author_name from author relationship
    - reply_count from service

    Args:
        comment: Comment model instance
        service: CommentService instance for counting replies

    Returns:
        CommentResponse with populated fields
    """
    response = CommentResponse.model_validate(comment)
    response.author_name = comment.author.username if comment.author else None
    response.reply_count = service.get_reply_count(comment.id)
    return response


def populate_thread_fields(comment, service: CommentService) -> CommentWithReplies:
    """
    Recursively populate computed fields for a threaded comment response.

    Adds author_name and reply_count for the comment and all nested replies.

    Args:
        comment: Comment model instance with loaded replies
        service: CommentService instance for counting replies

    Returns:
        CommentWithReplies with populated fields
    """
    # Create base response
    response = CommentWithReplies.model_validate(comment)
    response.author_name = comment.author.username if comment.author else None
    response.reply_count = service.get_reply_count(comment.id)

    # Recursively populate reply fields
    response.replies = []
    for reply in getattr(comment, 'replies', []):
        reply_response = CommentResponse.model_validate(reply)
        reply_response.author_name = reply.author.username if reply.author else None
        reply_response.reply_count = service.get_reply_count(reply.id)
        response.replies.append(reply_response)

    return response


# ============================================================================
# Comment CRUD Endpoints
# ============================================================================


@router.get("", response_model=List[CommentResponse])
async def list_comments(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    map_id: Optional[UUID] = Query(None, description="Filter by map ID"),
    layer_id: Optional[UUID] = Query(None, description="Filter by layer ID"),
    parent_id: Optional[UUID] = Query(None, description="Filter by parent comment ID"),
    include_resolved: bool = Query(True, description="Include resolved comments"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum comments to return (max 1000)"),
    offset: int = Query(0, ge=0, description="Number of comments to skip"),
):
    """
    List comments with optional filters and pagination.

    Query parameters:
    - map_id: Filter comments on a specific map
    - layer_id: Filter comments on a specific layer
    - parent_id: Filter direct replies to a specific comment
    - include_resolved: Include resolved comments (default: true)
    - limit: Maximum comments to return (1-1000, default 100)
    - offset: Number of comments to skip for pagination (default 0)

    Returns:
        List of comments with author_name and reply_count populated

    Notes:
        - Comments are ordered by created_at descending (newest first)
        - Each comment includes reply_count for direct replies
        - Author information is included via author_name field
    """
    service = CommentService(db)

    comments = service.list_comments(
        map_id=map_id,
        layer_id=layer_id,
        parent_id=parent_id,
        include_resolved=include_resolved,
        limit=limit,
        offset=offset,
    )

    # Populate computed fields for each comment
    return [populate_comment_fields(comment, service) for comment in comments]


@router.get("/{comment_id}", response_model=CommentResponse)
async def get_comment(
    comment_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Get a single comment by ID.

    Args:
        comment_id: Comment UUID

    Returns:
        Comment details with author_name and reply_count

    Raises:
        404: Comment not found
    """
    service = CommentService(db)
    comment = service.get_comment(comment_id)

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    return populate_comment_fields(comment, service)


@router.get("/{comment_id}/thread", response_model=CommentWithReplies)
async def get_comment_thread(
    comment_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    max_depth: int = Query(10, ge=1, le=20, description="Maximum nesting depth (max 20)"),
):
    """
    Get a comment with all nested replies.

    Recursively loads replies up to the specified max_depth.
    Each comment and reply includes author_name and reply_count.

    Query parameters:
    - max_depth: Maximum nesting depth to load (1-20, default 10)

    Args:
        comment_id: Root comment UUID

    Returns:
        Comment with nested replies structure

    Raises:
        404: Comment not found

    Notes:
        - Replies are ordered by created_at ascending (oldest first)
        - Deep nesting is limited to prevent performance issues
        - Uses eager loading to avoid N+1 queries
    """
    service = CommentService(db)
    comment = service.get_comment_thread(comment_id, max_depth=max_depth)

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    return populate_thread_fields(comment, service)


@router.post("", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    comment_data: CommentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Create a new comment on a map or layer.

    Comments must be attached to either a map OR a layer (not both).
    Comments can optionally be replies to parent comments.

    Validation:
    - Either map_id or layer_id must be provided (XOR)
    - Target map or layer must exist
    - If parent_id provided, parent must exist and be on same target
    - Content cannot be empty or whitespace

    Args:
        comment_data: Comment creation schema

    Returns:
        Created comment details (status 201)

    Raises:
        400: Invalid data (missing target, invalid parent, empty content)
        404: Target map/layer or parent comment not found
    """
    service = CommentService(db)

    # Create comment with current user as author
    comment = service.create_comment(comment_data, current_user.id)

    # Reload to get relationships
    db.refresh(comment)
    comment = service.get_comment(comment.id)

    return populate_comment_fields(comment, service)


@router.put("/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: UUID,
    comment_update: CommentUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Update a comment's content.

    Only the comment author can update their comments.
    Supports partial updates.

    Authorization:
    - Only comment.author_id == current_user.id can update

    Args:
        comment_id: Comment UUID
        comment_update: Partial update schema (content)

    Returns:
        Updated comment details

    Raises:
        404: Comment not found
        403: User is not the comment author
        400: Invalid update data (empty content)
    """
    service = CommentService(db)

    # Get comment to check authorization
    comment = service.get_comment(comment_id)

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    # Check if user is the author
    if comment.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the comment author can update this comment",
        )

    # Update comment
    updated_comment = service.update_comment(comment_id, comment_update)

    # Reload to get relationships
    db.refresh(updated_comment)
    updated_comment = service.get_comment(updated_comment.id)

    return populate_comment_fields(updated_comment, service)


@router.delete("/{comment_id}", status_code=status.HTTP_200_OK)
async def delete_comment(
    comment_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Delete a comment.

    Only the comment author can delete their comments.
    Deletion cascades to all nested replies due to database constraints.

    Authorization:
    - Only comment.author_id == current_user.id can delete

    Args:
        comment_id: Comment UUID

    Returns:
        Status message

    Raises:
        404: Comment not found
        403: User is not the comment author

    Notes:
        - All nested replies will be automatically deleted (cascade)
        - This is a hard delete, not a soft delete
    """
    service = CommentService(db)

    # Get comment to check authorization
    comment = service.get_comment(comment_id)

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    # Check if user is the author
    if comment.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the comment author can delete this comment",
        )

    # Delete comment
    deleted = service.delete_comment(comment_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    return {"status": "deleted"}


@router.put("/{comment_id}/resolve", response_model=CommentResponse)
async def resolve_comment(
    comment_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    is_resolved: bool = Query(..., description="Resolution status (true/false)"),
):
    """
    Toggle comment resolution status.

    Any authenticated user with access to the map/layer can resolve/unresolve comments.
    This allows collaborators to mark discussion threads as complete.

    Authorization:
    - Any authenticated user can toggle resolution
    - No ownership check (unlike update/delete)

    Query parameters:
    - is_resolved: New resolution status (required)

    Args:
        comment_id: Comment UUID

    Returns:
        Updated comment details

    Raises:
        404: Comment not found

    Notes:
        - Resolution doesn't affect the comment content or replies
        - Can be toggled back and forth as needed
        - Useful for tracking which discussions are complete
    """
    service = CommentService(db)

    # Resolve comment (no author check required)
    comment = service.resolve_comment(comment_id, is_resolved)

    # Reload to get relationships
    db.refresh(comment)
    comment = service.get_comment(comment.id)

    return populate_comment_fields(comment, service)
