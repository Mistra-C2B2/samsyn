import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class WmsServer(Base):
    """Saved WMS server configuration for easy layer discovery"""

    __tablename__ = "wms_servers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    base_url = Column(String, nullable=False, unique=True)
    description = Column(String)

    # WMS server metadata from GetCapabilities
    version = Column(String)  # "1.1.1" or "1.3.0"
    service_title = Column(String)
    service_provider = Column(String)
    layer_count = Column(Integer, default=0)

    # Cached GetCapabilities response
    capabilities_cache = Column(JSONB, default={})
    cached_at = Column(DateTime)

    # Creator tracking
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    creator = relationship("User", back_populates="wms_servers")
