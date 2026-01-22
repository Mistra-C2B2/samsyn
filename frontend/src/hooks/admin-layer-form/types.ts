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

export interface GeoTiffInfo {
	bounds: [number, number, number, number];
	minzoom: number;
	maxzoom: number;
	dtype: string;
	nodata: number | null;
	bandCount: number;
	width: number;
	height: number;
}

export interface GeoTiffStatistics {
	min: number;
	max: number;
	mean: number;
	std: number;
	percentile_2: number;
	percentile_98: number;
}

export interface GeoTiffFormState {
	url: string;
	colormap: string;
	rescaleMin: string;
	rescaleMax: string;
	bidx: string;
	bounds: [number, number, number, number] | null;
	info: GeoTiffInfo | null;
	statistics: Record<string, GeoTiffStatistics> | null;
	isLoading: boolean;
	error: string | null;
}

// ============================================================================
// Vector/GeoJSON Types
// ============================================================================

export interface VectorFormState {
	rawJson: string;
	parsedGeoJson: unknown;
	validation: {
		valid: boolean;
		error?: string;
		errorLine?: number;
		featureCount?: number;
		geometryTypes?: string[];
		bounds?: [number, number, number, number];
		hasProperties?: boolean;
		propertyKeys?: string[];
	} | null;
	styling: {
		color: string;
		lineWidth: number;
		fillPolygons: boolean;
	};
	inputMode: "paste" | "upload";
	fileName: string | null;
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
