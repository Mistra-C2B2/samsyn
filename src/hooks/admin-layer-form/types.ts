import type { Layer } from "../../App";

// ============================================================================
// Layer Source Types
// ============================================================================

export type LayerSource = "wms" | "geotiff" | "vector";

// ============================================================================
// WMS Types
// ============================================================================

export interface WmsLayerInfo {
	name: string;
	title: string;
	abstract: string | null;
	queryable: boolean;
	dimensions: Array<{
		name: string;
		extent: string;
		units: string | null;
		default: string | null;
	}>;
	styles: Array<{
		name: string;
		title: string;
		legendUrl?: string;
	}>;
	bounds: [number, number, number, number] | null;
	crs: string[] | null;
}

export interface WmsFormState {
	url: string;
	layerName: string;
	availableLayers: WmsLayerInfo[];
	fetchingCapabilities: boolean;
	error: string | null;
	layerFilter: string;
	timeDimension: { extent: string; default?: string } | null;
	queryable: boolean;
	style: string;
	availableStyles: Array<{ name: string; title: string; legendUrl?: string }>;
	bounds: [number, number, number, number] | null;
	serviceProvider: string | null;
	version: "1.1.1" | "1.3.0" | null;
	getMapFormats: string[];
	crs: string[];
	cqlFilter: string;
	discoveredProperties: Array<{
		name: string;
		sampleValue: string | null;
		type: string;
	}>;
	discoveringProperties: boolean;
}

// ============================================================================
// Legend Types
// ============================================================================

export interface LegendItem {
	label: string;
	color: string;
}

export interface LegendFormState {
	type: "gradient" | "categorical";
	items: LegendItem[];
	source: "manual" | "wms";
	wmsLegendUrl: string | null;
	imageError: boolean;
}

// ============================================================================
// Metadata Types
// ============================================================================

export interface MetadataFormState {
	name: string;
	description: string;
	author: string;
	doi: string;
	category: string;
}

// ============================================================================
// GeoTIFF Types
// ============================================================================

export interface GeoTiffFormState {
	url: string;
}

// ============================================================================
// Combined Form State
// ============================================================================

export interface AdminLayerFormState {
	layerSource: LayerSource;
	metadata: MetadataFormState;
	wms: WmsFormState;
	geotiff: GeoTiffFormState;
	legend: LegendFormState;
	editingLayerId: string | null;
}

// ============================================================================
// Form Actions
// ============================================================================

export interface AdminLayerFormActions {
	setLayerSource: (source: LayerSource) => void;
	resetForm: () => void;
	loadLayerForEdit: (layer: Layer) => void;
	buildLayer: () => Omit<Layer, "id"> | null;
}
