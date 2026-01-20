# CLAUDE.md

## Project Overview

SamSyn is a React-based marine spatial planning application with interactive maps, layer management, temporal data visualization, and commenting. Built with Vite, Tailwind CSS, and shadcn/ui components.

Figma design: https://www.figma.com/design/B7evwPwamo0GPIBMmQFH7z/SamSyn

## Commands

```bash
npm i               # Install dependencies
npm run dev         # Start dev server (port 3000)
npm run build       # Production build
npm run lint        # Lint with Biome
npm run format      # Format with Biome
npm run check       # Lint and format with Biome (auto-fix)
```

## Architecture

- **State**: All in `frontend/src/App.tsx` via useState hooks, flows down through props
- **Panels**: Only one side panel open at a time (LayerManager, MapSelector, Comments, LayerCreator, AdminPanel)
- **Map**: MapLibre GL in `MapView.tsx` with drawing tools
- **UI**: shadcn/ui components in `frontend/src/components/ui/`, path alias `@` → `./frontend/src`

## Key Files

| File                                      | Purpose                                         |
| ----------------------------------------- | ----------------------------------------------- |
| `frontend/src/App.tsx`                    | Root component, all state, Layer/UserMap types  |
| `frontend/src/components/MapView.tsx`     | Map rendering, drawing tools                    |
| `frontend/src/components/LayerManager.tsx`| Layer list, visibility, opacity, reordering     |
| `frontend/src/components/LayerCreator.tsx`| Create/edit layers (draw, upload, WMS, GeoJSON) |

## Testing

### E2E Tests (Playwright)

```bash
npm test              # Run all e2e tests (auto-starts dev server)
npm run test:headed   # Run with visible browser
npm run test:ui       # Interactive UI mode
npm run test:report   # View HTML report
```

Tests are in `tests/e2e/`. Page objects are in `tests/e2e/pages/`. Write new tests as `*.spec.ts` files.

### Console Error Check

After frontend changes, run:

```bash
npm run dev                    # Start dev server first
python tests/test_console.py   # Check for console errors/warnings
```

## Backend

See [backend/README.md](backend/README.md) for API endpoints documentation.

## Notes

- Clerk auth: Set `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local` to enable
- Check if dev server is already running before starting
