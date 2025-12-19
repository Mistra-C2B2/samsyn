import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base


class Layer(Base):
    __tablename__ = "layers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    source_type = Column(String, nullable=False)  # wms, geotiff, vector
    description = Column(String)
    category = Column(String)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    editable = Column(String, default="creator-only")  # creator-only, everyone
    is_global = Column(Boolean, default=False)

    # JSONB fields for flexible configuration
    source_config = Column(JSONB, nullable=False, default={})
    style_config = Column(JSONB, default={})
    legend_config = Column(JSONB, default={})
    layer_metadata = Column(JSONB, default={})

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    creator = relationship("User", back_populates="layers")
    features = relationship("LayerFeature", back_populates="layer", cascade="all, delete-orphan")
    map_layers = relationship("MapLayer", back_populates="layer", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="layer", cascade="all, delete-orphan")


class MapLayer(Base):
    """Junction table for many-to-many relationship between Maps and Layers"""
    __tablename__ = "map_layers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    map_id = Column(UUID(as_uuid=True), ForeignKey("maps.id"), nullable=False)
    layer_id = Column(UUID(as_uuid=True), ForeignKey("layers.id"), nullable=False)
    order = Column(Integer, nullable=False, default=0)  # For layer ordering in map
    visible = Column(Boolean, default=True)
    opacity = Column(Integer, default=100)  # 0-100

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    map = relationship("Map", back_populates="map_layers")
    layer = relationship("Layer", back_populates="map_layers")
