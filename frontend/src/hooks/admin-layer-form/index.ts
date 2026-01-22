// Main facade hook

// Types
export type {
	AdminLayerFormState,
	GeoTiffFormState,
	LayerSource,
	LegendFormState,
	LegendItem,
	MetadataFormState,
	VectorFormState,
	WmsFormState,
	WmsLayerInfo,
} from "./types";
export type { UseAdminLayerFormReturn } from "./useAdminLayerForm";
export { useAdminLayerForm } from "./useAdminLayerForm";
export { useGeoTiffForm } from "./useGeoTiffForm";
// Individual hooks (for advanced use cases)
export { useLayerMetadataForm } from "./useLayerMetadataForm";
export { useLegendForm } from "./useLegendForm";
export { useVectorForm } from "./useVectorForm";
export { useWmsForm } from "./useWmsForm";
