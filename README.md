# SamSyn

Marine Spatial Planning application with React frontend and Python FastAPI backend.

Original Figma design: https://www.figma.com/design/B7evwPwamo0GPIBMmQFH7z/SamSyn

## Project Structure

```
/workspace
├── src/                    # React frontend
├── backend/                # Python FastAPI backend
│   ├── app/               # Application code
│   ├── alembic/           # Database migrations
│   └── tests/             # Tests
├── docker-compose.yml     # PostgreSQL database
└── package.json           # Frontend & backend scripts
```

## Quick Start

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
python3 -m venv .venv
.venv/bin/pip install -e .
cd ..
```

Or use the helper script:
```bash
cd backend && ./setup.sh && cd ..
```

### 2. Start the Database

Start PostgreSQL with PostGIS (from host or outside devcontainer):

```bash
docker-compose up -d db
```

This starts PostgreSQL on port 5432 with:
- Database: `samsyn`
- User: `samsyn`
- Password: `samsyn`

### 3. Run Database Migrations

```bash
npm run migrate
```

Or manually:
```bash
cd backend
.venv/bin/alembic upgrade head
```

### 4. Start Development Servers

You'll need three terminal windows:

**Terminal 1: Database (if not already running)**
```bash
docker-compose up -d db
```

**Terminal 2: Frontend**
```bash
npm run dev
```
Frontend will be available at http://localhost:5173

**Terminal 3: Backend**
```bash
npm run dev:backend
```
Backend API will be available at http://localhost:8000

## Development

### Frontend (React + Vite)

- **Dev server**: `npm run dev` (http://localhost:5173)
- **Build**: `npm run build`
- **Tech**: React 18, TypeScript, Tailwind CSS, shadcn/ui, Mapbox GL JS
- **Auth**: Clerk (configure with `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local`)

### Backend (Python + FastAPI)

- **Dev server**: `npm run dev:backend` (http://localhost:8000)
- **API docs**: http://localhost:8000/docs
- **Tech**: FastAPI, SQLAlchemy, PostgreSQL + PostGIS, Alembic

### Database Migrations

**Create a new migration** (after modifying models):
```bash
npm run migrate:new "description of changes"
```

**Apply migrations**:
```bash
npm run migrate
```

**Manual migration commands**:
```bash
cd backend
.venv/bin/alembic revision --autogenerate -m "description"
.venv/bin/alembic upgrade head
.venv/bin/alembic downgrade -1  # Rollback one migration
```

## API Endpoints

- `GET /health` - Health check
- `GET /health/db` - Database health check
- `GET /docs` - Interactive API documentation (Swagger UI)
- `GET /redoc` - Alternative API docs (ReDoc)

More endpoints will be added as development progresses (maps, layers, features, comments).

## Environment Variables

### Frontend (`.env.local`)
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### Backend (`backend/.env`)
```env
DATABASE_URL=postgresql://samsyn:samsyn@host.docker.internal:5432/samsyn
FRONTEND_URL=http://localhost:3000
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
```

See `backend/.env.example` for all available options.

## Documentation

- [Implementation Plan](implementation-plan.md) - Full backend implementation roadmap
- [Database Schema](database-schema.md) - Database design and relationships
- [Backend README](backend/README.md) - Detailed backend setup
- [Phase 1 Complete](PHASE1_COMPLETE.md) - Phase 1 implementation summary

## Troubleshooting

### Backend won't start
- Ensure virtual environment is created: `cd backend && python3 -m venv .venv`
- Ensure dependencies are installed: `cd backend && .venv/bin/pip install -e .`
- Check database is running: `docker ps | grep samsyn-db`

### Database connection fails
- Ensure PostgreSQL is running: `docker-compose up -d db`
- Wait a few seconds for the database to be ready
- Check connection with: `docker-compose exec db psql -U samsyn -d samsyn -c "SELECT 1;"`

### Frontend auth issues
- Ensure `VITE_CLERK_PUBLISHABLE_KEY` is set in `.env.local`
- App gracefully degrades without Clerk configuration

## Development Workflow

Typical development session:

```bash
# Start database (first time or after system restart)
docker-compose up -d db

# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
npm run dev:backend

# When you modify database models:
npm run migrate:new "description of changes"
npm run migrate
```

## Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- Mapbox GL JS + MapboxDraw
- Clerk (authentication)

**Backend:**
- Python 3.11+
- FastAPI
- SQLAlchemy + GeoAlchemy2
- PostgreSQL 16 + PostGIS 3.4
- Alembic (migrations)
- Pydantic (validation)