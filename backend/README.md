# SamSyn Backend

FastAPI-based backend for SamSyn marine spatial planning application.

## Tech Stack

- **Framework**: FastAPI 0.122+
- **Database**: PostgreSQL 16 with PostGIS 3.4
- **ORM**: SQLAlchemy 2.0 with GeoAlchemy2
- **Migrations**: Alembic
- **Authentication**: Clerk
- **Package Manager**: uv
- **Testing**: pytest with transaction-based isolation

## Quick Start

### Prerequisites

- Python 3.11+
- uv package manager
- PostgreSQL with PostGIS (via Docker)

### Installation

```bash
# Install dependencies
cd backend
uv sync

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start database (from repository root)
docker-compose -f docker-compose.dev.yml up -d db

# Run migrations
uv run alembic upgrade head

# Start development server
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at http://localhost:8000

### Using npm Scripts (from repository root)

```bash
npm run dev:backend    # Start backend server
npm run migrate        # Run database migrations
npm run migrate:new    # Create new migration
```

> **Note:** Frontend is located in `/workspace/frontend/`. Frontend development server is started via `npm run dev` from repository root.

## Testing

### Test Database Setup

The backend uses a **separate test database** (`samsyn_test`) to avoid affecting development data.

#### First-Time Setup

```bash
cd backend
./setup_test_db.sh
```

This script will:
1. Create the `samsyn_test` database
2. Enable PostGIS extension
3. Run all migrations

#### Running Tests

```bash
# Run all tests
uv run pytest tests/

# Run specific test file
uv run pytest tests/test_map_service.py

# Run with verbose output
uv run pytest tests/ -v

# Run specific test
uv run pytest tests/test_map_service.py::TestMapCRUD::test_create_map -v
```

#### Test Configuration

Tests use **transaction-based isolation**:
- Each test runs in its own transaction
- All changes are automatically rolled back after the test
- No manual cleanup needed
- Fast execution (~3 seconds for 253 tests)

**Important**: Tests use `db_session.flush()` instead of `db_session.commit()` to maintain transaction isolation.

#### Resetting Test Database

If you need to start fresh:

```bash
# Drop and recreate test database
PGPASSWORD=samsyn psql -h samsyn-db -U samsyn -d postgres -c "DROP DATABASE IF EXISTS samsyn_test;"
./setup_test_db.sh
```

#### After Schema Changes

Run the setup script to apply new migrations to the test database:

```bash
./setup_test_db.sh
```

### Test Structure

```
tests/
├── conftest.py                      # Pytest configuration and fixtures
├── test_auth_service.py             # JWT authentication tests
├── test_user_service.py             # User CRUD tests
├── test_layer_service.py            # Layer CRUD and filtering tests
├── test_map_service.py              # Map CRUD and permissions tests
├── test_feature_service.py          # Feature CRUD and spatial query tests
├── test_comment_service.py          # Comment CRUD and threading tests
├── test_webhooks.py                 # Webhook endpoint tests
└── test_webhooks_integration.py     # Full webhook flow tests
```

## Project Structure

```
backend/
├── alembic/                  # Database migrations
│   └── versions/            # Migration files
├── app/
│   ├── api/                 # API routes
│   │   └── v1/             # API v1 endpoints
│   ├── models/             # SQLAlchemy models
│   ├── schemas/            # Pydantic schemas
│   ├── services/           # Business logic layer
│   ├── config.py           # Configuration settings
│   ├── database.py         # Database connection
│   └── main.py             # FastAPI application
├── tests/                   # Test suite
├── .env                     # Environment variables (not in git)
├── .env.example            # Environment template
├── pyproject.toml          # Project dependencies and config
├── uv.lock                 # Dependency lock file
└── setup_test_db.sh        # Test database setup script
```

## API Documentation

When the server is running, interactive API documentation is available at:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Database

### Running Migrations

```bash
# Apply all pending migrations
uv run alembic upgrade head

# Create a new migration
uv run alembic revision --autogenerate -m "description"

# Rollback one migration
uv run alembic downgrade -1

# View migration history
uv run alembic history
```

### Database Schema

Key tables:
- `users` - User accounts (synced from Clerk)
- `maps` - User-created maps with collaborators
- `layers` - Data layers (WMS, GeoTIFF, vector)
- `layer_features` - GeoJSON features for vector layers
- `comments` - Comments on maps/layers with threading
- `map_collaborators` - Map sharing and permissions
- `map_layers` - Layer associations with maps

### PostGIS Support

The database uses PostGIS for spatial operations:
- Geometry columns (POINT, LINESTRING, POLYGON)
- Spatial indexing
- Bounding box queries
- Spatial relationships

## Authentication

The backend uses **Clerk** for authentication:

1. Users authenticate through Clerk in the frontend
2. Frontend sends JWT token in `Authorization: Bearer <token>` header
3. Backend verifies JWT using Clerk's JWKS endpoint
4. User data is synced via Clerk webhooks

### Required Environment Variables

```bash
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
CLERK_JWKS_URL=https://your-app.clerk.accounts.dev/.well-known/jwks.json
```

## Development

### Code Style

```bash
# The project uses uv for dependency management
# All Python code follows PEP 8

# Run linting (if configured)
uv run ruff check .

# Format code (if configured)
uv run black .
```

### Adding Dependencies

```bash
# Add production dependency
uv add package-name

# Add dev dependency
uv add --dev package-name

# Sync dependencies after pulling changes
uv sync
```

## Troubleshooting

### Database Connection Issues

```bash
# Check if database is running
docker ps | grep samsyn-db

# Start database
docker-compose -f docker-compose.dev.yml up -d db

# Check database logs
docker logs samsyn-db
```

### Migration Issues

```bash
# Check current migration version
uv run alembic current

# View migration history
uv run alembic history

# If migrations are out of sync, try:
uv run alembic stamp head
uv run alembic upgrade head
```

### Test Database Issues

```bash
# If tests fail with database errors, recreate test database:
PGPASSWORD=samsyn psql -h samsyn-db -U samsyn -d postgres -c "DROP DATABASE IF EXISTS samsyn_test;"
./setup_test_db.sh
```

### Port Already in Use

```bash
# If port 8000 is already in use:
# 1. Find the process
lsof -i :8000

# 2. Kill it
kill -9 <PID>

# Or use a different port
uv run uvicorn app.main:app --reload --port 8001
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://samsyn:samsyn@samsyn-db:5432/samsyn
TEST_DATABASE_URL=postgresql://samsyn:samsyn@samsyn-db:5432/samsyn_test

# Clerk Authentication
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
CLERK_JWKS_URL=https://your-app.clerk.accounts.dev/.well-known/jwks.json

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000,https://clerk.shared.lcl.dev

# TiTiler (for GeoTIFF/COG tile serving)
TITILER_URL=http://localhost:8001
```

## Contributing

1. Create a new branch for your feature
2. Write tests for new functionality
3. Ensure all tests pass: `uv run pytest tests/`
4. Create a pull request

## License

[Your License Here]
