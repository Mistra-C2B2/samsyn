import { useCallback, useState } from "react";
import type { Layer } from "../../App";
import type { MetadataFormState } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface UseLayerMetadataFormOptions {
	initialName?: string;
	initialDescription?: string;
	initialAuthor?: string;
	initialDoi?: string;
	initialCategory?: string;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing layer metadata form state.
 * Handles name, description, author, DOI, and category fields.
 */
export function useLayerMetadataForm(
	options: UseLayerMetadataFormOptions = {},
) {
	const {
		initialName = "",
		initialDescription = "",
		initialAuthor = "",
		initialDoi = "",
		initialCategory = "",
	} = options;

	const [name, setName] = useState(initialName);
	const [description, setDescription] = useState(initialDescription);
	const [author, setAuthor] = useState(initialAuthor);
	const [doi, setDoi] = useState(initialDoi);
	const [category, setCategory] = useState(initialCategory);

	const reset = useCallback(() => {
		setName("");
		setDescription("");
		setAuthor("");
		setDoi("");
		setCategory("");
	}, []);

	const loadFromLayer = useCallback((layer: Layer) => {
		setName(layer.name);
		setDescription(layer.description || "");
		setAuthor(layer.author || "");
		setDoi(layer.doi || "");
		setCategory(layer.category || "");
	}, []);

	const getState = useCallback((): MetadataFormState => {
		return { name, description, author, doi, category };
	}, [name, description, author, doi, category]);

	return {
		// State
		name,
		description,
		author,
		doi,
		category,

		// Setters
		setName,
		setDescription,
		setAuthor,
		setDoi,
		setCategory,

		// Actions
		reset,
		loadFromLayer,
		getState,
	};
}

export type UseLayerMetadataFormReturn = ReturnType<
	typeof useLayerMetadataForm
>;
