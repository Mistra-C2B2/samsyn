# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A geospatial visualization application built with React, TypeScript, deck.gl, and react-map-gl for rendering interactive maps and spatial data visualizations. The application features user authentication, collaborative commenting, layer management, and support for multiple map types including GeoJSON, heatmaps, raster, and vector layers.

## Tech Stack

- **Frontend Framework**: React 18.3+ with TypeScript 5.9+
- **Build Tool**: Vite 5.4+ with React SWC plugin
- **Styling**: Tailwind CSS 4.1+ with custom configuration
- **Authentication**: Clerk (@clerk/clerk-react 5.56+) for SSO and user management
- **UI Components**: Radix UI primitives with custom shadcn/ui components
- **Mapping Libraries**:
  - react-map-gl 8.1+ (React wrapper for Mapbox GL)
  - deck.gl 9.2+ (WebGL-powered visualization layers)
  - mapbox-gl 3.16+ (base mapping library)
  - maplibre-gl 5.13+ (open-source alternative to Mapbox GL)
- **Additional Libraries**:
  - lucide-react (icons)
  - react-hook-form (form management)
  - date-fns (date utilities)
  - recharts (data visualization)
  - sonner (toast notifications)
  - class-variance-authority, clsx, tailwind-merge (styling utilities)

## Development Commands

**Start development server:**

```bash
npm run dev
```

Server runs on port 5173, configured to listen on all network interfaces (0.0.0.0).

**Build for production:**

```bash
npm run build
```

**Preview production build:**

```bash
npm run preview
```

## Architecture

### Entry Point

- `src/main.tsx` - React application entry point with StrictMode wrapper and Clerk authentication provider
- `index.html` - HTML template with root div mount point

### Component Structure

#### Main Application

- `src/App.tsx` - Main application component with state management for maps, layers, comments, and UI panels
  - Manages multiple user maps with layers
  - Coordinates between MapView, LayerManager, MapSelector, and CommentSection
  - Handles authentication UI with Clerk (SignIn, SignUp, UserButton)

#### Core Components

- `src/components/MapView.tsx` - Map rendering component using react-map-gl/maplibre
  - Supports multiple layer types (GeoJSON, heatmap, markers, raster, vector)
  - Drawing capabilities for creating custom geometries
  - Exposes MapViewRef for external control

- `src/components/LayerManager.tsx` - Layer visibility, opacity, and order management
  - Drag-and-drop reordering
  - Layer visibility toggles
  - Opacity controls
  - Access to layer comments

- `src/components/MapSelector.tsx` - Map switching and creation interface
  - Browse available maps
  - Create new maps
  - Switch between different map views

- `src/components/CommentSection.tsx` - Collaborative commenting system
  - Map-level and layer-level comments
  - Author attribution and timestamps
  - Filter by map or layer

- `src/components/LayerCreator.tsx` - Create new layers with various types
  - Upload GeoJSON
  - Configure WMS/raster layers
  - Draw custom geometries
  - Set layer metadata (name, description, DOI, category)

- `src/components/AdminPanel.tsx` - Administrative layer management
  - Add/remove layers from available layer library
  - Manage global layer catalog

- `src/components/Legend.tsx` - Layer legend display
  - Gradient legends for heatmaps
  - Category legends for classified data

- `src/components/MapCreationWizard.tsx` - Guided map creation workflow
- `src/components/CategorySelector.tsx` - Category filtering for layers

#### UI Component Library

- `src/components/ui/` - Comprehensive shadcn/ui component library built on Radix UI
  - Common components: Button, Input, Select, Dialog, Dropdown, Tabs, etc.
  - Form components: Label, Checkbox, Radio, Switch, Slider, etc.
  - Layout components: Card, Separator, ScrollArea, Resizable, etc.
  - Feedback components: Alert, Toast (Sonner), Progress, Skeleton, etc.
  - `src/components/ui/utils.ts` - Utility functions for className merging

### Styling

- `src/index.css` - Global styles and Tailwind CSS imports
- `src/styles/globals.css` - Additional global style definitions
- Tailwind CSS configuration embedded in the application
- CSS-in-JS pattern for component-specific styles

### Data Models

#### Layer Interface
```typescript
interface Layer {
  id: string;
  name: string;
  type: 'geojson' | 'heatmap' | 'markers' | 'raster' | 'vector';
  visible: boolean;
  opacity: number;
  data?: any;
  color?: string;
  description?: string;
  author?: string;
  doi?: string;  // Digital Object Identifier for citing data
  category?: string;
  // WMS properties
  wmsUrl?: string;
  wmsLayerName?: string;
  // GeoTIFF properties
  geotiffUrl?: string;
  // Vector properties
  features?: any[];
  legend?: {
    type: 'gradient' | 'categories';
    items: Array<{ color: string; label: string; value?: number }>;
  };
}
```

#### UserMap Interface
```typescript
interface UserMap {
  id: string;
  name: string;
  description: string;
  layers: Layer[];
  center: [number, number];  // [latitude, longitude]
  zoom: number;
}
```

### Map Implementation

The application uses MapLibre GL (via react-map-gl/maplibre) with a demo tile service. Maps support:
- Default view centered on the Baltic Sea region (longitude: 18.0686, latitude: 59.3293)
- Default zoom level of 7
- Interactive controls with programmatic updates
- Multiple layer types rendered simultaneously
- Drawing mode for creating custom geometries (Point, LineString, Polygon)
- Layer reordering and opacity control

### Development Environment

The project uses a devcontainer configuration with:

- Network capabilities (NET_ADMIN, NET_RAW) for advanced networking features
- GPU support enabled
- Forwarded ports: 5173 (Vite dev server), 3000 (additional services)
- Prettier and ESLint configured with format-on-save
- Node.js environment with 4GB max old space size

## Key Considerations

**TypeScript**: The application is written in TypeScript with strict type checking enabled. Key interfaces (Layer, UserMap) are defined in `src/App.tsx`. When creating new components or modifying existing ones, maintain type safety and export reusable types.

**Authentication with Clerk**:
- User authentication is handled by Clerk (@clerk/clerk-react)
- Requires `VITE_CLERK_PUBLISHABLE_KEY` environment variable
- The ClerkProvider wraps the application in `src/main.tsx`
- Components use `<SignedIn>`, `<SignedOut>`, `<SignInButton>`, `<SignUpButton>`, and `<UserButton>` for auth UI
- Configure Clerk keys via `.env` file (not tracked in git)

**MapLibre vs Mapbox**: The application currently uses MapLibre GL, an open-source fork of Mapbox GL. This avoids the need for Mapbox access tokens. If switching to Mapbox-specific features, token management will need to be configured.

**deck.gl Layers**: deck.gl is included as a dependency for high-performance geospatial data visualization. Use deck.gl layers for rendering large datasets (points, polygons, lines) efficiently on top of the base map.

**UI Components**:
- The project uses shadcn/ui components built on Radix UI primitives
- All UI components are in `src/components/ui/` and use Tailwind CSS for styling
- Components support dark mode via next-themes (if configured)
- Use `cn()` utility from `src/components/ui/utils.ts` for className merging

**Tailwind CSS**:
- Tailwind CSS 4.1+ is configured for styling
- Global styles in `src/index.css` and `src/styles/globals.css`
- Use utility classes for component styling
- Custom theme configuration can be added via Tailwind config

**Vite Configuration**:
- The dev server is configured to listen on all interfaces (host: true) to support containerized development environments
- Build target is set to 'esnext' for modern JavaScript features
- Uses React SWC plugin for faster builds
- Path aliases configured (`@/*` maps to `./src/*`)
- Extensive dependency aliases for package resolution

**State Management**:
- Currently uses React useState hooks in `src/App.tsx`
- Maps, layers, comments, and UI state are managed at the top level
- Consider migrating to Context API or state management library if state becomes more complex

**Mock Data**:
- Sample layers and maps are defined in `src/App.tsx`
- Mock data includes Baltic Sea fishing data with GeoJSON and heatmap layers
- Replace with real API calls when backend is available

## Environment Variables

Create a `.env` file in the project root with:

```
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here
```

## TypeScript Configuration

- `tsconfig.json` - Main TypeScript configuration with strict mode enabled
- `tsconfig.node.json` - Configuration for Node.js environment (Vite config)
- Path aliases: `@/*` resolves to `./src/*`
- Target: ES2020 with DOM libraries
