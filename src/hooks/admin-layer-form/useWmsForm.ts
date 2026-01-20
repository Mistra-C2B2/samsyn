import { useCallback, useState } from "react";
import type { Layer } from "../../App";
import { useLayerService } from "../../services/layerService";
import type { WmsFormState, WmsLayerInfo } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface UseWmsFormOptions {
	onLayerSelected?: (layer: WmsLayerInfo) => void;
	onServiceProviderFetched?: (provider: string) => void;
	onServiceTitleFetched?: (title: string) => void;
}

export interface WmsLayerSelectionResult {
	timeDimension: { extent: string; default?: string } | null;
	legendUrl: string | null;
	queryable: boolean;
	styles: Array<{ name: string; title: string; legendUrl?: string }>;
	bounds: [number, number, number, number] | null;
	crs: string[];
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing WMS layer form state and discovery.
 * Handles URL input, capabilities fetching, layer selection, styles, CQL filters.
 */
export function useWmsForm(options: UseWmsFormOptions = {}) {
	const { onLayerSelected, onServiceProviderFetched, onServiceTitleFetched } =
		options;

	const layerService = useLayerService();

	// URL and layer name
	const [url, setUrl] = useState("");
	const [layerName, setLayerName] = useState("");

	// Discovery state
	const [availableLayers, setAvailableLayers] = useState<WmsLayerInfo[]>([]);
	const [fetchingCapabilities, setFetchingCapabilities] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [layerFilter, setLayerFilter] = useState("");

	// Time dimension
	const [timeDimension, setTimeDimension] = useState<{
		extent: string;
		default?: string;
	} | null>(null);

	// Layer properties
	const [queryable, setQueryable] = useState(false);
	const [style, setStyle] = useState("");
	const [availableStyles, setAvailableStyles] = useState<
		Array<{ name: string; title: string; legendUrl?: string }>
	>([]);
	const [bounds, setBounds] = useState<[number, number, number, number] | null>(
		null,
	);

	// Service info
	const [serviceProvider, setServiceProvider] = useState<string | null>(null);
	const [version, setVersion] = useState<"1.1.1" | "1.3.0" | null>(null);
	const [getMapFormats, setGetMapFormats] = useState<string[]>([]);
	const [crs, setCrs] = useState<string[]>([]);

	// CQL filter
	const [cqlFilter, setCqlFilter] = useState("");
	const [discoveredProperties, setDiscoveredProperties] = useState<
		Array<{ name: string; sampleValue: string | null; type: string }>
	>([]);
	const [discoveringProperties, setDiscoveringProperties] = useState(false);

	const fetchCapabilities = useCallback(async (): Promise<boolean> => {
		if (!url.trim()) return false;

		setFetchingCapabilities(true);
		setError(null);
		setAvailableLayers([]);

		try {
			const capabilities = await layerService.getWMSCapabilities(url);
			setAvailableLayers(capabilities.layers);

			// Store WMS version
			if (
				capabilities.version === "1.1.1" ||
				capabilities.version === "1.3.0"
			) {
				setVersion(capabilities.version);
			} else {
				setVersion("1.3.0");
			}

			// Store supported GetMap formats
			if (capabilities.getmap_formats) {
				setGetMapFormats(capabilities.getmap_formats);
			}

			// Notify about service title
			if (capabilities.service_title && onServiceTitleFetched) {
				onServiceTitleFetched(capabilities.service_title);
			}

			// Store and notify about service provider
			if (capabilities.service_provider) {
				setServiceProvider(capabilities.service_provider);
				if (onServiceProviderFetched) {
					onServiceProviderFetched(capabilities.service_provider);
				}
			} else {
				setServiceProvider(null);
			}

			return true;
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to fetch capabilities";
			setError(message);
			return false;
		} finally {
			setFetchingCapabilities(false);
		}
	}, [url, layerService, onServiceProviderFetched, onServiceTitleFetched]);

	const selectLayer = useCallback(
		(selectedLayerName: string): WmsLayerSelectionResult => {
			setLayerName(selectedLayerName);

			const selectedLayer = availableLayers.find(
				(l) => l.name === selectedLayerName,
			);

			if (!selectedLayer) {
				return {
					timeDimension: null,
					legendUrl: null,
					queryable: false,
					styles: [],
					bounds: null,
					crs: [],
				};
			}

			// Check for time dimension
			const timeDim = selectedLayer.dimensions.find(
				(d) => d.name.toLowerCase() === "time",
			);
			const newTimeDimension = timeDim
				? { extent: timeDim.extent, default: timeDim.default || undefined }
				: null;
			setTimeDimension(newTimeDimension);

			// Construct legend URL
			let legendUrl: string | null = null;
			if (url) {
				const baseUrl = url.split("?")[0];
				legendUrl = `${baseUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&LAYER=${encodeURIComponent(selectedLayerName)}&FORMAT=image/png`;
			}

			// Store queryable flag
			const isQueryable = selectedLayer.queryable || false;
			setQueryable(isQueryable);

			// Store available styles and select default
			const styles = selectedLayer.styles || [];
			setAvailableStyles(styles);
			if (styles.length > 0) {
				setStyle(styles[0].name);
				if (styles[0].legendUrl) {
					legendUrl = styles[0].legendUrl;
				}
			} else {
				setStyle("");
			}

			// Store bounds
			const layerBounds = selectedLayer.bounds || null;
			setBounds(layerBounds);

			// Store layer-specific CRS
			const layerCrs = selectedLayer.crs || [];
			setCrs(layerCrs);

			// Reset discovered properties
			setDiscoveredProperties([]);

			// Notify callback
			if (onLayerSelected) {
				onLayerSelected(selectedLayer);
			}

			return {
				timeDimension: newTimeDimension,
				legendUrl,
				queryable: isQueryable,
				styles,
				bounds: layerBounds,
				crs: layerCrs,
			};
		},
		[availableLayers, url, onLayerSelected],
	);

	const discoverProperties = useCallback(async (): Promise<void> => {
		if (!url || !layerName) return;

		setDiscoveringProperties(true);
		try {
			const boundsStr = bounds
				? `${bounds[0]},${bounds[1]},${bounds[2]},${bounds[3]}`
				: undefined;

			const result = await layerService.discoverWMSLayerProperties({
				wmsUrl: url,
				layer: layerName,
				bounds: boundsStr,
				version: version || "1.3.0",
			});

			setDiscoveredProperties(result.properties || []);
		} catch (err) {
			console.error("Failed to discover properties:", err);
			setDiscoveredProperties([]);
		} finally {
			setDiscoveringProperties(false);
		}
	}, [url, layerName, bounds, version, layerService]);

	const addPropertyToFilter = useCallback(
		(property: { name: string; sampleValue: string | null }) => {
			const filterPart =
				property.sampleValue !== null
					? `${property.name}='${property.sampleValue}'`
					: `${property.name}=''`;
			setCqlFilter((prev) => (prev ? `${prev} AND ${filterPart}` : filterPart));
		},
		[],
	);

	const updateStyleAndLegend = useCallback(
		(styleName: string): string | null => {
			setStyle(styleName);
			const selectedStyle = availableStyles.find((s) => s.name === styleName);
			if (selectedStyle?.legendUrl) {
				return selectedStyle.legendUrl;
			}
			if (url && layerName) {
				const baseUrl = url.split("?")[0];
				return `${baseUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&LAYER=${encodeURIComponent(layerName)}&STYLE=${encodeURIComponent(styleName)}&FORMAT=image/png`;
			}
			return null;
		},
		[availableStyles, url, layerName],
	);

	const reset = useCallback(() => {
		setUrl("");
		setLayerName("");
		setAvailableLayers([]);
		setFetchingCapabilities(false);
		setError(null);
		setLayerFilter("");
		setTimeDimension(null);
		setQueryable(false);
		setStyle("");
		setAvailableStyles([]);
		setBounds(null);
		setServiceProvider(null);
		setVersion(null);
		setGetMapFormats([]);
		setCrs([]);
		setCqlFilter("");
		setDiscoveredProperties([]);
		setDiscoveringProperties(false);
	}, []);

	const loadFromLayer = useCallback((layer: Layer) => {
		setUrl(layer.wmsUrl || "");
		setLayerName(layer.wmsLayerName || "");
		setStyle(layer.wmsStyle || "");
		setAvailableStyles(layer.wmsAvailableStyles || []);
		setBounds(layer.wmsBounds || null);
		setServiceProvider(layer.wmsAttribution || null);
		setVersion(layer.wmsVersion || null);
		setCrs(layer.wmsCRS || []);
		setCqlFilter(layer.wmsCqlFilter || "");
		setTimeDimension(layer.wmsTimeDimension || null);
		setQueryable(layer.wmsQueryable || false);
		// Reset discovery state
		setAvailableLayers([]);
		setError(null);
		setLayerFilter("");
		setDiscoveredProperties([]);
	}, []);

	const getState = useCallback((): WmsFormState => {
		return {
			url,
			layerName,
			availableLayers,
			fetchingCapabilities,
			error,
			layerFilter,
			timeDimension,
			queryable,
			style,
			availableStyles,
			bounds,
			serviceProvider,
			version,
			getMapFormats,
			crs,
			cqlFilter,
			discoveredProperties,
			discoveringProperties,
		};
	}, [
		url,
		layerName,
		availableLayers,
		fetchingCapabilities,
		error,
		layerFilter,
		timeDimension,
		queryable,
		style,
		availableStyles,
		bounds,
		serviceProvider,
		version,
		getMapFormats,
		crs,
		cqlFilter,
		discoveredProperties,
		discoveringProperties,
	]);

	return {
		// State
		url,
		layerName,
		availableLayers,
		fetchingCapabilities,
		error,
		layerFilter,
		timeDimension,
		queryable,
		style,
		availableStyles,
		bounds,
		serviceProvider,
		version,
		getMapFormats,
		crs,
		cqlFilter,
		discoveredProperties,
		discoveringProperties,

		// Setters
		setUrl,
		setLayerName,
		setLayerFilter,
		setStyle,
		setCqlFilter,
		setTimeDimension,
		setQueryable,
		setAvailableStyles,

		// Actions
		fetchCapabilities,
		selectLayer,
		discoverProperties,
		addPropertyToFilter,
		updateStyleAndLegend,
		reset,
		loadFromLayer,
		getState,
	};
}

export type UseWmsFormReturn = ReturnType<typeof useWmsForm>;
