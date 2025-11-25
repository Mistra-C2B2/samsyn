# SamSyn Backend Implementation Plan

This document outlines the implementation plan for the SamSyn backend using Python, FastAPI, and SQLAlchemy.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Development Environment Setup](#development-environment-setup)
3. [Implementation Phases](#implementation-phases)
4. [Production Architecture](#production-architecture)
5. [Detailed File Specifications](#detailed-file-specifications)

---

## Project Structure

The backend will be placed in a `backend/` directory at the repository root, keeping it separate from the React frontend.

```
/workspace
├── backend/                      # Python backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI application entry point
│   │   ├── config.py            # Configuration management
│   │   ├── database.py          # Database connection and session
│   │   │
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── map.py
│   │   │   ├── layer.py
│   │   │   ├── feature.py
│   │   │   ├── comment.py
│   │   │   └── collaborator.py
│   │   │
│   │   ├── schemas/             # Pydantic schemas for validation
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── map.py
│   │   │   ├── layer.py
│   │   │   ├── feature.py
│   │   │   └── comment.py
│   │   │
│   │   ├── api/                 # API routes
│   │   │   ├── __init__.py
│   │   │   ├── deps.py          # Dependencies (auth, db session)
│   │   │   ├── v1/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── router.py    # Main API router
│   │   │   │   ├── users.py
│   │   │   │   ├── maps.py
│   │   │   │   ├── layers.py
│   │   │   │   ├── features.py
│   │   │   │   ├── comments.py
│   │   │   │   └── webhooks.py  # Clerk webhooks
│   │   │   └── health.py
│   │   │
│   │   ├── services/            # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── user_service.py
│   │   │   ├── map_service.py
│   │   │   ├── layer_service.py
│   │   │   ├── feature_service.py
│   │   │   └── auth_service.py  # Clerk JWT verification
│   │   │
│   │   └── utils/               # Utilities
│   │       ├── __init__.py
│   │       ├── geojson.py       # GeoJSON helpers
│   │       └── pagination.py
│   │
│   ├── alembic/                 # Database migrations
│   │   ├── versions/
│   │   ├── env.py
│   │   └── script.py.mako
│   │
│   ├── tests/                   # Tests
│   │   ├── __init__.py
│   │   ├── conftest.py          # Pytest fixtures
│   │   ├── test_maps.py
│   │   ├── test_layers.py
│   │   └── test_features.py
│   │
│   ├── alembic.ini              # Alembic configuration
│   ├── pyproject.toml           # Python project configuration
│   ├── requirements.txt         # Dependencies (generated from pyproject.toml)
│   └── Dockerfile               # Production Dockerfile
│
├── src/                         # Existing React frontend
├── .devcontainer/               # Existing devcontainer config
├── database-schema.md           # Database schema documentation
├── docker-compose.yml           # Development services (PostgreSQL, etc.)
├── docker-compose.prod.yml      # Production compose file
└── package.json                 # Frontend package.json
```

---

## Development Environment Setup

### 1. Update Devcontainer

The existing devcontainer already has Python 3.11 and `uv` installed. We need to add PostgreSQL with PostGIS as a companion service while keeping the devcontainer working as-is.

Keep the existing `.devcontainer/devcontainer.json` mostly unchanged. Create a separate compose file for database services that runs alongside the devcontainer.

**Create `docker-compose.yml` (in repository root):**

```yaml
version: '3.8'

services:
  db:
    image: postgis/postgis:16-3.4
    container_name: samsyn-db
    environment:
      POSTGRES_USER: samsyn
      POSTGRES_PASSWORD: samsyn
      POSTGRES_DB: samsyn
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - samsyn-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U samsyn"]
      interval: 5s
      timeout: 5s
      retries: 5

networks:
  samsyn-network:
    driver: bridge

volumes:
  postgres_data:
```

**Update `.devcontainer/devcontainer.json` to add the port and env var:**

```json
{
  "name": "Claude Code Sandbox",
  "build": {
    "dockerfile": "Dockerfile"
    // ... existing build config
  },
  // ... existing config ...
  "forwardPorts": [5173, 3000, 8000, 5432],
  "containerEnv": {
    "NODE_OPTIONS": "--max-old-space-size=4096",
    "CLAUDE_CONFIG_DIR": "/home/node/.claude",
    "POWERLEVEL9K_DISABLE_GITSTATUS": "true",
    "DATABASE_URL": "postgresql://samsyn:samsyn@host.docker.internal:5432/samsyn"
  }
  // ... rest of existing config
}
```

**Development workflow:**

```bash
# Terminal 1: Start database (run from host or another terminal)
docker-compose up -d db

# Inside devcontainer:
# Terminal 2: Start frontend
npm run dev

# Terminal 3: Start backend
cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

This approach keeps the existing devcontainer unchanged and just adds a database you can start when needed. You can run frontend-only work without the database running.

### 2. Backend Dependencies

**Create `backend/pyproject.toml`:**

```toml
[project]
name = "samsyn-backend"
version = "0.1.0"
description = "SamSyn Marine Spatial Planning Backend"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "sqlalchemy>=2.0.25",
    "geoalchemy2>=0.14.3",
    "psycopg2-binary>=2.9.9",
    "alembic>=1.13.1",
    "pydantic>=2.5.3",
    "pydantic-settings>=2.1.0",
    "python-jose[cryptography]>=3.3.0",
    "httpx>=0.26.0",
    "python-multipart>=0.0.6",
    "shapely>=2.0.2",
    "geojson>=3.1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.4",
    "pytest-asyncio>=0.23.3",
    "pytest-cov>=4.1.0",
    "black>=24.1.0",
    "ruff>=0.1.14",
    "mypy>=1.8.0",
]

[tool.black]
line-length = 88
target-version = ["py311"]

[tool.ruff]
line-length = 88
select = ["E", "F", "I", "N", "W"]

[tool.mypy]
python_version = "3.11"
strict = true
```

### 3. Development Workflow

**Initialize backend environment:**

```bash
# From repository root
cd backend

# Create virtual environment using uv (already installed in devcontainer)
uv venv

# Activate virtual environment
source .venv/bin/activate

# Install dependencies
uv pip install -e ".[dev]"

# Initialize alembic
alembic init alembic

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Add scripts to root `package.json`:**

```json
{
  "scripts": {
    "dev": "vite",
    "dev:backend": "cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000",
    "build": "vite build",
    "migrate": "cd backend && source .venv/bin/activate && alembic upgrade head",
    "migrate:new": "cd backend && source .venv/bin/activate && alembic revision --autogenerate -m"
  }
}
```

**Typical development workflow (3 terminals inside devcontainer):**

```bash
# Terminal 1: Start the database (if not already running)
docker-compose up -d db

# Terminal 2: Start frontend dev server (port 3000)
npm run dev

# Terminal 3: Start backend dev server (port 8000)
npm run dev:backend
```

Both servers run inside the devcontainer, frontend on port 3000, backend on port 8000. The frontend can proxy API requests to the backend (configured in vite.config.ts).

### 4. Environment Variables

**Create `.env.example`:**

```env
# Database
DATABASE_URL=postgresql://samsyn:samsyn@localhost:5432/samsyn

# Clerk Authentication
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# TiTiler (optional)
TITILER_URL=http://localhost:8001

# S3/Storage (optional)
S3_BUCKET=samsyn-data
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=eu-north-1
```

---

## Implementation Phases

### Phase 1: Core Setup (Foundation)

**Goal**: Get basic API running with database connection

**Tasks**:
1. Create backend directory structure
2. Set up FastAPI application with CORS
3. Configure SQLAlchemy with PostGIS
4. Create base models (User, Map, Layer)
5. Set up Alembic migrations
6. Create health check endpoint
7. Update docker-compose for PostgreSQL

**Files to create**:
- `backend/app/main.py`
- `backend/app/config.py`
- `backend/app/database.py`
- `backend/app/models/__init__.py`
- `backend/app/api/health.py`

**Deliverable**: `/api/health` returns OK, database connects

---

### Phase 2: Authentication

**Goal**: Integrate Clerk authentication

**Tasks**:
1. Create auth service for JWT verification
2. Set up Clerk webhook endpoint for user sync
3. Create User model and sync logic
4. Create authentication dependency
5. Protect routes with auth middleware

**Files to create**:
- `backend/app/services/auth_service.py`
- `backend/app/api/deps.py`
- `backend/app/api/v1/webhooks.py`
- `backend/app/models/user.py`

**Deliverable**: Protected endpoints verify Clerk JWT, users sync via webhook

---

### Phase 3: Maps CRUD

**Goal**: Full map management API

**Tasks**:
1. Create Map model with all fields
2. Create MapCollaborator model
3. Create Pydantic schemas
4. Implement CRUD endpoints
5. Implement permission checks
6. Add collaborator management

**Endpoints**:
- `GET /api/v1/maps` - List user's maps
- `GET /api/v1/maps/{id}` - Get map details
- `POST /api/v1/maps` - Create map
- `PUT /api/v1/maps/{id}` - Update map
- `DELETE /api/v1/maps/{id}` - Delete map
- `GET /api/v1/maps/{id}/collaborators` - List collaborators
- `POST /api/v1/maps/{id}/collaborators` - Add collaborator
- `DELETE /api/v1/maps/{id}/collaborators/{user_id}` - Remove collaborator

**Files to create**:
- `backend/app/models/map.py`
- `backend/app/models/collaborator.py`
- `backend/app/schemas/map.py`
- `backend/app/services/map_service.py`
- `backend/app/api/v1/maps.py`

---

### Phase 4: Layers API

**Goal**: Layer management for all source types (WMS, GeoTIFF, Vector)

**Tasks**:
1. Create Layer model with JSONB fields
2. Create Pydantic schemas for each source type
3. Implement layer CRUD
4. Implement global layer library
5. Add layer-to-map association (MapLayers)

**Endpoints**:
- `GET /api/v1/layers` - Get layer library (with filters)
- `GET /api/v1/layers/{id}` - Get layer details
- `POST /api/v1/layers` - Create layer
- `PUT /api/v1/layers/{id}` - Update layer
- `DELETE /api/v1/layers/{id}` - Delete layer
- `POST /api/v1/maps/{id}/layers` - Add layer to map
- `DELETE /api/v1/maps/{id}/layers/{layer_id}` - Remove from map
- `PUT /api/v1/maps/{id}/layers/reorder` - Reorder layers

**Files to create**:
- `backend/app/models/layer.py`
- `backend/app/schemas/layer.py`
- `backend/app/services/layer_service.py`
- `backend/app/api/v1/layers.py`

---

### Phase 5: Vector Features

**Goal**: CRUD for vector layer features with spatial queries

**Tasks**:
1. Create LayerFeature model with PostGIS geometry
2. Create GeoJSON conversion utilities
3. Implement feature CRUD
4. Add spatial query support (within bounds, intersects)
5. Add pagination for large feature sets

**Endpoints**:
- `GET /api/v1/layers/{id}/features` - Get features (paginated, spatial filter)
- `GET /api/v1/layers/{id}/features/{feature_id}` - Get single feature
- `POST /api/v1/layers/{id}/features` - Add feature(s)
- `PUT /api/v1/layers/{id}/features/{feature_id}` - Update feature
- `DELETE /api/v1/layers/{id}/features/{feature_id}` - Delete feature
- `POST /api/v1/layers/{id}/features/bulk` - Bulk import GeoJSON

**Files to create**:
- `backend/app/models/feature.py`
- `backend/app/schemas/feature.py`
- `backend/app/services/feature_service.py`
- `backend/app/api/v1/features.py`
- `backend/app/utils/geojson.py`

---

### Phase 6: Comments

**Goal**: Threaded comments on maps and layers

**Tasks**:
1. Create Comment model with self-referential relationship
2. Implement comment CRUD
3. Add threading support
4. Add resolution status

**Endpoints**:
- `GET /api/v1/comments` - Get comments (filter by map/layer)
- `POST /api/v1/comments` - Create comment
- `PUT /api/v1/comments/{id}` - Update comment
- `DELETE /api/v1/comments/{id}` - Delete comment
- `PUT /api/v1/comments/{id}/resolve` - Mark resolved

**Files to create**:
- `backend/app/models/comment.py`
- `backend/app/schemas/comment.py`
- `backend/app/api/v1/comments.py`

---

### Phase 7: Frontend Integration

**Goal**: Connect React frontend to backend API

**Tasks**:
1. Create API client service in frontend
2. Replace mock data with API calls
3. Add loading states
4. Add error handling
5. Update environment configuration

**Frontend files to modify**:
- `src/App.tsx` - Replace mock data with API calls
- `src/services/api.ts` - New API client
- `vite.config.ts` - Add API proxy for development

---

## Production Architecture

### Overview

```
                                    ┌─────────────────┐
                                    │   CloudFront    │
                                    │   (CDN/Cache)   │
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
           ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
           │  S3 Bucket    │       │   ALB/NLB     │       │   TiTiler     │
           │  (Frontend)   │       │               │       │   (Lambda)    │
           └───────────────┘       └───────┬───────┘       └───────────────┘
                                           │
                                           ▼
                                  ┌───────────────┐
                                  │  ECS Fargate  │
                                  │  (FastAPI)    │
                                  └───────┬───────┘
                                           │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
           ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
           │    RDS        │       │ ElastiCache   │       │   S3 Bucket   │
           │  PostgreSQL   │       │   (Redis)     │       │   (GeoTIFFs)  │
           └───────────────┘       └───────────────┘       └───────────────┘
```

### Production Components

#### 1. Database: AWS RDS PostgreSQL + PostGIS

```yaml
# terraform/rds.tf (conceptual)
Engine: postgres
Version: 16
Instance: db.r6g.large (or larger based on load)
Storage: gp3, 100GB initial
Extensions: postgis, pg_trgm
Multi-AZ: true (for production)
Backup: 7 days retention
```

#### 2. Backend: AWS ECS Fargate

**`backend/Dockerfile`:**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PostGIS
RUN apt-get update && apt-get install -y \
    libpq-dev \
    libgeos-dev \
    libproj-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .

# Run with gunicorn for production
CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
```

**ECS Task Definition:**
- CPU: 512 or 1024
- Memory: 1024 or 2048
- Auto-scaling based on CPU/memory
- Health check on `/api/health`

#### 3. Frontend: S3 + CloudFront

```bash
# Build and deploy
npm run build
aws s3 sync build/ s3://samsyn-frontend/
aws cloudfront create-invalidation --distribution-id XXX --paths "/*"
```

#### 4. TiTiler: AWS Lambda

Use the official TiTiler CDK stack or SAM template:
- Serverless, scales automatically
- Direct S3 access for GeoTIFFs
- CloudFront caching for tiles

#### 5. File Storage: S3

```
s3://samsyn-data/
├── geotiffs/
│   ├── bathymetry/
│   └── temporal/
│       └── chlorophyll/
│           └── 2023/
│               └── 01/
│                   └── chlor_a_202301.tif
└── uploads/
    └── user-uploads/
```

### Production Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@samsyn-db.xxx.eu-north-1.rds.amazonaws.com:5432/samsyn

# Clerk
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# Frontend
FRONTEND_URL=https://samsyn.io

# TiTiler
TITILER_URL=https://titiler.samsyn.io

# S3
S3_BUCKET=samsyn-data
AWS_REGION=eu-north-1

# Redis (optional, for caching)
REDIS_URL=redis://samsyn-cache.xxx.cache.amazonaws.com:6379
```

### Production Docker Compose (for staging/self-hosted)

**`docker-compose.prod.yml`:**

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
      - FRONTEND_URL=${FRONTEND_URL}
    ports:
      - "8000:8000"
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  titiler:
    image: ghcr.io/developmentseed/titiler:latest
    ports:
      - "8001:8000"
    environment:
      - CPL_VSIL_CURL_ALLOWED_EXTENSIONS=.tif,.TIF,.tiff
      - GDAL_CACHEMAX=200
      - GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR
      - GDAL_HTTP_MERGE_CONSECUTIVE_RANGES=YES
      - GDAL_HTTP_MULTIPLEX=YES
      - GDAL_HTTP_VERSION=2
      - VSI_CACHE=TRUE
      - VSI_CACHE_SIZE=5000000
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./frontend-build:/usr/share/nginx/html:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on:
      - backend
      - titiler
    restart: unless-stopped

volumes:
  postgres_data:
```

---

## Detailed File Specifications

### `backend/app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.v1.router import api_router
from app.api.health import health_router

app = FastAPI(
    title="SamSyn API",
    description="Marine Spatial Planning Backend",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health_router, tags=["health"])
app.include_router(api_router, prefix="/api/v1")
```

### `backend/app/config.py`

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    CLERK_SECRET_KEY: str
    CLERK_WEBHOOK_SECRET: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    TITILER_URL: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
```

### `backend/app/database.py`

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### `backend/app/models/layer.py`

```python
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Enum, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base

class SourceType(str, Enum):
    wms = "wms"
    geotiff = "geotiff"
    vector = "vector"

class EditPermission(str, Enum):
    creator_only = "creator-only"
    everyone = "everyone"

class Layer(Base):
    __tablename__ = "layers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    source_type = Column(String, nullable=False)  # wms, geotiff, vector
    description = Column(String)
    category = Column(String)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    editable = Column(String, default="creator-only")
    is_global = Column(Boolean, default=False)

    source_config = Column(JSONB, nullable=False, default={})
    style_config = Column(JSONB, default={})
    legend_config = Column(JSONB, default={})
    metadata = Column(JSONB, default={})

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    creator = relationship("User", back_populates="layers")
    features = relationship("LayerFeature", back_populates="layer", cascade="all, delete-orphan")
    map_layers = relationship("MapLayer", back_populates="layer")
```

### `backend/app/schemas/layer.py`

```python
from uuid import UUID
from datetime import datetime
from typing import Optional, Literal, Any
from pydantic import BaseModel

class WMSSourceConfig(BaseModel):
    url: str
    layers: str
    version: str = "1.3.0"
    format: str = "image/png"
    transparent: bool = True
    temporal: Optional[dict] = None
    dimensions: Optional[dict] = None

class GeoTIFFSourceConfig(BaseModel):
    delivery: Literal["direct", "tiles"]
    url: Optional[str] = None
    cogUrl: Optional[str] = None
    cogUrlTemplate: Optional[str] = None
    tileServer: Optional[str] = None
    bounds: Optional[list] = None
    temporal: Optional[dict] = None
    tileParams: Optional[dict] = None
    processing: Optional[dict] = None

class VectorSourceConfig(BaseModel):
    geometryType: str
    featureCount: Optional[int] = 0
    bounds: Optional[list] = None

class LayerCreate(BaseModel):
    name: str
    source_type: Literal["wms", "geotiff", "vector"]
    description: Optional[str] = None
    category: Optional[str] = None
    is_global: bool = False
    editable: Literal["creator-only", "everyone"] = "creator-only"
    source_config: dict
    style_config: Optional[dict] = {}
    legend_config: Optional[dict] = {}
    metadata: Optional[dict] = {}

class LayerResponse(BaseModel):
    id: UUID
    name: str
    source_type: str
    description: Optional[str]
    category: Optional[str]
    created_by: UUID
    is_global: bool
    editable: str
    source_config: dict
    style_config: dict
    legend_config: dict
    metadata: dict
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

### `backend/app/api/v1/layers.py`

```python
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.layer import LayerCreate, LayerResponse
from app.services.layer_service import LayerService

router = APIRouter(prefix="/layers", tags=["layers"])

@router.get("", response_model=list[LayerResponse])
def list_layers(
    source_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    is_global: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List layers (global library or user's own)"""
    service = LayerService(db)
    return service.list_layers(
        user_id=current_user.id,
        source_type=source_type,
        category=category,
        is_global=is_global,
    )

@router.post("", response_model=LayerResponse)
def create_layer(
    layer: LayerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new layer"""
    service = LayerService(db)
    return service.create_layer(layer, current_user.id)

@router.get("/{layer_id}", response_model=LayerResponse)
def get_layer(
    layer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get layer by ID"""
    service = LayerService(db)
    layer = service.get_layer(layer_id)
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    return layer

@router.put("/{layer_id}", response_model=LayerResponse)
def update_layer(
    layer_id: UUID,
    layer_update: LayerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update layer"""
    service = LayerService(db)
    layer = service.get_layer(layer_id)
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    if layer.created_by != current_user.id and layer.editable == "creator-only":
        raise HTTPException(status_code=403, detail="Not authorized to edit this layer")
    return service.update_layer(layer_id, layer_update)

@router.delete("/{layer_id}")
def delete_layer(
    layer_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete layer"""
    service = LayerService(db)
    layer = service.get_layer(layer_id)
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    if layer.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this layer")
    service.delete_layer(layer_id)
    return {"status": "deleted"}
```

---

## Summary

This implementation plan provides:

1. **Clear project structure** - Backend in `backend/` directory, separate from frontend
2. **Development environment** - Uses existing devcontainer with added PostgreSQL/PostGIS via docker-compose
3. **Phased implementation** - 7 phases from foundation to frontend integration
4. **Production architecture** - AWS-based with RDS, ECS, S3, CloudFront, and TiTiler
5. **Code examples** - Key files with implementation details

The backend is designed to:
- Support all three layer types (WMS, GeoTIFF, Vector) from the database schema
- Integrate with Clerk authentication
- Scale from development to production
- Work seamlessly with TiTiler for raster tile serving
