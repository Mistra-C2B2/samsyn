# WMS Layer Configuration Improvements

This document outlines improvements to the Admin Panel's WMS layer sidebar to take full advantage of the WMS standard.

## Current Implementation

| Component | Data Captured |
|-----------|---------------|
| **AdminPanel UI** | WMS URL, Layer name, Manual legend |
| **GetCapabilities Parser** | service_title, layers (name, title, abstract, queryable) |
| **MapView Renderer** | Hardcoded: VERSION 1.3.0, FORMAT png, CRS EPSG:3857, STYLES empty |
| **Layer Type** | `wmsUrl`, `wmsLayerName` only |

---

## Improvements

### 1. Temporal Dimension Support
**Priority:** 🔴 High | **Effort:** Medium | **Impact:** High

The AIS density layer has TIME dimension (2011-01 to 2024-09) but the UI ignores it.

**Changes needed:**
- Parse `<Dimension name="time">` from GetCapabilities
- Show time range picker when layer has temporal dimension
- Integrate with existing TimeSlider component
- Add TIME parameter to WMS requests dynamically

**New Layer properties:**
```typescript
wmsTimeDimension?: {
  extent: string;        // "2011-01-01/2024-09-01/P1M"
  default?: string;      // default time value
  current?: string;      // currently selected time
  nearestValue?: boolean;
}
```

**Status:** [x] Completed

---

### 2. GetLegendGraphic Auto-fetch
**Priority:** 🟡 Medium | **Effort:** Low | **Impact:** Medium

WMS can provide its own styled legend image.

**Changes needed:**
- Add "Fetch from WMS" button for legend
- Construct URL: `{wmsUrl}?SERVICE=WMS&REQUEST=GetLegendGraphic&LAYER={layer}&FORMAT=image/png`
- Display fetched legend image
- Fall back to manual legend if service doesn't support it

**New Layer properties:**
```typescript
wmsLegendUrl?: string;
```

**Status:** [x] Completed

---

### 3. GetFeatureInfo for Queryable Layers
**Priority:** 🔴 High | **Effort:** Medium | **Impact:** High

The `queryable` property is parsed but never used.

**Changes needed:**
- When layer is queryable, enable click-to-query on map
- Make GetFeatureInfo request on click
- Display results in popup/sidebar
- Support multiple formats: GeoJSON, HTML, XML, CSV

**New Layer properties:**
```typescript
wmsQueryable?: boolean;
wmsFeatureInfoFormat?: string;  // "application/json", "text/html", etc.
```

**Status:** [x] Completed

---

### 4. Style Selection
**Priority:** 🟡 Medium | **Effort:** Low | **Impact:** Medium

WMS layers can have multiple named styles.

**Changes needed:**
- Parse `<Style>` elements from GetCapabilities
- Show style dropdown when layer has multiple styles
- Preview style using GetLegendGraphic for each style

**New Layer properties:**
```typescript
wmsStyle?: string;
wmsAvailableStyles?: Array<{ name: string; title: string; legendUrl?: string }>;
```

**Status:** [x] Completed

---

### 5. Bounding Box / Zoom-to-Layer
**Priority:** 🟡 Medium | **Effort:** Low | **Impact:** Medium

GetCapabilities returns geographic extent.

**Changes needed:**
- Parse `<BoundingBox>` or `<EX_GeographicBoundingBox>`
- Add "Zoom to layer extent" button
- Validate user's AOI intersects with layer coverage

**New Layer properties:**
```typescript
wmsBounds?: [west: number, south: number, east: number, north: number];
```

**Status:** [x] Completed

---

### 6. Format Selection
**Priority:** 🟢 Low | **Effort:** Low | **Impact:** Low

Different formats suit different needs.

**Changes needed:**
- Parse supported formats from GetCapabilities
- Allow selection: PNG (default), JPEG, WebP if supported
- JPEG = smaller tiles for base imagery
- PNG = required for transparent overlays

**New Layer properties:**
```typescript
wmsFormat?: "image/png" | "image/jpeg" | "image/webp";
```

**Status:** [ ] Not started

---

### 7. Additional Dimensions (ELEVATION, etc.)
**Priority:** 🟢 Low | **Effort:** Medium | **Impact:** Low

WMS can have custom dimensions beyond TIME.

**Changes needed:**
- Parse all `<Dimension>` elements
- Generate appropriate UI controls (slider, dropdown)

**New Layer properties:**
```typescript
wmsDimensions?: Record<string, {
  name: string;
  units?: string;
  extent: string;
  default?: string;
  current?: string;
}>;
```

**Status:** [ ] Not started

---

### 8. Scale Constraints
**Priority:** 🟢 Low | **Effort:** Low | **Impact:** Low

WMS specifies min/max scale denominators.

**Changes needed:**
- Parse `<MinScaleDenominator>` / `<MaxScaleDenominator>`
- Auto-hide layer outside valid zoom range
- Show warning in UI if current zoom is outside range

**New Layer properties:**
```typescript
wmsMinZoom?: number;
wmsMaxZoom?: number;
```

**Status:** [ ] Not started

---

### 9. Layer Attribution
**Priority:** 🟢 Low | **Effort:** Low | **Impact:** Low

Service metadata can populate author/source fields.

**Changes needed:**
- Parse `<ContactInformation>` and `<AccessConstraints>`
- Auto-fill Author field from service provider
- Show attribution on map when layer is visible

**Status:** [x] Completed

---

### 10. Keywords for Categorization
**Priority:** 🟢 Low | **Effort:** Low | **Impact:** Low

Layer keywords can suggest categories.

**Changes needed:**
- Parse `<KeywordList>` from layer
- Suggest category based on keywords

**Status:** [ ] Not started

---

### 11. Service Version Negotiation
**Priority:** 🟢 Low | **Effort:** Medium | **Impact:** Low

Different servers support different WMS versions.

**Changes needed:**
- Parse supported versions from GetCapabilities
- Use highest mutually supported version
- Handle 1.1.1 vs 1.3.0 differences (SRS vs CRS, axis order)

**New Layer properties:**
```typescript
wmsVersion?: "1.1.1" | "1.3.0";
wmsCRS?: string[];  // Supported coordinate reference systems
```

**Status:** [x] Completed

---

### 12. Layer Hierarchy Display
**Priority:** 🟢 Low | **Effort:** Medium | **Impact:** Low

WMS can have nested layer groups.

**Changes needed:**
- Parse parent/child layer relationships
- Display as tree/accordion in layer list
- Allow selecting entire groups

**Status:** [ ] Not started

---

### 13. Multi-Layer Composition
**Priority:** 🟢 Low | **Effort:** Low | **Impact:** Low

WMS LAYERS parameter accepts comma-separated values.

**Changes needed:**
- Allow selecting multiple layers from same service
- Combine into single request (more efficient)

**New Layer properties:**
```typescript
wmsLayerNames?: string[];  // instead of single wmsLayerName
```

**Status:** [ ] Not started

---

### 14. CRS Validation
**Priority:** 🟢 Low | **Effort:** Low | **Impact:** Low

Ensure layer supports map's projection.

**Changes needed:**
- Parse supported CRS list from GetCapabilities
- Warn if EPSG:3857 not supported
- Show available projections

**Status:** [ ] Not started

---

### 15. CQL Filter Support (Vendor Extension)
**Priority:** 🟡 Medium | **Effort:** Low | **Impact:** Medium

GeoServer and MapServer support CQL_FILTER for server-side filtering.

**Changes needed:**
- Add CQL filter input field in AdminPanel
- Pass CQL_FILTER parameter in WMS GetMap requests
- Pass CQL_FILTER parameter in GetFeatureInfo requests

**New Layer properties:**
```typescript
wmsCqlFilter?: string;  // CQL_FILTER expression (e.g., "category='All'")
```

**Example for AIS density layer:**
```
category_column='All' AND category='All'
```

**Status:** [x] Completed

---

## Backend Changes Required

The `getWMSCapabilities` endpoint (`/api/v1/wms/capabilities`) needs to return more data:

```typescript
interface WMSCapabilities {
  service: {
    title: string;
    abstract?: string;
    contactInfo?: { organization: string; email?: string };
    accessConstraints?: string;
  };
  version: string;
  supportedFormats: string[];
  supportedCRS: string[];
  layers: Array<{
    name: string;
    title: string;
    abstract?: string;
    queryable: boolean;
    bounds?: [number, number, number, number];
    styles?: Array<{ name: string; title: string; legendUrl?: string }>;
    dimensions?: Array<{
      name: string;      // "time", "elevation", etc.
      units?: string;
      extent: string;    // ISO8601 for time, numeric range for others
      default?: string;
    }>;
    minScale?: number;
    maxScale?: number;
    keywords?: string[];
  }>;
}
```

---

## Proposed Enhanced UI

```
┌─────────────────────────────────────────┐
│ WMS Service URL                         │
│ [https://example.com/wms        ] [🔍]  │
│                                         │
│ ✓ Connected: MapLarge OGC WMS           │
│   Version: 1.3.0 | Formats: PNG, JPEG   │
├─────────────────────────────────────────┤
│ Available Layers (1)           [Filter] │
│ ┌─────────────────────────────────────┐ │
│ │ ● ais:density                       │ │
│ │   "AIS Vessel Density"              │ │
│ │   📍 Global | 🔍 Queryable          │ │
│ │   📅 2011-01 → 2024-09 (temporal)   │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ Layer Configuration                     │
│                                         │
│ Style: [Default Style        ▼]         │
│                                         │
│ ☑ Enable temporal dimension             │
│ Time Range: [2023-01] → [2023-12]       │
│ ○ Animate  ● Single time               │
│                                         │
│ Format: [PNG (transparent)   ▼]         │
│                                         │
│ ☑ Enable click-to-query (GetFeatureInfo)│
├─────────────────────────────────────────┤
│ Legend                                  │
│ ○ Fetch from WMS  ● Define manually     │
│ [Preview: ████████████ Low → High]      │
├─────────────────────────────────────────┤
│ Metadata (auto-filled)                  │
│ Name: [AIS Vessel Density    ]          │
│ Author: [MapLarge            ]          │
│ Category: [Shipping ▼]  Suggested: time │
│ Bounds: [-180, -89] to [180, 89]        │
│ [🔎 Zoom to Layer Extent]               │
└─────────────────────────────────────────┘
```

---

## Implementation Order (Recommended)

1. **Temporal Dimension Support** - Highest value, enables time-series visualization
2. **GetFeatureInfo** - Enables data inspection on click
3. **GetLegendGraphic** - Better legends with less manual work
4. **Bounding Box + Zoom** - Navigation improvement
5. **Style Selection** - More visualization options
6. Remaining items as needed

---

## Test WMS Services

| Service | URL | Features |
|---------|-----|----------|
| AIS Density | `https://gmtds.maplarge.com/ogc/ais:density/wms` | Temporal, Queryable, Global |
| GEBCO Bathymetry | `https://www.gebco.net/data_and_products/gebco_web_services/web_map_service/mapserv` | Multiple layers, styles |
| EMODnet | `https://ows.emodnet-bathymetry.eu/wms` | EU coverage, multiple formats |
