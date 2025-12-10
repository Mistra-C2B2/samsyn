import { useCallback, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export interface LayerMetadata {
	layerName: string;
	category: string;
	description: string;
	layerColor: string;
	editableBy: "creator-only" | "everyone";
}

export interface UseLayerMetadataOptions {
	initialName?: string;
	initialCategory?: string;
	initialDescription?: string;
	initialColor?: string;
	initialEditableBy?: "creator-only" | "everyone";
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing layer metadata state.
 * Handles name, category, description, color, and editableBy permissions.
 */
export function useLayerMetadata(options: UseLayerMetadataOptions = {}) {
	const {
		initialName = "",
		initialCategory = "",
		initialDescription = "",
		initialColor = "#3b82f6",
		initialEditableBy = "creator-only",
	} = options;

	const [layerName, setLayerName] = useState(initialName);
	const [category, setCategory] = useState(initialCategory);
	const [description, setDescription] = useState(initialDescription);
	const [layerColor, setLayerColor] = useState(initialColor);
	const [editableBy, setEditableBy] = useState<"creator-only" | "everyone">(
		initialEditableBy,
	);

	const reset = useCallback(() => {
		setLayerName(initialName);
		setCategory(initialCategory);
		setDescription(initialDescription);
		setLayerColor(initialColor);
		setEditableBy(initialEditableBy);
	}, [
		initialName,
		initialCategory,
		initialDescription,
		initialColor,
		initialEditableBy,
	]);

	const setMetadata = useCallback((metadata: Partial<LayerMetadata>) => {
		if (metadata.layerName !== undefined) setLayerName(metadata.layerName);
		if (metadata.category !== undefined) setCategory(metadata.category);
		if (metadata.description !== undefined)
			setDescription(metadata.description);
		if (metadata.layerColor !== undefined) setLayerColor(metadata.layerColor);
		if (metadata.editableBy !== undefined) setEditableBy(metadata.editableBy);
	}, []);

	return {
		// State
		layerName,
		category,
		description,
		layerColor,
		editableBy,

		// Actions
		setLayerName,
		setCategory,
		setDescription,
		setLayerColor,
		setEditableBy,
		setMetadata,
		reset,
	};
}

export type LayerMetadataHook = ReturnType<typeof useLayerMetadata>;
