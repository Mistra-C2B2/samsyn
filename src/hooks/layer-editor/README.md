# Layer Editor Hooks

This directory contains the refactored layer editor hooks that split the monolithic `useLayerEditor` hook into smaller, focused hooks.

## Architecture

The layer editor functionality is split into 4 focused hooks, orchestrated by a main facade hook:

### 1. `useLayerMetadata.ts`
**Responsibility**: Layer metadata state management

**State**:
- `layerName`, `category`, `description`, `layerColor`, `editableBy`

**Actions**:
- `setLayerName`, `setCategory`, `setDescription`, `setLayerColor`, `setEditableBy`
- `setMetadata` (batch update)
- `reset`

### 2. `useFeatureManager.ts`
**Responsibility**: Feature CRUD operations and TerraDraw synchronization

**State**:
- `featureMetadata`: Map<string, FeatureMetadata> - Metadata for features (name, description, icon, lineStyle)
- `pendingFeatures`: PendingFeature[] - Features not yet added to TerraDraw
- `features`: Feature[] - Merged view of metadata + TerraDraw coordinates

**Actions**:
- `addFeatureMetadata`, `updateFeatureMetadata`, `removeFeatureMetadata`
- `clearFeatures`, `syncFromTerraDraw`, `remapFeatureIds`
- `importGeoJson`, `clearPendingFeatures`

**Key Design**:
- Coordinates are stored in TerraDraw (the drawing library)
- This hook only stores metadata (name, description, icon, lineStyle)
- The `features` array is a computed/merged view of metadata + TerraDraw coordinates

### 3. `useLayerValidation.ts`
**Responsibility**: Validation logic

**Actions**:
- `validate()`: Validates layer name and features, returns validation result

### 4. `useLayerBuilder.ts`
**Responsibility**: Building final Layer objects

**Actions**:
- `buildLayer(editingLayerData?)`: Builds a Layer object from metadata and features

### 5. `useLayerEditor.ts` (Facade)
**Responsibility**: Orchestrates the other hooks and maintains backward compatibility

This hook:
- Composes the 4 smaller hooks
- Handles TerraDraw synchronization effects
- Manages edit mode and initialization logic
- Provides the same API as the original monolithic hook (backward compatible)

## Benefits

1. **Single Responsibility**: Each hook has one clear purpose
2. **Testability**: Smaller hooks are easier to test in isolation
3. **Reusability**: Individual hooks can be reused in other contexts
4. **Maintainability**: Changes to one concern don't affect others
5. **Backward Compatibility**: The main hook maintains the same API

## Usage

### Using the facade (recommended for existing code):
```tsx
import { useLayerEditor } from '@/hooks/useLayerEditor';

function LayerCreator() {
  const editor = useLayerEditor({ editingLayer, terraDrawSnapshot });
  // Same API as before
}
```

### Using individual hooks (for new code):
```tsx
import {
  useLayerMetadata,
  useFeatureManager,
  useLayerValidation,
  useLayerBuilder
} from '@/hooks/layer-editor';

function MyComponent() {
  const metadata = useLayerMetadata();
  const features = useFeatureManager({ terraDrawSnapshot });
  const validation = useLayerValidation({
    layerName: metadata.layerName,
    features: features.features
  });
  const builder = useLayerBuilder({ ...metadata, ...features, validate: validation.validate });

  // Use individual hooks...
}
```

## Migration Notes

The refactoring maintains full backward compatibility. No changes to consuming components (like `LayerCreator.tsx`) are required.

A backup of the original implementation is saved as `useLayerEditor.ts.backup`.
