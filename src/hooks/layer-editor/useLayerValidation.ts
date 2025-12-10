import { useCallback } from "react";
import type { Feature } from "./useFeatureManager";

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
	valid: boolean;
	error?: string;
	warning?: string;
}

export interface UseLayerValidationOptions {
	layerName: string;
	features: Feature[];
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for validating layer data.
 * Checks layer name and features for completeness.
 */
export function useLayerValidation(options: UseLayerValidationOptions) {
	const { layerName, features } = options;

	const validate = useCallback((): ValidationResult => {
		if (!layerName.trim()) {
			return { valid: false, error: "Please enter a layer name" };
		}
		if (features.length === 0) {
			return {
				valid: false,
				error: "Please add at least one feature to the layer",
			};
		}
		const featuresWithNames = features.filter((f) => f.name.trim());
		if (featuresWithNames.length === 0) {
			return { valid: false, error: "Please give each feature a name" };
		}
		// Warn if some features will be skipped
		if (featuresWithNames.length < features.length) {
			const skippedCount = features.length - featuresWithNames.length;
			return {
				valid: true,
				warning: `${skippedCount} unnamed feature${skippedCount > 1 ? "s" : ""} will not be saved`,
			};
		}
		return { valid: true };
	}, [layerName, features]);

	return {
		validate,
	};
}

export type LayerValidationHook = ReturnType<typeof useLayerValidation>;
