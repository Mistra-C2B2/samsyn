# CLAUDE.md

## Overview

Marine spatial planning app: React + Vite + Tailwind + shadcn/ui. Interactive maps (MapLibre GL), layer management, temporal viz, commenting.

Figma: https://www.figma.com/design/B7evwPwamo0GPIBMmQFH7z/SamSyn

## Quick Commands

```bash
./run.sh dev          # Frontend (port 3000)
./run.sh dev-backend  # Backend (port 8000)
./run.sh migrate      # Run migrations
npm run check         # Lint/format (from frontend/)
```

## Architecture

- **State**: All in `App.tsx`, flows via props
- **Panels**: One open at a time (LayerManager/MapSelector/Comments/LayerCreator/AdminPanel)
- **UI**: shadcn/ui components, `@` alias → `./frontend/src`
- **Key Files**: `App.tsx` (root + state), `MapView.tsx` (map), `LayerManager.tsx`, `LayerCreator.tsx`

## Testing

Frontend console check:
```bash
python frontend/tests/test_console.py
```

Backend tests:
```bash
cd backend
./setup_test_db.sh        # First-time only
uv run pytest tests/      # Run all tests
```

## Docs

- [README.md](README.md) - Setup, prerequisites, full docs
- [backend/README.md](backend/README.md) - API endpoints
