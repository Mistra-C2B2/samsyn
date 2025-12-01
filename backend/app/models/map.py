import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class MapPermission(str, enum.Enum):
    private = "private"
    collaborators = "collaborators"
    public = "public"


class Map(Base):
    __tablename__ = "maps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(String)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    permission = Column(String, default="private")

    # Map viewport state
    center_lat = Column(Float, default=0.0)
    center_lng = Column(Float, default=0.0)
    zoom = Column(Float, default=2.0)

    # Additional metadata
    map_metadata = Column(JSONB, default={})

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    creator = relationship("User", back_populates="maps", foreign_keys=[created_by])
    collaborators = relationship("MapCollaborator", back_populates="map", cascade="all, delete-orphan")
    map_layers = relationship("MapLayer", back_populates="map", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="map")
