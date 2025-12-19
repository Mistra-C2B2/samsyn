// Main facade hook

// Types
export type {
	AdminLayerFormState,
	GeoTiffFormState,
	LayerSource,
	LegendFormState,
	LegendItem,
	MetadataFormState,
	WmsFormState,
	WmsLayerInfo,
} from "./types";
export type { UseAdminLayerFormReturn } from "./useAdminLayerForm";
export { useAdminLayerForm } from "./useAdminLayerForm";
export { useGeoTiffForm } from "./useGeoTiffForm";
// Individual hooks (for advanced use cases)
export { useLayerMetadataForm } from "./useLayerMetadataForm";
export { useLegendForm } from "./useLegendForm";
export { useWmsForm } from "./useWmsForm";
