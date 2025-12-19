import { useCallback, useState } from "react";
import type { Layer } from "../../App";
import type { GeoTiffFormState } from "./types";

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing GeoTIFF layer form state.
 * Simply handles the GeoTIFF URL.
 */
export function useGeoTiffForm() {
	const [url, setUrl] = useState("");

	const reset = useCallback(() => {
		setUrl("");
	}, []);

	const loadFromLayer = useCallback((layer: Layer) => {
		setUrl(layer.geotiffUrl || "");
	}, []);

	const getState = useCallback((): GeoTiffFormState => {
		return { url };
	}, [url]);

	return {
		// State
		url,

		// Setters
		setUrl,

		// Actions
		reset,
		loadFromLayer,
		getState,
	};
}

export type UseGeoTiffFormReturn = ReturnType<typeof useGeoTiffForm>;
