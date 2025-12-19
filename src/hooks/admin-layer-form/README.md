# Admin Layer Form Hooks

Hooks for managing the Admin Panel layer form state. These hooks follow the same pattern as the `layer-editor/` hooks - small focused hooks composed into a facade.

## Architecture

```
useAdminLayerForm (facade)
├── useLayerMetadataForm   # name, description, author, doi, category
├── useLegendForm          # legend type, items, WMS legend
├── useWmsForm             # WMS discovery, capabilities, styles, CQL
└── useGeoTiffForm         # GeoTIFF URL
```

## Usage

```tsx
import { useAdminLayerForm } from "@/hooks/admin-layer-form";

function AdminPanel() {
  const form = useAdminLayerForm();

  // Access sub-hook state
  const { metadata, legend, wms, geotiff } = form;

  // Layer source selection
  <Select value={form.layerSource} onValueChange={form.setLayerSource}>
    ...
  </Select>

  // Metadata fields
  <Input value={metadata.name} onChange={(e) => metadata.setName(e.target.value)} />

  // WMS layer selection
  <button onClick={() => wms.fetchCapabilities()}>Discover Layers</button>
  {wms.availableLayers.map(layer => (
    <button onClick={() => form.handleWmsLayerSelect(layer.name)}>
      {layer.title}
    </button>
  ))}

  // Build and save
  const handleSave = async () => {
    const layerData = form.buildLayer();
    if (layerData) {
      await onAddLayer({ id: crypto.randomUUID(), ...layerData });
      form.resetForm();
    }
  };
}
```

## Hooks

### useAdminLayerForm (facade)

Main hook that composes all sub-hooks and provides:
- Layer source selection (`wms`, `geotiff`, `vector`)
- Auto-population of metadata from WMS capabilities
- Legend URL synchronization with WMS layer/style selection
- `buildLayer()` to create Layer object for saving
- `loadLayerForEdit()` to populate form for editing
- `resetForm()` to clear all state

### useLayerMetadataForm

Manages basic layer metadata:
- `name`, `description`, `author`, `doi`, `category`
- `setName()`, `setDescription()`, etc.
- `loadFromLayer(layer)` to populate from existing layer
- `reset()` to clear

### useLegendForm

Manages legend configuration:
- `legendType` ("gradient" | "categorical")
- `legendItems` array with `{ label, color }`
- `legendSource` ("manual" | "wms")
- `addItem()`, `updateItem()`, `removeItem()`
- `setWmsLegend(url)` to set WMS legend URL

### useWmsForm

Manages WMS layer discovery and configuration:
- `url`, `layerName` - WMS service URL and layer name
- `fetchCapabilities()` - fetch WMS GetCapabilities
- `selectLayer(name)` - select a layer and extract metadata
- `discoverProperties()` - discover properties for CQL filtering
- `style`, `cqlFilter` - styling and filtering options
- All WMS metadata: bounds, CRS, version, formats, etc.

### useGeoTiffForm

Simple hook for GeoTIFF URL:
- `url` - GeoTIFF/COG URL
- `setUrl()`, `reset()`, `loadFromLayer()`
