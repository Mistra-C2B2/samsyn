# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SamSyn is a React-based marine spatial planning application for creating and managing interactive maps with multiple data layers. The app supports temporal data visualization, collaborative commenting, and user authentication via Clerk. It's designed for marine biologists, fisheries managers, and policy advisors to visualize and analyze spatial data (fish stocks, fishing intensity, aquaculture sites, etc.).

Original Figma design: https://www.figma.com/design/B7evwPwamo0GPIBMmQFH7z/SamSyn

## Development Commands

### Setup
```bash
npm i                    # Install dependencies
```

### Development
```bash
npm run dev             # Start dev server on port 3000 (auto-opens browser)
```

### Build
```bash
npm run build           # Production build to ./build directory
```

## Authentication Setup

The app uses Clerk for authentication. To enable:
1. Create a `.env.local` file (already in `.gitignore`)
2. Add: `VITE_CLERK_PUBLISHABLE_KEY=pk_test_...` or `pk_live_...`
3. The app detects configuration and conditionally enables auth features

When Clerk is not configured, the app gracefully degrades to show a non-functional Sign In button with a toast notification.

## Architecture

### Core Data Model

The application is built around two primary TypeScript interfaces defined in `src/App.tsx`:

**Layer**: Represents a map layer with properties for:
- Type: `geojson`, `heatmap`, `markers`, `raster`, `vector`
- Visibility and opacity controls
- Temporal data support with time ranges and snapshots
- Permission settings (`createdBy`, `editable`)
- Metadata (description, author, DOI, category)
- Legend definitions (gradient or categories)
- External data sources (WMS, GeoTIFF URLs)

**UserMap**: Represents a complete map configuration with:
- Layers collection
- Map center/zoom state
- Permission system (private/collaborators/public)
- Creator and collaborator lists

### State Management

All state is managed via React useState hooks in `src/App.tsx` (AppContent component):
- `currentMap`: Active map and its layers
- `maps`: Array of all user maps
- `availableLayers`: Global layer library for reuse across maps
- `comments`: Comment system linked to maps/layers
- `currentTimeRange`: Controls temporal data playback
- Panel visibility states for LayerManager, CommentSection, etc.

State flows down through props; updates flow up through callback functions.

### Key Components

**App.tsx** (860 lines)
- Root component with all application state
- Conditionally wraps with ClerkProvider when auth is configured
- Header with navigation buttons and auth UI
- Main map view with side panels
- Temporal slider for time-based data

**MapView.tsx**
- Integrates Mapbox GL JS and MapboxDraw
- Manages map instance and drawing tools via refs
- Exposes imperative API: `startDrawing()`, `cancelDrawing()`
- Handles layer rendering and basemap switching
- Note: Currently uses placeholder Mapbox token

**LayerManager.tsx**
- Drag-and-drop layer reordering
- Visibility/opacity controls per layer
- Layer library with search, sort, and filter
- Opens LayerCreator for adding/editing layers
- Shows comment counts per layer

**LayerCreator.tsx**
- Multi-tab interface: draw features, upload files, WMS/GeoTIFF URLs, or paste GeoJSON
- Interactive drawing for Points, LineStrings, Polygons
- Feature styling (icons for points, line styles)
- Permission controls (creator-only vs everyone editable)

**TimeSlider.tsx**
- Displays when temporal layers are visible
- Controls `currentTimeRange` to filter layer data
- Layers automatically update based on closest temporal snapshot

**CommentSection.tsx**
- Threaded comments on maps or individual layers
- Filter by target (map vs specific layer)

**AdminPanel.tsx**
- Global layer library management
- Add/remove/update layers available to all maps

### Panel State Management

Only one side panel shows at a time. Each panel button in the header:
1. Toggles its own panel state
2. Hides all other panels when opening

The panel states are: `showLayerManager`, `showMapSelector`, `showComments`, `showLayerCreator`, `showAdminPanel`

### Temporal Data Flow

1. `globalTimeRange` (useMemo): Calculates min/max dates from all visible temporal layers
2. `currentTimeRange` (state): User-controlled time window via TimeSlider
3. `layersWithTemporalData` (useMemo): For each temporal layer, finds closest snapshot to current time and replaces `layer.data`
4. MapView receives pre-filtered layers and renders

### Drawing Flow

1. User initiates drawing in LayerCreator
2. LayerCreator calls `onStartDrawing(type, callback)`
3. App.tsx stores `drawingMode` and `drawCallback` in state
4. App.tsx calls `mapViewRef.current?.startDrawing(type)`
5. MapView activates MapboxDraw
6. On completion, MapView calls `onDrawComplete(feature)`
7. App.tsx executes stored `drawCallback(feature)`
8. LayerCreator receives feature and adds to layer

## UI Components

Uses shadcn/ui components (Radix UI primitives + Tailwind CSS):
- Located in `src/components/ui/`
- Import aliases configured in `vite.config.ts` (handles versioned package names)
- Uses `sonner` for toast notifications
- Lucide React for icons

## Styling

- Tailwind CSS via `src/styles/globals.css` and `src/index.css`
- Brand color: teal-500 (`#14b8a6`)
- UI tokens: slate palette for neutrals

## Key Patterns

**Map Updates**: All mutations go through callback functions that update state in App.tsx
- `updateLayer(layerId, updates)`: Partial updates to a layer
- `addLayerToMap(layer)`: Adds to current map and availableLayers if new
- `reorderLayers(startIndex, endIndex)`: Drag-and-drop reordering

**Layer Permissions**:
- `createdBy` stores user ID
- `editable` can be "creator-only" or "everyone"
- LayerCreator enforces these when editing

**Mock Data**:
- Sample layers and maps defined in `src/App.tsx` (lines 77-325)
- Demonstrates heatmap, GeoJSON polygons, and temporal data structures

## External Dependencies

- **Mapbox GL JS**: Map rendering (loaded via CDN in index.html, implied)
- **MapboxDraw**: Drawing tools (loaded via CDN, implied)
- **Clerk**: Authentication (@clerk/clerk-react)
- **Radix UI**: Headless UI primitives
- **Tailwind CSS**: Styling
- **Vite**: Build tool with React SWC plugin

## File Organization

```
src/
  App.tsx              - Main app component with all state
  main.tsx             - React root initialization
  index.css            - Global styles
  components/
    MapView.tsx        - Mapbox integration
    LayerManager.tsx   - Layer controls
    LayerCreator.tsx   - Layer creation/editing
    CommentSection.tsx - Commenting system
    TimeSlider.tsx     - Temporal controls
    MapSelector.tsx    - Map switching
    AdminPanel.tsx     - Layer library management
    SettingsDialog.tsx - App settings
    Legend.tsx         - Map legend display
    ui/                - shadcn/ui components
```

## Development Notes

- Path alias `@` maps to `./src` (vite.config.ts:49)
- Build target: ESNext (vite.config.ts:53)
- Dev server auto-opens on port 3000
- TypeScript types defined inline in App.tsx for Layer and UserMap
- No backend currently - all data is mock/in-memory
