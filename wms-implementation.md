# WMS Layer Support Implementation Plan

## Overview

Add comprehensive WMS layer support to SamSyn: rendering, layer discovery via GetCapabilities, enhanced UI, and tests.

**Priority Order**: Fix rendering first → Manual test → Backend proxy → Enhanced UI → E2E tests

---

## Phase 1: WMS Rendering in MapView

**Goal**: Make WMS layers display on the map (currently broken - no rendering code exists)

### Files to Modify

| File | Changes |
|------|---------|
| `/workspace/src/components/MapView.tsx` | Add WMS raster source/layer handling |

### Implementation

**1. Add WMS layer handling** (after line ~1429 in the layers forEach loop):

```typescript
else if (layer.type === "raster" && layer.wmsUrl && layer.wmsLayerName) {
  const wmsUrl = layer.wmsUrl.replace(/\/$/, "");
  const wmsParams = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.3.0",
    REQUEST: "GetMap",
    LAYERS: layer.wmsLayerName,
    FORMAT: "image/png",
    TRANSPARENT: "true",
    CRS: "EPSG:3857",
    WIDTH: "256",
    HEIGHT: "256",
  });

  const tileUrlTemplate = `${wmsUrl}?${wmsParams.toString()}&BBOX={bbox-epsg-3857}`;

  map.addSource(layer.id, {
    type: "raster",
    tiles: [tileUrlTemplate],
    tileSize: 256,
  });

  map.addLayer({
    id: `${layer.id}-raster`,
    type: "raster",
    source: layer.id,
    paint: { "raster-opacity": layer.opacity },
  });

  previousLayerState.set(layer.id, {
    visible: true,
    opacity: layer.opacity,
    dataHash: `wms-${layer.wmsUrl}-${layer.wmsLayerName}`,
  });
}
```

**2. Update `removeLayerFromMap` helper** (~line 1064): Add `${layerId}-raster` to layerVariations array

**3. Update `updateLayerOpacity` helper** (~line 1090): Add raster opacity handling:
```typescript
const rasterLayerId = `${layerId}-raster`;
if (map.getLayer(rasterLayerId)) {
  map.setPaintProperty(rasterLayerId, "raster-opacity", opacity);
}
```

**4. Update layer reordering** (~line 1446): Add `${layerId}-raster` to mapLayerIds array

### Verification
1. `npm run dev`
2. Open AdminPanel → Add WMS layer with your test server URL
3. Add layer to map via LayerManager
4. Verify tiles render, opacity works, visibility toggles

---

## Phase 2: Manual Testing

**Goal**: Validate Phase 1 before proceeding

### Test Checklist
- [ ] Create WMS layer via AdminPanel
- [ ] Add to map - tiles should load
- [ ] Check Network tab for WMS GetMap requests
- [ ] Toggle visibility on/off
- [ ] Adjust opacity slider
- [ ] Reorder with other layers
- [ ] Remove layer from map
- [ ] Test invalid URL (graceful failure)

---

## Phase 3: Backend GetCapabilities Proxy (Dev Mode Only)

**Goal**: Add proxy endpoint to fetch WMS capabilities (bypasses CORS)

### Files to Modify/Create

| File | Changes |
|------|---------|
| `/workspace/backend/app/api/v1/layers.py` | Add `GET /api/v1/wms/capabilities` endpoint |
| `/workspace/backend/app/core/config.py` | Add `DEV_MODE` setting |
| `/workspace/src/services/layerService.ts` | Add `getWMSCapabilities()` method |

### Backend Endpoint

```python
# In /workspace/backend/app/api/v1/layers.py

@router.get("/wms/capabilities")
async def get_wms_capabilities(url: str = Query(...)):
    """Proxy for WMS GetCapabilities (dev mode only)"""
    if not getattr(settings, 'DEV_MODE', False):
        raise HTTPException(403, "Only available in dev mode")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, params={
            "SERVICE": "WMS",
            "VERSION": "1.3.0",
            "REQUEST": "GetCapabilities"
        })

    # Parse XML, extract layers, return JSON:
    # { service_title: string, layers: [{name, title, abstract, queryable}] }
```

### Frontend Service Method

```typescript
// In /workspace/src/services/layerService.ts

async getWMSCapabilities(wmsUrl: string) {
  const params = new URLSearchParams({ url: wmsUrl });
  return this.client.get(`/api/v1/wms/capabilities?${params.toString()}`);
}
```

### Verification
1. Set `DEV_MODE=true` in backend .env
2. Test: `curl "http://localhost:8000/api/v1/wms/capabilities?url=<wms-url>"`
3. Verify JSON response with layers array

---

## Phase 4: Enhanced WMS Import UI

**Goal**: Replace basic form with layer discovery interface

### Files to Modify

| File | Changes |
|------|---------|
| `/workspace/src/components/AdminPanel.tsx` | Enhanced WMS form with discovery |

### New State Variables

```typescript
const [availableWmsLayers, setAvailableWmsLayers] = useState<
  Array<{ name: string; title: string; abstract: string }>
>([]);
const [fetchingCapabilities, setFetchingCapabilities] = useState(false);
const [wmsError, setWmsError] = useState<string | null>(null);
const layerService = useLayerService();
```

### Enhanced UI (replace lines 316-337)

```
┌─────────────────────────────────────────┐
│ WMS Service URL                         │
│ [________________________] [Discover]   │
├─────────────────────────────────────────┤
│ Available Layers (dropdown)             │
│ [Select a layer...          ▼]          │
├─────────────────────────────────────────┤
│ Layer Name (manual fallback)            │
│ [________________________]              │
├─────────────────────────────────────────┤
│ Error message (if any)                  │
└─────────────────────────────────────────┘
```

### Key Handlers

```typescript
const handleFetchCapabilities = async () => {
  setFetchingCapabilities(true);
  try {
    const caps = await layerService.getWMSCapabilities(wmsUrl);
    setAvailableWmsLayers(caps.layers);
    if (caps.service_title && !name) setName(caps.service_title);
  } catch (e) {
    setWmsError(e.message);
  } finally {
    setFetchingCapabilities(false);
  }
};

const handleSelectWmsLayer = (layerName: string) => {
  setWmsLayerName(layerName);
  const layer = availableWmsLayers.find(l => l.name === layerName);
  if (layer && !name) setName(layer.title || layer.name);
  if (layer?.abstract && !description) setDescription(layer.abstract);
};
```

### Verification
1. Open AdminPanel → Add WMS layer
2. Enter WMS URL → Click "Discover"
3. Verify dropdown populates with layers
4. Select layer → verify name/description auto-fill
5. Create layer → verify renders on map

---

## Phase 5: E2E Tests

**Goal**: Automated tests for WMS functionality

### Files to Create

| File | Purpose |
|------|---------|
| `/workspace/tests/e2e/wms-layers.spec.ts` | WMS test suite |
| `/workspace/tests/e2e/pages/admin.page.ts` | AdminPanel page object |

### Test Cases

```typescript
// wms-layers.spec.ts

test("should show WMS source option in layer creation")
test("should show WMS URL and layer name inputs when WMS selected")
test("should create WMS layer via Admin Panel")
test("WMS layer should render tiles on map")
test.skip("should fetch and display available layers from WMS") // Requires DEV_MODE
```

### Page Object

```typescript
// admin.page.ts

export class AdminPage {
  async selectWMSSource()
  async fillWMSLayer(url, layerName, displayName)
  async submitLayer()
  async createWMSLayer(url, layerName, displayName)
}
```

### Verification
```bash
npm test -- --grep "WMS"
npm run test:report
```

---

## Implementation Order & Dependencies

```
Phase 1 (Rendering) ──┬── Phase 2 (Manual Test)
                      │
                      ├── Phase 3 (Backend Proxy) ── Phase 4 (Enhanced UI)
                      │
                      └── Phase 5 (E2E Tests) [after all phases]
```

---

## Critical Files Summary

| File | Phase | Purpose |
|------|-------|---------|
| `src/components/MapView.tsx` | 1 | WMS rendering (lines ~1048-1475) |
| `src/components/AdminPanel.tsx` | 4 | Enhanced WMS form (lines 316-337) |
| `backend/app/api/v1/layers.py` | 3 | GetCapabilities proxy endpoint |
| `src/services/layerService.ts` | 3 | getWMSCapabilities method |
| `tests/e2e/wms-layers.spec.ts` | 5 | WMS test suite |

---

## Potential Issues

1. **WMS Version**: Some servers use 1.1.1 (uses `SRS` not `CRS`) - may need fallback
2. **CORS**: GetMap tile requests usually work (images bypass CORS); GetCapabilities needs proxy
3. **Projections**: Ensure WMS server supports EPSG:3857
4. **Auth**: Some WMS servers require credentials (out of scope for now)
