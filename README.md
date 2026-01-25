# SAMSYN

Marine spatial planning and stakeholder engagement platform.

## Prerequisites

Before setting up SamSyn, ensure you have the following installed:

**Required:**

- **Node.js** 18 or higher ([download](https://nodejs.org/))
- **Python** 3.11 or higher ([download](https://www.python.org/))
- **Docker Desktop** or Docker Engine ([download](https://www.docker.com/))
- **uv** - Python package manager ([installation](https://github.com/astral-sh/uv))
- **Clerk account** (free) - For authentication ([sign up](https://clerk.com/))

**Optional:**

- **Global Fishing Watch API token** - For GFW data layers ([get token](https://globalfishingwatch.org/our-apis/))

### Verify Installation

```bash
node --version    # Should show 18.x or higher
python --version  # Should show 3.11.x or higher
docker --version  # Any recent version
uv --version      # Should show 0.1.x or higher
```

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
├── docker-compose.yml     # Production: PostgreSQL + TiTiler
├── docker-compose.dev.yml # Development: PostgreSQL + TiTiler (port exposed)
└── package.json           # Root project scripts
```

## Quick Start

### 1. Install Dependencies

```bash
# Install all dependencies (both frontend and backend)
./run.sh install
```

### 2. Start Docker Services

Start PostgreSQL and TiTiler:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

This starts:

- **PostgreSQL** on port 5432 (database: `samsyn`, user: `samsyn`, password: `samsyn`)
- **TiTiler** for GeoTIFF tile serving (port 8001 in dev, internal only in production)

> **Note:** Wait 10-15 seconds for PostgreSQL to fully initialize before running migrations (Step 5).

### 3. Set Up Clerk Authentication

Before configuring environment variables, you need to create a Clerk account and get your API keys.

#### 1. Create Clerk Application

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/) and sign in (or create free account)
2. Click **"+ Create application"**
3. Name: `SamSyn Development` (or your preferred name)
4. Select authentication methods (Email recommended, add others as needed)
5. Click **Create application**

#### 2. Get API Keys

After creating the application:

1. You'll see the API Keys page (or go to **Dashboard → API Keys**)
2. Copy **Publishable Key** (starts with `pk_test_...`)
3. Copy **Secret Key** (click "Show" to reveal, starts with `sk_test_...`)
4. Add these to both `frontend/.env.local` and `backend/.env`

#### 3. Configure Session Token (Important for admin features)

1. In Clerk Dashboard, go to **Sessions**
2. Click **"Customize session token"**
3. Add this JSON:
   ```json
   {
     "public_metadata": "{{user.public_metadata}}"
   }
   ```
4. Click **Save**
5. Users must sign out and back in after this change

#### 4. Set Up Webhook (For user synchronization)

1. In Clerk Dashboard, go to **Webhooks**
2. Click **"+ Add Endpoint"**
3. Endpoint URL: `http://localhost:8000/api/v1/webhooks/clerk` (for local dev)
4. Select events: `user.created`, `user.updated`, `user.deleted`
5. Click **Create**
6. Copy **Signing Secret** (starts with `whsec_...`)
7. Add to `backend/.env` as `CLERK_WEBHOOK_SECRET`

#### 5. Get JWKS URL

1. In Clerk Dashboard, go to **API Keys**
2. Find **Frontend API** value (e.g., `clerk.samsyn.dev`)
3. Construct JWKS URL: `https://<your-frontend-api>/.well-known/jwks.json`
4. Add to `backend/.env` as `CLERK_JWKS_URL`

#### 6. Set Up Admin Users (Optional)

Admin users have access to the Admin Panel for managing global layers and WMS servers.

**To grant admin access:**

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/) → **Users**
2. Select the user you want to make admin
3. Scroll to **Public metadata** section
4. Click **Edit** and add:
   ```json
   {
     "isAdmin": true
   }
   ```
5. Save changes
6. User must sign out and sign back in for changes to take effect

**Admin capabilities:**

- Access Admin Panel (shield icon in navbar)
- Create and manage global layers visible to all users
- Add and manage WMS servers
- Edit and delete any global layer

### 4. Configure Environment Variables

Now that you have your Clerk API keys, configure the environment variables for both frontend and backend.

**Frontend** (`frontend/.env.local`):

```bash
# From project root
cd frontend
cp .env.example .env.local
```

Edit `frontend/.env.local` with these values:

```env
# REQUIRED: Clerk authentication (use keys from Step 3)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here

# REQUIRED: Backend API URL
VITE_API_URL=http://localhost:8000
```

**Backend** (`backend/.env`):

```bash
# From project root
cd backend
cp .env.example .env
```

Edit `backend/.env` with these values:

```env
# Database URLs - Use these defaults for Docker setup
DATABASE_URL=postgresql://samsyn:samsyn@samsyn-db:5432/samsyn
TEST_DATABASE_URL=postgresql://samsyn:samsyn@samsyn-db:5432/samsyn_test

# Clerk Authentication - Use keys from Step 3
CLERK_SECRET_KEY=sk_test_your_secret_key
CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret
CLERK_JWKS_URL=https://your-frontend-api/.well-known/jwks.json

# CORS and service URLs - Use these defaults
FRONTEND_URL=http://localhost:3000,https://clerk.shared.lcl.dev
TITILER_URL=http://host.docker.internal:8001

# OPTIONAL: Global Fishing Watch API token (server-side only)
# Only needed if you want to use GFW data layers
# Get from https://globalfishingwatch.org/our-apis/
GFW_API_TOKEN=your_gfw_token_here
```

> **More details:** See [Frontend README](frontend/README.md#authentication-setup-clerk) and [Backend README](backend/README.md) for additional configuration options.

### 5. Run Database Migrations

```bash
./run.sh migrate
```

### 6. Start Development Servers

**Terminal 1: Frontend**

```bash
./run.sh dev
```

Frontend at http://localhost:3000

**Terminal 2: Backend**

```bash
./run.sh dev-backend
```

Backend at http://localhost:8000 (API docs: http://localhost:8000/docs)

## Documentation

### Component Documentation

- **[Frontend README](frontend/README.md)** - Frontend setup, development, and architecture
- **[Backend README](backend/README.md)** - Backend API, testing, and database
- **[CLAUDE.md](CLAUDE.md)** - Project instructions for AI assistants

### Key Topics

- **Database Migrations**: See [Database Migrations](#database-migrations) below
- **API Endpoints**: See [Backend README](backend/README.md) for complete API documentation

## Development Commands

All development commands use the `./run.sh` script:

```bash
./run.sh install           # Install all dependencies (frontend + backend)
./run.sh dev               # Start frontend dev server (port 3000)
./run.sh dev-backend       # Start backend dev server (port 8000)
./run.sh build             # Build frontend for production
./run.sh lint              # Lint frontend code
./run.sh format            # Format frontend code
./run.sh check             # Lint and format frontend (auto-fix)
./run.sh migrate           # Run database migrations
./run.sh migrate-new "msg" # Create new migration with message
./run.sh help              # Show all available commands
```

## Database Migrations

**Create a new migration** (after modifying models):

```bash
./run.sh migrate-new "description of changes"
```

**Apply migrations**:

```bash
./run.sh migrate
```

**Manual migration commands** (if needed):

```bash
cd backend
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
uv run alembic downgrade -1  # Rollback one migration
```
