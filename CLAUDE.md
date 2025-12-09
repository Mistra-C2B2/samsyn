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

- **State**: All in `src/App.tsx` via useState hooks, flows down through props
- **Panels**: Only one side panel open at a time (LayerManager, MapSelector, Comments, LayerCreator, AdminPanel)
- **Map**: MapLibre GL in `MapView.tsx` with drawing tools
- **UI**: shadcn/ui components in `src/components/ui/`, path alias `@` → `./src`

## Key Files

| File                              | Purpose                                         |
| --------------------------------- | ----------------------------------------------- |
| `src/App.tsx`                     | Root component, all state, Layer/UserMap types  |
| `src/components/MapView.tsx`      | Map rendering, drawing tools                    |
| `src/components/LayerManager.tsx` | Layer list, visibility, opacity, reordering     |
| `src/components/LayerCreator.tsx` | Create/edit layers (draw, upload, WMS, GeoJSON) |

## Testing

After EVERY frontend change, run the console error test:

```bash
npm run dev                    # Start dev server first
python tests/test_console.py   # Check for console errors/warnings
```

**Always run this test after making frontend changes.**

## Backend

See [backend/README.md](backend/README.md) for API endpoints documentation.

## Notes

- Clerk auth: Set `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local` to enable
- Check if dev server is already running before starting
