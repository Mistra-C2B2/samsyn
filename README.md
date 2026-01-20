# SamSyn

Marine Spatial Planning application with React frontend and Python FastAPI backend.

Original Figma design: https://www.figma.com/design/B7evwPwamo0GPIBMmQFH7z/SamSyn

## Project Structure

```
/workspace
├── frontend/               # React frontend
│   ├── src/               # React source code
│   ├── public/            # Static assets
│   ├── README.md          # Frontend documentation
│   └── package.json       # Frontend dependencies
├── backend/                # Python FastAPI backend
│   ├── app/               # Application code
│   ├── alembic/           # Database migrations
│   ├── tests/             # Backend unit tests
│   └── README.md          # Backend documentation
├── tests/                  # Integration & E2E tests
│   └── e2e/               # Playwright tests
├── docker-compose.yml     # Production: PostgreSQL + TiTiler
├── docker-compose.dev.yml # Development: PostgreSQL + TiTiler (port exposed)
└── package.json           # Root project scripts
```

## Quick Start

### 1. Install Dependencies

```bash
# Install all dependencies (both frontend and backend)
npm run install

# OR install individually:
cd frontend && npm install && cd ..
cd backend && uv sync && cd ..
```

> **Note:** Backend uses [uv](https://github.com/astral-sh/uv) for fast, reliable dependency management.

### 2. Start Docker Services

Start PostgreSQL and TiTiler:

```bash
# Development (TiTiler port exposed)
docker-compose -f docker-compose.dev.yml up -d

# Production (TiTiler internal only)
docker-compose up -d
```

This starts:
- **PostgreSQL** on port 5432 (database: `samsyn`, user: `samsyn`, password: `samsyn`)
- **TiTiler** for GeoTIFF tile serving (port 8001 in dev, internal only in production)

### 3. Configure Environment Variables

**Frontend** (`frontend/.env.local`):
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
VITE_API_URL=http://localhost:8000
```

**Backend** (`backend/.env`):
```env
DATABASE_URL=postgresql://samsyn:samsyn@samsyn-db:5432/samsyn
TEST_DATABASE_URL=postgresql://samsyn:samsyn@samsyn-db:5432/samsyn_test
FRONTEND_URL=http://localhost:3000,https://clerk.shared.lcl.dev
CLERK_SECRET_KEY=sk_test_your_key_here
CLERK_WEBHOOK_SECRET=whsec_your_secret_here
CLERK_JWKS_URL=https://your-instance.clerk.accounts.dev/.well-known/jwks.json
TITILER_URL=http://host.docker.internal:8001
```

> **See detailed setup instructions:**
> - [Frontend README](frontend/README.md#authentication-setup-clerk) - Clerk setup for frontend
> - [Backend README](backend/README.md) - Backend configuration

### 4. Run Database Migrations

```bash
npm run migrate
```

### 5. Start Development Servers

**Terminal 1: Frontend**
```bash
npm run dev
```
Frontend at http://localhost:3000

**Terminal 2: Backend**
```bash
npm run dev:backend
```
Backend at http://localhost:8000 (API docs: http://localhost:8000/docs)

## Documentation

### Component Documentation
- **[Frontend README](frontend/README.md)** - Frontend setup, development, and architecture
- **[Backend README](backend/README.md)** - Backend API, testing, and database
- **[CLAUDE.md](CLAUDE.md)** - Project instructions for AI assistants

### Key Topics
- **Authentication**: See [Frontend README](frontend/README.md#authentication-setup-clerk) for Clerk setup
- **Admin Users**: See [Frontend README](frontend/README.md#admin-users) for granting admin access
- **Database Migrations**: See [Database Migrations](#database-migrations) below
- **API Endpoints**: See [Backend README](backend/README.md) for complete API documentation

## Development Commands

### Frontend
```bash
npm run dev         # Start dev server (port 3000)
npm run build       # Production build
npm run lint        # Lint with Biome
npm run format      # Format with Biome
npm run check       # Lint and format (auto-fix)
```

### Backend
```bash
npm run dev:backend # Start backend server (port 8000)
npm run migrate     # Run database migrations
npm run migrate:new # Create new migration: npm run migrate:new "description"
```

### Testing
```bash
npm test              # Run E2E tests (auto-starts dev server)
npm run test:headed   # Run with visible browser
npm run test:ui       # Interactive UI mode
npm run test:report   # View test report
```

## Database Migrations

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
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
uv run alembic downgrade -1  # Rollback one migration
```

## Docker Services

The project uses two Docker Compose configurations:

| File | Purpose | TiTiler Access |
|------|---------|----------------|
| `docker-compose.dev.yml` | Development | Exposed on port 8001 |
| `docker-compose.yml` | Production | Internal only (via backend proxy) |

Both include:
- **PostgreSQL + PostGIS**: Database on port 5432
- **TiTiler**: Dynamic tile server for GeoTIFFs

**Development** mode exposes TiTiler on port 8001 for direct access and testing.

**Production** mode keeps TiTiler internal; all requests go through backend proxy at `/api/v1/titiler/*`.

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui
- MapLibre GL JS + Terra Draw
- Clerk (authentication)

### Backend
- Python 3.11+
- FastAPI
- SQLAlchemy + GeoAlchemy2
- PostgreSQL 16 + PostGIS 3.4
- Alembic (migrations)
- TiTiler (GeoTIFF serving)

## Troubleshooting

### Backend won't start
```bash
# Ensure dependencies are installed
cd backend && uv sync

# Check database is running
docker ps | grep samsyn-db

# Verify environment variables
cat backend/.env
```

### Database connection fails
```bash
# Start database
docker-compose -f docker-compose.dev.yml up -d

# Wait for database to be ready (5-10 seconds)

# Test connection
docker-compose -f docker-compose.dev.yml exec db psql -U samsyn -d samsyn -c "SELECT 1;"
```

### Frontend issues
```bash
# Ensure dependencies are installed
cd frontend && npm install

# Check environment variables
cat frontend/.env.local

# Restart dev server
npm run dev
```

### Authentication issues
See detailed troubleshooting in:
- [Frontend README - Authentication Troubleshooting](frontend/README.md#troubleshooting)
- [Backend README](backend/README.md)

### Port conflicts
```bash
# Frontend (port 3000)
lsof -ti:3000 | xargs kill -9

# Backend (port 8000)
lsof -ti:8000 | xargs kill -9

# PostgreSQL (port 5432)
docker-compose -f docker-compose.dev.yml restart db
```

## Development Workflow

Typical development session:

```bash
# Start Docker services (first time or after system restart)
docker-compose -f docker-compose.dev.yml up -d

# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
npm run dev:backend

# When you modify database models:
npm run migrate:new "description of changes"
npm run migrate
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run linting and tests:
   ```bash
   npm run check           # Frontend linting/formatting
   npm test                # E2E tests
   cd backend && uv run pytest tests/  # Backend tests
   ```
4. Commit your changes
5. Create a pull request

## License

[Your license here]
