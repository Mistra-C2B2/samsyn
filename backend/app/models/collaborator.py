import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class MapCollaborator(Base):
    __tablename__ = "map_collaborators"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    map_id = Column(UUID(as_uuid=True), ForeignKey("maps.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(String, default="viewer")  # viewer, editor, admin

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    map = relationship("Map", back_populates="collaborators")
    user = relationship("User", back_populates="collaborations")
