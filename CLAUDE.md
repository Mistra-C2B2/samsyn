# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A geospatial visualization application built with React, deck.gl, and react-map-gl for rendering interactive maps and spatial data visualizations.

## Tech Stack

- **Frontend Framework**: React 18.3+ with Vite
- **Build Tool**: Vite 5.4+
- **Mapping Libraries**:
  - react-map-gl 8.1+ (React wrapper for Mapbox GL)
  - deck.gl 9.2+ (WebGL-powered visualization layers)
  - mapbox-gl 3.16+ (base mapping library)
  - maplibre-gl 5.13+ (open-source alternative to Mapbox GL)

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

- `src/main.jsx` - React application entry point with StrictMode wrapper
- `index.html` - HTML template with root div mount point

### Component Structure

- `src/App.jsx` - Main application component containing the map view with react-map-gl/maplibre integration
- `src/App.css` - Application-specific styles
- `src/index.css` - Global styles

### Map Implementation

The application currently uses MapLibre GL (via react-map-gl/maplibre) with a demo tile service. The map is initialized with:
- Default view centered on North America (longitude: -100, latitude: 40)
- Default zoom level of 3.5
- Interactive controls via onMove event handler

### Development Environment

The project uses a devcontainer configuration with:

- Network capabilities (NET_ADMIN, NET_RAW) for advanced networking features
- GPU support enabled
- Forwarded ports: 5173 (Vite dev server), 3000 (additional services)
- Prettier and ESLint configured with format-on-save
- Node.js environment with 4GB max old space size

## Key Considerations

**MapLibre vs Mapbox**: The application currently uses MapLibre GL, an open-source fork of Mapbox GL. This avoids the need for Mapbox access tokens. If switching to Mapbox-specific features, token management will need to be configured.

**deck.gl Layers**: deck.gl is included as a dependency for high-performance geospatial data visualization. Use deck.gl layers for rendering large datasets (points, polygons, lines) efficiently on top of the base map.

**Vite Configuration**: The dev server is configured to listen on all interfaces (host: true) to support containerized development environments. Build target is set to 'esnext' for modern JavaScript features.
