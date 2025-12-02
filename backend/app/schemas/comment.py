"""
Comment Pydantic schemas for request/response validation.

These schemas handle data validation for:
- Comment creation on maps or layers
- Comment updates
- Threaded comment responses
- Parent-child comment relationships
- Resolution status tracking
"""

from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, ConfigDict


class CommentCreate(BaseModel):
    """
    Schema for creating a new comment.

    Comments must be attached to either a map OR a layer (XOR logic).
    Comments can optionally be replies to parent comments.
    """

    content: str = Field(..., min_length=1, description="Comment content (cannot be empty)")
    map_id: Optional[UUID] = Field(default=None, description="ID of the map this comment is on")
    layer_id: Optional[UUID] = Field(default=None, description="ID of the layer this comment is on")
    parent_id: Optional[UUID] = Field(default=None, description="ID of parent comment for threading")

    @field_validator('content')
    @classmethod
    def validate_content_not_empty(cls, v):
        """Validate that content is not just whitespace"""
        if not v or not v.strip():
            raise ValueError("Comment content cannot be empty or whitespace")
        return v.strip()

    @field_validator('layer_id')
    @classmethod
    def validate_target_xor(cls, v, info):
        """
        Validate that exactly one of map_id or layer_id is provided.

        Comments must be attached to either a map OR a layer, not both, not neither.
        """
        map_id = info.data.get('map_id')

        # Check XOR logic: exactly one must be provided
        if map_id is None and v is None:
            raise ValueError("Either map_id or layer_id must be provided")

        if map_id is not None and v is not None:
            raise ValueError("Cannot provide both map_id and layer_id - comment must be on either a map or a layer, not both")

        return v


class CommentUpdate(BaseModel):
    """
    Schema for updating a comment.

    Only content can be updated. All fields are optional to support partial updates.
    """

    content: Optional[str] = Field(default=None, min_length=1, description="Updated comment content")

    @field_validator('content')
    @classmethod
    def validate_content_not_empty(cls, v):
        """Validate that content is not just whitespace if provided"""
        if v is not None:
            if not v.strip():
                raise ValueError("Comment content cannot be empty or whitespace")
            return v.strip()
        return v


class CommentResponse(BaseModel):
    """
    Schema for comment API responses.

    Returns complete comment data including metadata and computed fields.
    """

    id: UUID
    content: str
    author_id: UUID
    map_id: Optional[UUID] = None
    layer_id: Optional[UUID] = None
    parent_id: Optional[UUID] = None
    is_resolved: bool = False
    created_at: datetime
    updated_at: datetime

    # Computed fields (populated by service layer)
    author_name: Optional[str] = Field(
        default=None,
        description="Display name of comment author (from User relationship)"
    )
    reply_count: Optional[int] = Field(
        default=0,
        description="Number of direct replies to this comment"
    )

    model_config = ConfigDict(from_attributes=True)


class CommentWithReplies(CommentResponse):
    """
    Schema for threaded comment responses.

    Extends CommentResponse to include nested replies for building comment threads.
    """

    replies: List[CommentResponse] = Field(
        default_factory=list,
        description="List of direct replies to this comment"
    )

    model_config = ConfigDict(from_attributes=True)
