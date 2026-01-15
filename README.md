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
├── docker-compose.yml     # Production: PostgreSQL + TiTiler (internal only)
├── docker-compose.dev.yml # Development: PostgreSQL + TiTiler (port exposed)
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

### 2. Start Docker Services

Start PostgreSQL and TiTiler (from host or outside devcontainer):

```bash
# Development (TiTiler port exposed for direct access)
docker-compose -f docker-compose.dev.yml up -d

# Production (TiTiler only accessible via backend proxy)
docker-compose up -d
```

This starts:
- **PostgreSQL** on port 5432 (database: `samsyn`, user: `samsyn`, password: `samsyn`)
- **TiTiler** for GeoTIFF tile serving (port 8001 in dev, internal only in production)

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

**Terminal 1: Docker services (if not already running)**
```bash
docker-compose -f docker-compose.dev.yml up -d
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
DATABASE_URL=postgresql://samsyn:samsyn@samsyn-db:5432/samsyn
FRONTEND_URL=http://localhost:3000
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
TITILER_URL=http://localhost:8001
```

See `backend/.env.example` for all available options.

## Docker Services

The project uses two Docker Compose configurations:

| File | Purpose | TiTiler Access |
|------|---------|----------------|
| `docker-compose.dev.yml` | Development | Exposed on port 8001 |
| `docker-compose.yml` | Production | Internal only (via backend proxy) |

Both files include:
- **PostgreSQL + PostGIS**: Database on port 5432
- **TiTiler**: Dynamic tile server for Cloud-Optimized GeoTIFFs (COGs)

### Development vs Production

**Development** (`docker-compose.dev.yml`):
- TiTiler port 8001 is exposed for direct browser access
- CORS is enabled for testing
- Use when running backend locally outside Docker

**Production** (`docker-compose.yml`):
- TiTiler is only accessible within the Docker network
- All GeoTIFF tile requests go through the backend proxy (`/api/v1/titiler/*`)
- Authentication is required (non-dev mode)

## Admin Users

Admin users have access to the Admin Panel, which allows managing global layers and WMS servers that are available to all users.

### Setting Up an Admin User

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Navigate to **Users** and select the user you want to make an admin
3. Scroll to the **Public metadata** section
4. Click **Edit** and add the following JSON:
   ```json
   {
     "isAdmin": true
   }
   ```
5. Save the changes

The user will need to sign out and sign back in (or refresh the page) for the changes to take effect.

### Configuring JWT Template (Required for Backend)

The backend verifies admin status from the JWT token. By default, Clerk doesn't include `publicMetadata` in JWTs, so you need to configure it:

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/) → **JWT Templates**
2. Click **New template** → **Blank**
3. Name it (e.g., "samsyn")
4. In the Claims section, add:
   ```json
   {
     "public_metadata": "{{user.public_metadata}}"
   }
   ```
5. Save the template

After configuring the template, users need to sign out and sign back in to get a new token with the admin claim included.

### What Admins Can Do

- Access the Admin Panel (shield icon in navbar)
- Create and manage global layers visible to all users
- Add and manage WMS servers
- Edit and delete any global layer or WMS server

### Security

Admin privileges are enforced on both frontend and backend:
- **Frontend**: The Admin button is hidden for non-admin users
- **Backend**: API endpoints return 403 Forbidden if a non-admin tries to access admin-only operations

The admin status is stored in Clerk's `publicMetadata`, which is signed and cannot be forged by clients.

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
- Ensure PostgreSQL is running: `docker-compose -f docker-compose.dev.yml up -d`
- Wait a few seconds for the database to be ready
- Check connection with: `docker-compose -f docker-compose.dev.yml exec db psql -U samsyn -d samsyn -c "SELECT 1;"`

### Frontend auth issues
- Ensure `VITE_CLERK_PUBLISHABLE_KEY` is set in `.env.local`
- App gracefully degrades without Clerk configuration

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
- TiTiler (GeoTIFF/COG tile serving)