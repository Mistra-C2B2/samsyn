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

# Install backend dependencies (requires uv)
cd backend
uv sync
cd ..
```

> **Note:** Backend uses [uv](https://github.com/astral-sh/uv) for fast, reliable dependency management. See [backend/README.md](backend/README.md) for detailed setup instructions.

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
uv run alembic upgrade head
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
Frontend will be available at http://localhost:3000

**Terminal 3: Backend**
```bash
npm run dev:backend
```
Backend API will be available at http://localhost:8000

## Development

### Frontend (React + Vite)

- **Dev server**: `npm run dev` (http://localhost:3000)
- **Build**: `npm run build`
- **Tech**: React 18, TypeScript, Tailwind CSS, shadcn/ui, Mapbox GL JS
- **Auth**: Clerk (configure with `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local`)

### Backend (Python + FastAPI)

- **Dev server**: `npm run dev:backend` (http://localhost:8000)
- **API docs**: http://localhost:8000/docs
- **Tech**: FastAPI, SQLAlchemy, PostgreSQL + PostGIS, Alembic, uv
- **Testing**: `cd backend && uv run pytest tests/`
- **Detailed docs**: [backend/README.md](backend/README.md)

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
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
uv run alembic downgrade -1  # Rollback one migration
```

> For more backend details including testing, see [backend/README.md](backend/README.md)

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
VITE_API_URL=http://localhost:8000
VITE_GFW_API_TOKEN=your_gfw_token_here  # Optional
```

### Backend (`backend/.env`)
```env
DATABASE_URL=postgresql://samsyn:samsyn@samsyn-db:5432/samsyn
TEST_DATABASE_URL=postgresql://samsyn:samsyn@samsyn-db:5432/samsyn_test
FRONTEND_URL=http://localhost:3000,https://clerk.shared.lcl.dev
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
CLERK_JWKS_URL=https://your-instance.clerk.accounts.dev/.well-known/jwks.json
TITILER_URL=http://host.docker.internal:8001
```

**Note:** For detailed instructions on setting up Clerk authentication and getting these values, see the [Authentication Setup](#authentication-setup-clerk) section.

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

## Authentication Setup (Clerk)

SamSyn uses [Clerk](https://clerk.com) for user authentication and management. Follow these steps to set up Clerk for your development environment.

### 1. Create a Clerk Account and Application

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/) and sign up (or sign in)
2. Click **"+ Create application"** (or select an existing one)
3. Name your application (e.g., "SamSyn Development")
4. Choose authentication methods:
   - ✅ **Email** (recommended for development)
   - ✅ **Google** (optional)
   - ✅ **Username** (optional, for testing)
5. Click **Create application**

### 2. Get Your API Keys

After creating the application, you'll see the API keys page:

1. **Publishable Key** (starts with `pk_test_...`)
   - This is used in the frontend
   - It's safe to use in client-side code
   - Copy this value

2. **Secret Key** (starts with `sk_test_...`)
   - This is used in the backend
   - ⚠️ **NEVER expose this in frontend code or commit to git**
   - Copy this value

You can always find these keys at: **Dashboard → API Keys**

### 3. Get Your Clerk JWKS URL

The JWKS (JSON Web Key Set) URL is used by the backend to verify JWT tokens.

**The URL format is:**
```
https://YOUR-INSTANCE.clerk.accounts.dev/.well-known/jwks.json
```

**To find YOUR-INSTANCE, use one of these methods:**

**Option A: From API Keys Page** (Easiest)
- Go to **API Keys** in Clerk Dashboard
- Look for the "Frontend API" URL
- It will show: `https://your-instance.clerk.accounts.dev`
- Your JWKS URL is: `https://your-instance.clerk.accounts.dev/.well-known/jwks.json`

**Option B: From Dashboard URL**
- Look at your Clerk dashboard URL in the browser
- It will show your instance name
- The format is: `{name}-{number}.clerk.accounts.dev`
- Example: `champion-doe-0.clerk.accounts.dev`
- Your JWKS URL is: `https://champion-doe-0.clerk.accounts.dev/.well-known/jwks.json`

**Option C: From Publishable Key** (Advanced)
- Your publishable key (`pk_test_...`) is base64-encoded
- The decoded value contains your instance domain
- Example: `pk_test_...` decodes to `your-app-12.clerk.accounts.dev`
- Your JWKS URL is: `https://your-app-12.clerk.accounts.dev/.well-known/jwks.json`

### 4. Set Up Webhooks

Webhooks sync user data from Clerk to your backend database.

1. In Clerk Dashboard, go to **Webhooks**
2. Click **"+ Add Endpoint"**
3. Enter your webhook URL:
   - **Development**: `http://localhost:8000/api/v1/webhooks/clerk`
   - **Production**: `https://your-domain.com/api/v1/webhooks/clerk`
4. Select events to listen for:
   - ✅ `user.created`
   - ✅ `user.updated`
   - ✅ `user.deleted`
5. Click **Create**
6. Copy the **Signing Secret** (starts with `whsec_...`)

### 5. Customize Session Token (Required)

The backend needs access to user metadata in JWT tokens. By default, Clerk doesn't include this, so you must configure it:

1. Go to **Sessions** in Clerk Dashboard (left sidebar)
2. Click **"Customize session token"**
3. In the editor, add:
   ```json
   {
     "public_metadata": "{{user.public_metadata}}"
   }
   ```
4. Click **Save**

**Important:** After customizing the session token, users must sign out and back in to get tokens with the new claims.

### 6. Configure Environment Variables

Now add your Clerk credentials to the environment files:

#### Frontend: `.env.local`

Create this file in the project root:

```bash
# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE

# Backend API URL
VITE_API_URL=http://localhost:8000

# (Optional) Global Fishing Watch API Token
VITE_GFW_API_TOKEN=your_gfw_token_here
```

#### Backend: `backend/.env`

Edit this file (or create from `backend/.env.example`):

```bash
# Database
DATABASE_URL=postgresql://samsyn:samsyn@samsyn-db:5432/samsyn
TEST_DATABASE_URL=postgresql://samsyn:samsyn@samsyn-db:5432/samsyn_test

# Frontend URL (for CORS)
# Frontend runs on port 3000 (configured in vite.config.ts)
# clerk.shared.lcl.dev is used by Clerk for embedded auth components (optional)
FRONTEND_URL=http://localhost:3000,https://clerk.shared.lcl.dev

# Clerk Authentication
CLERK_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
CLERK_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
CLERK_JWKS_URL=https://your-instance.clerk.accounts.dev/.well-known/jwks.json

# TiTiler
TITILER_URL=http://host.docker.internal:8001
```

**Replace these values:**
- `pk_test_YOUR_PUBLISHABLE_KEY_HERE` → Your publishable key from step 2
- `sk_test_YOUR_SECRET_KEY_HERE` → Your secret key from step 2
- `whsec_YOUR_WEBHOOK_SECRET_HERE` → Your webhook secret from step 4
- `https://your-instance.clerk.accounts.dev/.well-known/jwks.json` → Your JWKS URL from step 3

#### Testing: `.env.test` (Optional)

If you plan to run E2E tests, create `.env.test` in the project root:

```bash
# Clerk Testing Configuration
CLERK_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
CLERK_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE

# Test user credentials (create a test user in Clerk Dashboard)
TEST_USER_EMAIL=testuser@example.com
TEST_USER_PASSWORD=your_test_password_here
```

### 7. Verify Setup

1. **Restart both servers:**
   ```bash
   # Backend (Ctrl+C in backend terminal, then):
   npm run dev:backend

   # Frontend (Ctrl+C in frontend terminal, then):
   npm run dev
   ```

2. **Test authentication:**
   - Open http://localhost:3000
   - Click **Sign In** (top-right)
   - Create a new account or sign in
   - You should be signed in successfully

3. **Verify webhook is working:**
   - Check backend terminal logs
   - You should see: `"User created via webhook"` or similar
   - Check database:
     ```bash
     docker-compose -f docker-compose.dev.yml exec db psql -U samsyn -d samsyn -c "SELECT id, email, clerk_id FROM users;"
     ```
   - Your user should appear in the database

### Troubleshooting Authentication

**Error: "Unable to find matching key in JWKS"**
- ✅ Make sure `CLERK_JWKS_URL` in `backend/.env` points to the correct Clerk instance
- ✅ Verify the URL format: `https://YOUR-INSTANCE.clerk.accounts.dev/.well-known/jwks.json`
- ✅ Restart the backend server after changing `.env` files
- ✅ Check that you're using the correct publishable key in `.env.local`

**Error: "Invalid token" or "Token expired"**
- ✅ Sign out and sign back in to get a fresh token
- ✅ Check that session token is customized with `public_metadata` claim (Sessions → Customize session token)
- ✅ Verify `CLERK_SECRET_KEY` in `backend/.env` matches your Clerk dashboard

**Users not appearing in database**
- ✅ Check backend logs for webhook errors
- ✅ Verify `CLERK_WEBHOOK_SECRET` is correct
- ✅ Ensure webhook endpoint is configured in Clerk dashboard
- ✅ For local development, webhooks may not work (Clerk can't reach localhost)
  - Users will be created automatically on first API request instead

**Frontend shows "Clerk is not configured"**
- ✅ Make sure `.env.local` exists in project root (not in `backend/`)
- ✅ Verify `VITE_CLERK_PUBLISHABLE_KEY` is set correctly
- ✅ Restart the frontend dev server: `npm run dev`

### Security Notes

⚠️ **Never commit these files to git:**
- `.env.local`
- `.env.test`
- `backend/.env`

✅ **Safe to commit:**
- `.env.example` files (with placeholder values)

The `.gitignore` file is already configured to exclude all `.env` files.

---

## Admin Users

Admin users have access to the Admin Panel, which allows managing global layers and WMS servers that are available to all users.

**Prerequisites:** Complete the [Authentication Setup](#authentication-setup-clerk) section above before configuring admin users.

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

### Session Token Verification

The backend verifies admin status from the JWT token using the `public_metadata` claim.

If you followed the [Authentication Setup](#authentication-setup-clerk) section, you should have already customized the session token in step 5. If not, go back and complete that step.

**To verify:**
1. Go to [Clerk Dashboard](https://dashboard.clerk.com/) → **Sessions**
2. Click **"Customize session token"**
3. Check that the `public_metadata` claim is configured
4. If not present, add it as described in the Authentication Setup section

**Important:** After customizing the session token or adding admin metadata, users must sign out and sign back in to get a new token with the updated claims.

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
- Ensure dependencies are installed: `cd backend && uv sync`
- Check database is running: `docker ps | grep samsyn-db`
- Verify environment variables: Check `backend/.env` exists and has correct values

### Database connection fails
- Ensure PostgreSQL is running: `docker-compose -f docker-compose.dev.yml up -d`
- Wait a few seconds for the database to be ready
- Check connection with: `docker-compose -f docker-compose.dev.yml exec db psql -U samsyn -d samsyn -c "SELECT 1;"`

### Frontend auth issues
- See the [Troubleshooting Authentication](#troubleshooting-authentication) section for detailed debugging steps
- Ensure `VITE_CLERK_PUBLISHABLE_KEY` is set in `.env.local`
- Ensure `CLERK_JWKS_URL` is set in `backend/.env`
- Restart both frontend and backend servers after changing `.env` files

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