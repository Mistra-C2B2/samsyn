import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Comment(Base):
    __tablename__ = "comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content = Column(String, nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Comments can be on maps or specific layers
    map_id = Column(UUID(as_uuid=True), ForeignKey("maps.id"))
    layer_id = Column(UUID(as_uuid=True), ForeignKey("layers.id"))

    # Threading support
    parent_id = Column(UUID(as_uuid=True), ForeignKey("comments.id"))

    # Resolution status
    is_resolved = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    author = relationship("User", back_populates="comments")
    map = relationship("Map", back_populates="comments")
    layer = relationship("Layer", back_populates="comments")
    parent = relationship("Comment", remote_side=[id], backref="replies")
