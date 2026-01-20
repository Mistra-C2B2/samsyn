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
	category: string;
	description: string;
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
	const { layerName, category, description, features } = options;

	const validate = useCallback((): ValidationResult => {
		if (!layerName.trim()) {
			return { valid: false, error: "Please enter a layer name" };
		}
		if (!category.trim()) {
			return { valid: false, error: "Please select or enter a category" };
		}
		if (!description.trim()) {
			return { valid: false, error: "Please enter a description" };
		}
		if (features.length === 0) {
			return {
				valid: false,
				error: "Please add at least one feature to the layer",
			};
		}
		return { valid: true };
	}, [layerName, category, description, features]);

	return {
		validate,
	};
}

export type LayerValidationHook = ReturnType<typeof useLayerValidation>;
