import { useCallback, useState } from "react";
import type { Layer } from "../../App";
import type { LayerSource } from "./types";
import { useGeoTiffForm } from "./useGeoTiffForm";
import { useLayerMetadataForm } from "./useLayerMetadataForm";
import { useLegendForm } from "./useLegendForm";
import { useWmsForm } from "./useWmsForm";

// ============================================================================
// Types
// ============================================================================

export interface UseAdminLayerFormOptions {
	editingLayer?: Layer | null;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Facade hook that composes all admin layer form hooks.
 * Provides a unified API for the AdminPanel component.
 */
export function useAdminLayerForm(options: UseAdminLayerFormOptions = {}) {
	const { editingLayer } = options;

	// Layer source selection
	const [layerSource, setLayerSource] = useState<LayerSource>("wms");
	const [editingLayerId, setEditingLayerId] = useState<string | null>(null);

	// Compose sub-hooks
	const metadata = useLayerMetadataForm();
	const legend = useLegendForm();
	const geotiff = useGeoTiffForm();

	// WMS form with callbacks for auto-populating metadata
	const wms = useWmsForm({
		onServiceProviderFetched: (provider) => {
			if (!metadata.author) {
				metadata.setAuthor(provider);
			}
		},
		onServiceTitleFetched: (title) => {
			if (!metadata.name) {
				metadata.setName(title);
			}
		},
		onLayerSelected: (layer) => {
			// Auto-fill metadata from selected WMS layer
			if (!metadata.name) {
				metadata.setName(layer.title || layer.name);
			}
			if (!metadata.description && layer.abstract) {
				metadata.setDescription(layer.abstract);
			}
		},
	});

	// Handle WMS layer selection with legend URL sync
	const handleWmsLayerSelect = useCallback(
		(layerName: string) => {
			const result = wms.selectLayer(layerName);
			if (result.legendUrl) {
				legend.setWmsLegend(result.legendUrl);
			}
		},
		[wms, legend],
	);

	// Handle WMS style change with legend URL sync
	const handleWmsStyleChange = useCallback(
		(styleName: string) => {
			const legendUrl = wms.updateStyleAndLegend(styleName);
			if (legendUrl) {
				legend.setWmsLegend(legendUrl);
			}
		},
		[wms, legend],
	);

	// Reset entire form
	const resetForm = useCallback(() => {
		setLayerSource("wms");
		setEditingLayerId(null);
		metadata.reset();
		legend.reset();
		wms.reset();
		geotiff.reset();
	}, [metadata, legend, wms, geotiff]);

	// Load layer for editing
	const loadLayerForEdit = useCallback(
		(layer: Layer) => {
			setEditingLayerId(layer.id);

			// Determine layer source
			if (layer.wmsUrl) {
				setLayerSource("wms");
				wms.loadFromLayer(layer);
			} else if (layer.geotiffUrl) {
				setLayerSource("geotiff");
				geotiff.loadFromLayer(layer);
			} else {
				setLayerSource("vector");
			}

			// Load common data
			metadata.loadFromLayer(layer);
			legend.loadFromLayer(layer);
		},
		[metadata, legend, wms, geotiff],
	);

	// Build layer object for saving
	const buildLayer = useCallback((): Omit<Layer, "id"> | null => {
		if (!metadata.name.trim()) {
			return null;
		}

		const legendState = legend.getState();
		const metadataState = metadata.getState();

		// Base layer data
		const layerData: Omit<Layer, "id"> = {
			name: metadataState.name,
			type:
				layerSource === "wms" || layerSource === "geotiff"
					? "raster"
					: "vector",
			visible: true,
			opacity: 1,
			description: metadataState.description || undefined,
			author: metadataState.author || undefined,
			doi: metadataState.doi || undefined,
			category: metadataState.category || undefined,
		};

		// Add legend if not using WMS legend
		if (!(layerSource === "wms" && legendState.source === "wms")) {
			const validItems = legendState.items.filter(
				(item) => item.label && item.color,
			);
			if (validItems.length > 0) {
				layerData.legend = {
					type: legendState.type === "categorical" ? "categories" : "gradient",
					items: validItems,
				};
			}
		}

		// Add WMS-specific properties
		if (layerSource === "wms") {
			const wmsState = wms.getState();
			layerData.wmsUrl = wmsState.url;
			layerData.wmsLayerName = wmsState.layerName;
			layerData.wmsQueryable = wmsState.queryable;

			if (wmsState.version) {
				layerData.wmsVersion = wmsState.version;
			}
			if (wmsState.crs.length > 0) {
				layerData.wmsCRS = wmsState.crs;
			}
			if (wmsState.cqlFilter.trim()) {
				layerData.wmsCqlFilter = wmsState.cqlFilter.trim();
			}
			if (wmsState.style) {
				layerData.wmsStyle = wmsState.style;
			}
			if (wmsState.availableStyles.length > 0) {
				layerData.wmsAvailableStyles = wmsState.availableStyles;
			}
			if (wmsState.bounds) {
				layerData.wmsBounds = wmsState.bounds;
			}
			if (wmsState.serviceProvider) {
				layerData.wmsAttribution = wmsState.serviceProvider;
			}
			if (
				legendState.source === "wms" &&
				legendState.wmsLegendUrl &&
				!legendState.imageError
			) {
				layerData.wmsLegendUrl = legendState.wmsLegendUrl;
			}
			if (wmsState.timeDimension) {
				layerData.wmsTimeDimension = wmsState.timeDimension;
				layerData.temporal = true;
				// Parse extent to set timeRange
				const parts = wmsState.timeDimension.extent.split("/");
				if (parts.length >= 2) {
					layerData.timeRange = {
						start: new Date(parts[0]),
						end: new Date(parts[1]),
					};
				}
			}
		}

		// Add GeoTIFF-specific properties
		if (layerSource === "geotiff") {
			const geotiffState = geotiff.getState();
			layerData.geotiffUrl = geotiffState.url;
		}

		return layerData;
	}, [layerSource, metadata, legend, wms, geotiff]);

	// Validation
	const isValid = metadata.name.trim().length > 0;

	return {
		// Layer source
		layerSource,
		setLayerSource,
		editingLayerId,

		// Sub-hook state (for component binding)
		metadata,
		legend,
		wms,
		geotiff,

		// Actions
		resetForm,
		loadLayerForEdit,
		buildLayer,
		handleWmsLayerSelect,
		handleWmsStyleChange,

		// Validation
		isValid,
	};
}

export type UseAdminLayerFormReturn = ReturnType<typeof useAdminLayerForm>;
