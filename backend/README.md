# SamSyn Backend

FastAPI backend for the SamSyn marine spatial planning application.

## Setup

### 1. Start the Database

From the repository root (outside devcontainer or from host):

```bash
docker-compose up -d db
```

This starts a PostgreSQL database with PostGIS extension on port 5432.

### 2. Install Dependencies

Inside the devcontainer:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

### 3. Run Migrations

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
```

### 4. Start the Backend Server

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or from the repository root:

```bash
npm run dev:backend
```

## Development

### Creating a New Migration

After modifying models:

```bash
cd backend
source .venv/bin/activate
alembic revision --autogenerate -m "Description of changes"
alembic upgrade head
```

### Running Tests

```bash
cd backend
source .venv/bin/activate
pip install -e ".[dev]"
pytest
```

## API Documentation

Once the server is running, visit:
- OpenAPI docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health check: http://localhost:8000/health

## API Endpoints

### Health Check

| Method | Path | Auth | Description | Location |
|--------|------|------|-------------|----------|
| GET | `/health` | None | Basic health check | `app/api/health.py:10` |
| GET | `/health/db` | None | Health check with database test | `app/api/health.py:16` |

### Maps

| Method | Path | Auth | Description | Location |
|--------|------|------|-------------|----------|
| GET | `/api/v1/maps` | Optional | List all accessible maps | `app/api/v1/maps.py:192` |
| GET | `/api/v1/maps/{map_id}` | Optional | Get map by ID | `app/api/v1/maps.py:244` |
| POST | `/api/v1/maps` | Required | Create a new map | `app/api/v1/maps.py:287` |
| PUT | `/api/v1/maps/{map_id}` | Required | Update map properties | `app/api/v1/maps.py:314` |
| DELETE | `/api/v1/maps/{map_id}` | Required | Delete a map (owner only) | `app/api/v1/maps.py:361` |

### Map Collaborators

| Method | Path | Auth | Description | Location |
|--------|------|------|-------------|----------|
| GET | `/api/v1/maps/{map_id}/collaborators` | Optional | List collaborators | `app/api/v1/maps.py:403` |
| POST | `/api/v1/maps/{map_id}/collaborators` | Required | Add collaborator by email | `app/api/v1/maps.py:437` |
| PUT | `/api/v1/maps/{map_id}/collaborators/{user_id}` | Required | Update collaborator role | `app/api/v1/maps.py:532` |
| DELETE | `/api/v1/maps/{map_id}/collaborators/{user_id}` | Required | Remove collaborator | `app/api/v1/maps.py:593` |

### Map Layers

| Method | Path | Auth | Description | Location |
|--------|------|------|-------------|----------|
| POST | `/api/v1/maps/{map_id}/layers` | Required | Add layer to map | `app/api/v1/maps.py:653` |
| PUT | `/api/v1/maps/{map_id}/layers/reorder` | Required | Reorder all layers | `app/api/v1/maps.py:716` |
| PUT | `/api/v1/maps/{map_id}/layers/{layer_id}` | Required | Update layer display properties | `app/api/v1/maps.py:835` |
| DELETE | `/api/v1/maps/{map_id}/layers/{layer_id}` | Required | Remove layer from map | `app/api/v1/maps.py:783` |

### Layers

| Method | Path | Auth | Description | Location |
|--------|------|------|-------------|----------|
| GET | `/api/v1/layers` | Optional | List layers with filtering | `app/api/v1/layers.py:117` |
| GET | `/api/v1/layers/{layer_id}` | None | Get layer by ID | `app/api/v1/layers.py:153` |
| POST | `/api/v1/layers` | Required | Create a new layer | `app/api/v1/layers.py:186` |
| PUT | `/api/v1/layers/{layer_id}` | Required | Update layer properties | `app/api/v1/layers.py:210` |
| DELETE | `/api/v1/layers/{layer_id}` | Required | Delete layer (creator only) | `app/api/v1/layers.py:257` |

### Features

| Method | Path | Auth | Description | Location |
|--------|------|------|-------------|----------|
| GET | `/api/v1/layers/{layer_id}/features` | Optional | List features with bbox filtering | `app/api/v1/features.py:94` |
| GET | `/api/v1/layers/{layer_id}/features/{feature_id}` | Optional | Get feature by ID | `app/api/v1/features.py:169` |
| POST | `/api/v1/layers/{layer_id}/features` | Required | Create a feature | `app/api/v1/features.py:214` |
| POST | `/api/v1/layers/{layer_id}/features/bulk` | Required | Bulk import from GeoJSON | `app/api/v1/features.py:259` |
| PUT | `/api/v1/layers/{layer_id}/features/{feature_id}` | Required | Update feature | `app/api/v1/features.py:337` |
| DELETE | `/api/v1/layers/{layer_id}/features/{feature_id}` | Required | Delete feature | `app/api/v1/features.py:400` |

### Comments

| Method | Path | Auth | Description | Location |
|--------|------|------|-------------|----------|
| GET | `/api/v1/comments` | Optional | List comments with filters | `app/api/v1/comments.py:94` |
| GET | `/api/v1/comments/{comment_id}` | Optional | Get comment by ID | `app/api/v1/comments.py:141` |
| GET | `/api/v1/comments/{comment_id}/thread` | Optional | Get comment with nested replies | `app/api/v1/comments.py:173` |
| POST | `/api/v1/comments` | Required | Create a comment | `app/api/v1/comments.py:217` |
| PUT | `/api/v1/comments/{comment_id}` | Required | Update comment (author only) | `app/api/v1/comments.py:257` |
| PUT | `/api/v1/comments/{comment_id}/resolve` | Required | Toggle resolution status | `app/api/v1/comments.py:372` |
| DELETE | `/api/v1/comments/{comment_id}` | Required | Delete comment (author only) | `app/api/v1/comments.py:313` |

### Webhooks

| Method | Path | Auth | Description | Location |
|--------|------|------|-------------|----------|
| POST | `/api/v1/webhooks/clerk` | Svix Signature | Handle Clerk user events | `app/api/v1/webhooks.py:25` |

### Test Endpoints (Development Only)

| Method | Path | Auth | Description | Location |
|--------|------|------|-------------|----------|
| GET | `/api/v1/test/auth/required` | Required | Test required auth | `app/api/v1/test_auth.py:20` |
| GET | `/api/v1/test/auth/optional` | Optional | Test optional auth | `app/api/v1/test_auth.py:46` |
| GET | `/api/v1/test/health` | None | Test health check | `app/api/v1/test_auth.py:75` |
| POST | `/api/v1/test-webhooks/clerk` | None | Test webhook (no signature) | `app/api/v1/test_webhooks.py:21` |

## Authentication

Authentication uses Clerk JWT tokens via Bearer authentication.

**Auth Types:**
- **None**: Public endpoint, no authentication required
- **Optional**: Works with or without authentication (returns more data when authenticated)
- **Required**: Must provide valid Bearer token, returns 401 otherwise

**Header Format:**
```
Authorization: Bearer <clerk_jwt_token>
```

See `app/api/deps.py` for authentication dependency implementations.

## Permissions

### Maps
- **Private**: Only owner and collaborators can access
- **Collaborators**: Owner, editors, and viewers can access
- **Public**: Anyone can view

### Collaborator Roles
- **Owner**: Full control, can delete map and manage collaborators
- **Editor**: Can modify map and layers
- **Viewer**: Read-only access

### Layers
- Creator can always edit/delete
- `everyone_can_edit` flag allows any authenticated user to edit

### Comments
- Author can update/delete their own comments
- Threaded replies supported with `parent_id`

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL` - PostgreSQL connection string
- `FRONTEND_URL` - Frontend URL for CORS (default: http://localhost:3000)
- `CLERK_SECRET_KEY` - Clerk authentication secret (required for auth)
- `CLERK_WEBHOOK_SECRET` - Clerk webhook secret (required for user sync)
