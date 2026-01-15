import { useCallback, useState } from "react";
import type { Layer } from "../../App";
import { useApiClient } from "../../services/api";
import { LayerService } from "../../services/layerService";
import type { GeoTiffFormState, GeoTiffInfo, GeoTiffStatistics } from "./types";

// Common colormaps available in TiTiler with their gradient colors
// Colors are sampled at key points (start, middle if applicable, end) to create legend gradients
export const GEOTIFF_COLORMAPS = [
	{ value: "", label: "Default (grayscale)", colors: ["#000000", "#ffffff"] },
	{
		value: "viridis",
		label: "Viridis",
		colors: ["#440154", "#21918c", "#fde725"],
	},
	{
		value: "plasma",
		label: "Plasma",
		colors: ["#0d0887", "#cc4778", "#f0f921"],
	},
	{
		value: "inferno",
		label: "Inferno",
		colors: ["#000004", "#bc3754", "#fcffa4"],
	},
	{ value: "magma", label: "Magma", colors: ["#000004", "#b63679", "#fcfdbf"] },
	{
		value: "terrain",
		label: "Terrain",
		colors: ["#333399", "#00cc00", "#ffcc66", "#ffffff"],
	},
	{ value: "blues", label: "Blues", colors: ["#f7fbff", "#08306b"] },
	{ value: "reds", label: "Reds", colors: ["#fff5f0", "#67000d"] },
	{ value: "greens", label: "Greens", colors: ["#f7fcf5", "#00441b"] },
	{ value: "greys", label: "Greys", colors: ["#ffffff", "#000000"] },
	{
		value: "rdylgn",
		label: "Red-Yellow-Green",
		colors: ["#a50026", "#ffffbf", "#006837"],
	},
	{
		value: "spectral",
		label: "Spectral",
		colors: ["#9e0142", "#ffffbf", "#5e4fa2"],
	},
	{
		value: "coolwarm",
		label: "Cool-Warm",
		colors: ["#3b4cc0", "#f7f7f7", "#b40426"],
	},
	{
		value: "bwr",
		label: "Blue-White-Red",
		colors: ["#0000ff", "#ffffff", "#ff0000"],
	},
] as const;

/**
 * Get colors for a colormap by name
 */
export function getColormapColors(colormap: string): string[] {
	const found = GEOTIFF_COLORMAPS.find((cm) => cm.value === colormap);
	return found?.colors || ["#000000", "#ffffff"]; // Default to grayscale
}

/**
 * Generate legend items from colormap and rescale values
 */
export function generateLegendFromColormap(
	colormap: string,
	rescaleMin: string,
	rescaleMax: string,
): { label: string; color: string }[] {
	const colors = getColormapColors(colormap);
	const min = rescaleMin ? Number.parseFloat(rescaleMin) : 0;
	const max = rescaleMax ? Number.parseFloat(rescaleMax) : 255;

	// For 2-color colormaps, just use start and end
	if (colors.length === 2) {
		return [
			{ label: formatLegendValue(min), color: colors[0] },
			{ label: formatLegendValue(max), color: colors[1] },
		];
	}

	// For 3+ color colormaps, create items for each color stop
	const step = (max - min) / (colors.length - 1);
	return colors.map((color, index) => ({
		label: formatLegendValue(min + step * index),
		color,
	}));
}

/**
 * Format a number for legend display
 */
function formatLegendValue(value: number): string {
	if (Number.isInteger(value)) {
		return value.toString();
	}
	// Use up to 2 decimal places, removing trailing zeros
	return value.toFixed(2).replace(/\.?0+$/, "");
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: GeoTiffFormState = {
	url: "",
	colormap: "",
	rescaleMin: "",
	rescaleMax: "",
	bidx: "",
	bounds: null,
	info: null,
	statistics: null,
	isLoading: false,
	error: null,
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing GeoTIFF layer form state.
 * Handles URL, colormap, rescale, band selection, and fetching COG info.
 */
export function useGeoTiffForm() {
	const [url, setUrl] = useState(initialState.url);
	const [colormap, setColormap] = useState(initialState.colormap);
	const [rescaleMin, setRescaleMin] = useState(initialState.rescaleMin);
	const [rescaleMax, setRescaleMax] = useState(initialState.rescaleMax);
	const [bidx, setBidx] = useState(initialState.bidx);
	const [bounds, setBounds] = useState<[number, number, number, number] | null>(
		initialState.bounds,
	);
	const [info, setInfo] = useState<GeoTiffInfo | null>(initialState.info);
	const [statistics, setStatistics] = useState<Record<
		string,
		GeoTiffStatistics
	> | null>(initialState.statistics);
	const [isLoading, setIsLoading] = useState(initialState.isLoading);
	const [error, setError] = useState<string | null>(initialState.error);

	const apiClient = useApiClient();

	/**
	 * Fetch GeoTIFF info and statistics from TiTiler
	 */
	const fetchInfo = useCallback(
		async (cogUrl: string) => {
			if (!cogUrl) {
				setError("Please enter a GeoTIFF URL");
				return;
			}

			setIsLoading(true);
			setError(null);

			const layerService = new LayerService(apiClient);

			try {
				// Fetch info first
				const infoResult = await layerService.getGeoTIFFInfo(cogUrl);

				const parsedInfo: GeoTiffInfo = {
					bounds: infoResult.bounds,
					minzoom: infoResult.minzoom,
					maxzoom: infoResult.maxzoom,
					dtype: infoResult.dtype,
					nodata: infoResult.nodata,
					bandCount: infoResult.count,
					width: infoResult.width,
					height: infoResult.height,
				};

				setInfo(parsedInfo);
				setBounds(infoResult.bounds);

				// Try to fetch statistics for rescale defaults
				try {
					const statsResult = await layerService.getGeoTIFFStatistics(cogUrl);

					// Parse statistics for each band
					const parsedStats: Record<string, GeoTiffStatistics> = {};
					for (const [bandKey, bandStats] of Object.entries(statsResult)) {
						parsedStats[bandKey] = {
							min: bandStats.min,
							max: bandStats.max,
							mean: bandStats.mean,
							std: bandStats.std,
							percentile_2: bandStats.percentile_2,
							percentile_98: bandStats.percentile_98,
						};
					}
					setStatistics(parsedStats);

					// Auto-set rescale from first band's percentiles (usually best for visualization)
					const firstBandKey = Object.keys(parsedStats)[0];
					if (firstBandKey && parsedStats[firstBandKey]) {
						const bandStats = parsedStats[firstBandKey];
						// Use 2nd and 98th percentile for better contrast
						setRescaleMin(Math.floor(bandStats.percentile_2).toString());
						setRescaleMax(Math.ceil(bandStats.percentile_98).toString());
					}
				} catch (statsError) {
					// Statistics fetch is optional - continue without it
					console.warn("Could not fetch GeoTIFF statistics:", statsError);
				}
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "Failed to fetch GeoTIFF info";
				setError(errorMessage);
				setInfo(null);
				setBounds(null);
				setStatistics(null);
			} finally {
				setIsLoading(false);
			}
		},
		[apiClient],
	);

	/**
	 * Reset form to initial state
	 */
	const reset = useCallback(() => {
		setUrl(initialState.url);
		setColormap(initialState.colormap);
		setRescaleMin(initialState.rescaleMin);
		setRescaleMax(initialState.rescaleMax);
		setBidx(initialState.bidx);
		setBounds(initialState.bounds);
		setInfo(initialState.info);
		setStatistics(initialState.statistics);
		setIsLoading(initialState.isLoading);
		setError(initialState.error);
	}, []);

	/**
	 * Load form state from an existing layer
	 */
	const loadFromLayer = useCallback((layer: Layer) => {
		setUrl(layer.geotiffUrl || "");
		setColormap(layer.geotiffColormap || "");
		setBidx(layer.geotiffBidx || "");
		setBounds(layer.geotiffBounds || null);

		// Parse rescale string (format: "min,max")
		if (layer.geotiffRescale) {
			const [min, max] = layer.geotiffRescale.split(",");
			setRescaleMin(min || "");
			setRescaleMax(max || "");
		} else {
			setRescaleMin("");
			setRescaleMax("");
		}

		// Clear transient state
		setInfo(null);
		setStatistics(null);
		setIsLoading(false);
		setError(null);
	}, []);

	/**
	 * Get current form state
	 */
	const getState = useCallback((): GeoTiffFormState => {
		return {
			url,
			colormap,
			rescaleMin,
			rescaleMax,
			bidx,
			bounds,
			info,
			statistics,
			isLoading,
			error,
		};
	}, [
		url,
		colormap,
		rescaleMin,
		rescaleMax,
		bidx,
		bounds,
		info,
		statistics,
		isLoading,
		error,
	]);

	/**
	 * Get rescale string for the layer (format: "min,max")
	 */
	const getRescaleString = useCallback((): string => {
		if (rescaleMin && rescaleMax) {
			return `${rescaleMin},${rescaleMax}`;
		}
		return "";
	}, [rescaleMin, rescaleMax]);

	/**
	 * Build preview URL for the current settings
	 */
	const getPreviewUrl = useCallback((): string | null => {
		if (!url) return null;

		const backendUrl = import.meta.env.VITE_API_URL || "";
		const params = new URLSearchParams({ url: url.trim() });

		params.set("width", "300");
		params.set("height", "200");

		if (colormap) {
			params.set("colormap", colormap);
		}

		const rescale = getRescaleString();
		if (rescale) {
			params.set("rescale", rescale);
		}

		if (bidx) {
			params.set("bidx", bidx);
		}

		return `${backendUrl}/api/v1/titiler/preview?${params.toString()}`;
	}, [url, colormap, bidx, getRescaleString]);

	return {
		// State
		url,
		colormap,
		rescaleMin,
		rescaleMax,
		bidx,
		bounds,
		info,
		statistics,
		isLoading,
		error,

		// Setters
		setUrl,
		setColormap,
		setRescaleMin,
		setRescaleMax,
		setBidx,
		setBounds,

		// Actions
		fetchInfo,
		reset,
		loadFromLayer,
		getState,
		getRescaleString,
		getPreviewUrl,
	};
}

export type UseGeoTiffFormReturn = ReturnType<typeof useGeoTiffForm>;
