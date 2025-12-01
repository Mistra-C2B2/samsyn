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

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL` - PostgreSQL connection string
- `FRONTEND_URL` - Frontend URL for CORS (default: http://localhost:3000)
- `CLERK_SECRET_KEY` - Clerk authentication secret (required for auth)
- `CLERK_WEBHOOK_SECRET` - Clerk webhook secret (required for user sync)
