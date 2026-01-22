import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class LayerFeature(Base):
    __tablename__ = "layer_features"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    layer_id = Column(UUID(as_uuid=True), ForeignKey("layers.id"), nullable=False)

    # PostGIS geometry column (supports Point, LineString, Polygon, etc.)
    geometry = Column(Geometry(geometry_type="GEOMETRY", srid=4326), nullable=False)

    # GeoJSON properties stored as JSONB
    properties = Column(JSONB, default={})

    # Optional feature metadata
    feature_type = Column(String)  # point, linestring, polygon

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    layer = relationship("Layer", back_populates="features")
