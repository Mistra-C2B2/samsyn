import { useCallback, useState } from "react";
import type { Layer } from "../../App";
import {
	type GeoJSONValidationResult,
	normalizeToFeatureCollection,
	validateGeoJSON,
} from "../../utils/geojsonValidation";
import type { VectorFormState } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface VectorStyling {
	color: string;
	lineWidth: number;
	fillPolygons: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_STYLING: VectorStyling = {
	color: "#3388ff",
	lineWidth: 2,
	fillPolygons: true,
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing vector/GeoJSON layer form state.
 * Handles raw JSON input, file upload, validation, and styling.
 */
export function useVectorForm() {
	// Input mode
	const [inputMode, setInputMode] = useState<"paste" | "upload">("paste");

	// Raw JSON string (from paste or file)
	const [rawJson, setRawJson] = useState("");

	// Uploaded file info
	const [fileName, setFileName] = useState<string | null>(null);

	// Validation state
	const [validation, setValidation] = useState<GeoJSONValidationResult | null>(
		null,
	);
	const [isValidating, setIsValidating] = useState(false);

	// Parsed GeoJSON (only set if valid)
	const [parsedGeoJson, setParsedGeoJson] = useState<unknown>(null);

	// Styling options
	const [styling, setStyling] = useState<VectorStyling>(DEFAULT_STYLING);

	// Preview state
	const [showPreview, setShowPreview] = useState(false);

	// Validate the current raw JSON
	const validate = useCallback(() => {
		if (!rawJson.trim()) {
			setValidation(null);
			setParsedGeoJson(null);
			return null;
		}

		setIsValidating(true);

		try {
			const result = validateGeoJSON(rawJson);
			setValidation(result);

			if (result.valid) {
				const parsed = JSON.parse(rawJson);
				const normalized = normalizeToFeatureCollection(parsed);
				setParsedGeoJson(normalized);
			} else {
				setParsedGeoJson(null);
			}

			return result;
		} finally {
			setIsValidating(false);
		}
	}, [rawJson]);

	// Handle file upload
	const handleFileUpload = useCallback((file: File) => {
		setFileName(file.name);
		setInputMode("upload");

		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			setRawJson(content);

			// Auto-validate after file load
			const result = validateGeoJSON(content);
			setValidation(result);

			if (result.valid) {
				const parsed = JSON.parse(content);
				const normalized = normalizeToFeatureCollection(parsed);
				setParsedGeoJson(normalized);
			} else {
				setParsedGeoJson(null);
			}
		};
		reader.onerror = () => {
			setValidation({
				valid: false,
				error: "Failed to read file",
			});
		};
		reader.readAsText(file);
	}, []);

	// Clear uploaded file
	const clearFile = useCallback(() => {
		setFileName(null);
		setRawJson("");
		setValidation(null);
		setParsedGeoJson(null);
		setShowPreview(false);
	}, []);

	// Update styling
	const updateColor = useCallback((color: string) => {
		setStyling((prev) => ({ ...prev, color }));
	}, []);

	const updateLineWidth = useCallback((lineWidth: number) => {
		setStyling((prev) => ({ ...prev, lineWidth }));
	}, []);

	const updateFillPolygons = useCallback((fillPolygons: boolean) => {
		setStyling((prev) => ({ ...prev, fillPolygons }));
	}, []);

	// Reset entire form
	const reset = useCallback(() => {
		setInputMode("paste");
		setRawJson("");
		setFileName(null);
		setValidation(null);
		setParsedGeoJson(null);
		setStyling(DEFAULT_STYLING);
		setShowPreview(false);
	}, []);

	// Load from existing layer (for editing)
	const loadFromLayer = useCallback((layer: Layer) => {
		if (layer.data) {
			const json = JSON.stringify(layer.data, null, 2);
			setRawJson(json);

			const result = validateGeoJSON(json);
			setValidation(result);

			if (result.valid) {
				setParsedGeoJson(layer.data);
			}
		}

		// Load styling
		setStyling({
			color: layer.color || DEFAULT_STYLING.color,
			lineWidth: layer.lineWidth ?? DEFAULT_STYLING.lineWidth,
			fillPolygons: layer.fillPolygons ?? DEFAULT_STYLING.fillPolygons,
		});
	}, []);

	// Get form state for building layer
	const getState = useCallback((): VectorFormState => {
		return {
			rawJson,
			parsedGeoJson,
			validation,
			styling,
			inputMode,
			fileName,
		};
	}, [rawJson, parsedGeoJson, validation, styling, inputMode, fileName]);

	// Check if form is valid for submission
	const isValid = validation?.valid === true && parsedGeoJson !== null;

	return {
		// Input state
		inputMode,
		setInputMode,
		rawJson,
		setRawJson,
		fileName,

		// Validation
		validation,
		isValidating,
		validate,
		isValid,

		// Parsed data
		parsedGeoJson,

		// File handling
		handleFileUpload,
		clearFile,

		// Styling
		styling,
		updateColor,
		updateLineWidth,
		updateFillPolygons,

		// Preview
		showPreview,
		setShowPreview,

		// Actions
		reset,
		loadFromLayer,
		getState,
	};
}

export type UseVectorFormReturn = ReturnType<typeof useVectorForm>;
