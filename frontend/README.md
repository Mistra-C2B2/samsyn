# SamSyn Frontend

## Tech Stack

- **React 18** with TypeScript
- **Vite** - Build tool and dev server
- **Tailwind CSS** + **shadcn/ui** - Styling and component library
- **MapLibre GL JS** - Interactive maps
- **Terra Draw** - Drawing and editing tools
- **Clerk** - Authentication and user management

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Clerk Authentication (get from https://dashboard.clerk.com)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Backend API URL (usually http://localhost:8000 for development)
VITE_API_URL=http://localhost:8000

# Global Fishing Watch API Token (optional)
VITE_GFW_API_TOKEN=your_gfw_token_here
```

> **Note:** See the main [README.md](../README.md#3-set-up-clerk-authentication) for detailed instructions on getting Clerk API keys.

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at http://localhost:3000

## Development Commands

```bash
npm run dev         # Start dev server (port 3000)
npm run build       # Production build
npm run lint        # Lint with Biome
npm run format      # Format with Biome
npm run check       # Lint and format with Biome (auto-fix)
```

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx                 # Root component, all application state
│   ├── main.tsx               # Entry point
│   ├── components/            # React components
│   │   ├── MapView.tsx        # Map rendering with MapLibre GL
│   │   ├── LayerManager.tsx   # Layer list, visibility, opacity
│   │   ├── LayerCreator.tsx   # Create/edit layers
│   │   ├── AdminPanel.tsx     # Admin-only features
│   │   ├── ui/                # shadcn/ui components
│   │   └── ...
│   ├── contexts/              # React contexts
│   │   ├── SessionContext.tsx # User session management
│   │   ├── SettingsContext.tsx# App settings
│   │   └── DrawingContext.tsx # Drawing state
│   ├── services/              # API clients
│   │   ├── api.ts             # Base API client with auth
│   │   ├── layerService.ts    # Layer CRUD operations
│   │   ├── mapService.ts      # Map management
│   │   └── ...
│   ├── hooks/                 # Custom React hooks
│   ├── types/                 # TypeScript type definitions
│   ├── utils/                 # Utility functions
│   └── styles/                # Global styles
├── public/                    # Static assets
├── index.html                 # HTML entry point
├── vite.config.ts             # Vite configuration
├── tsconfig.json              # TypeScript configuration
├── biome.json                 # Linting/formatting config
└── package.json               # Dependencies and scripts
```

## Architecture

- **State Management**: All state in `App.tsx` via `useState` hooks, flows down through props
- **Panel System**: Only one side panel open at a time (LayerManager, MapSelector, Comments, LayerCreator, AdminPanel)
- **Map Rendering**: MapLibre GL JS in `MapView.tsx` with Terra Draw for editing
- **Component Library**: shadcn/ui components in `src/components/ui/`
- **Path Alias**: `@/` → `./src/` (configured in `vite.config.ts` and `tsconfig.json`)

## Environment Variables

The frontend uses Vite's environment variable system. All variables must be prefixed with `VITE_` to be exposed to the client-side code.

### Required Variables

```env
# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Backend API URL
VITE_API_URL=http://localhost:8000

# Global Fishing Watch API Token (optional)
VITE_GFW_API_TOKEN=your_token_here
```

Environment files should be placed in the `frontend/` directory:

- `.env.local` - Your local development environment (gitignored)
- `.env.example` - Template with placeholder values (committed)

> **Authentication Setup:** See the main [README.md](../README.md#3-set-up-clerk-authentication) for complete Clerk authentication and admin user setup instructions.

## API Integration

The frontend communicates with the backend API at `http://localhost:8000` (configurable via `VITE_API_URL`).

### API Client

Base API client with authentication is in `src/services/api.ts`:

```typescript
import { api } from "@/services/api";

// Authenticated requests automatically include Clerk token
const response = await api.get("/api/v1/layers");
```

### Service Modules

- **`layerService.ts`** - Layer CRUD operations
- **`mapService.ts`** - Map management
- **`commentService.ts`** - Comment system
- **`wmsServerService.ts`** - WMS server management

## Testing

### E2E Tests (Playwright)

E2E tests are located in `tests/e2e/` and test the frontend UI (with backend running).

```bash
npm test              # Run all e2e tests (auto-starts dev server)
npm run test:headed   # Run with visible browser
npm run test:ui       # Interactive UI mode
npm run test:report   # View HTML report
```

Tests use page objects in `tests/e2e/pages/`.

### Console Error Check

After frontend changes, verify there are no console errors:

```bash
npm run dev                    # Start dev server first
python tests/test_console.py   # Check for console errors/warnings
```

## Build for Production

```bash
npm run build
```

Build output goes to `frontend/build/` directory.

The production build:

- Minifies JavaScript and CSS
- Optimizes assets
- Creates source maps
- Tree-shakes unused code

## Troubleshooting

### Port 3000 already in use

```bash
# Find process using port 3000
lsof -ti:3000

# Kill it
kill -9 $(lsof -ti:3000)

# Or use a different port
PORT=3001 npm run dev
```

### TypeScript errors

```bash
# Check TypeScript configuration
npx tsc --noEmit
```

### Build fails

```bash
# Clean cache and rebuild
rm -rf node_modules .vite build
npm install
npm run build
```

### Authentication issues

See the main project [README.md](../README.md#troubleshooting) for authentication troubleshooting.

## Development Tips

### State Management

All application state is in `App.tsx`. State flows down through props:

- Keep state as close to where it's used as possible
- Use React Context for deeply nested shared state (e.g., `SessionContext`)
- Avoid prop drilling by using composition

### Adding New Components

1. Use TypeScript for type safety
2. Follow existing component patterns
3. Use shadcn/ui components where possible
4. Add to appropriate directory under `src/components/`

### Working with Maps

- MapLibre GL instance is created in `MapView.tsx`
- Terra Draw handles drawing and editing
- Layers are managed through `LayerManager.tsx`
- See `src/utils/` for map-related utilities

### Code Style

The project uses Biome for linting and formatting:

```bash
npm run check    # Auto-fix lint and format issues
npm run lint     # Check linting only
npm run format   # Format only
```

Configuration is in `biome.json`.

## Related Documentation

- [Main Project README](../README.md) - Full project setup and overview
- [Backend README](../backend/README.md) - Backend API documentation
- [CLAUDE.md](../CLAUDE.md) - Project instructions for AI assistants
