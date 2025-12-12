import { useCallback, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export type IconType = "default" | "anchor" | "ship" | "warning" | "circle";

export interface LayerMetadata {
	layerName: string;
	category: string;
	description: string;
	layerColor: string;
	editableBy: "creator-only" | "everyone";
	// Style settings
	lineWidth: number;
	fillPolygons: boolean;
	markerIcon: IconType;
}

export interface UseLayerMetadataOptions {
	initialName?: string;
	initialCategory?: string;
	initialDescription?: string;
	initialColor?: string;
	initialEditableBy?: "creator-only" | "everyone";
	initialLineWidth?: number;
	initialFillPolygons?: boolean;
	initialMarkerIcon?: IconType;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing layer metadata state.
 * Handles name, category, description, color, editableBy permissions, and style settings.
 */
export function useLayerMetadata(options: UseLayerMetadataOptions = {}) {
	const {
		initialName = "",
		initialCategory = "",
		initialDescription = "",
		initialColor = "#3b82f6",
		initialEditableBy = "creator-only",
		initialLineWidth = 2,
		initialFillPolygons = true,
		initialMarkerIcon = "default",
	} = options;

	const [layerName, setLayerName] = useState(initialName);
	const [category, setCategory] = useState(initialCategory);
	const [description, setDescription] = useState(initialDescription);
	const [layerColor, setLayerColor] = useState(initialColor);
	const [editableBy, setEditableBy] = useState<"creator-only" | "everyone">(
		initialEditableBy,
	);
	// Style settings
	const [lineWidth, setLineWidth] = useState(initialLineWidth);
	const [fillPolygons, setFillPolygons] = useState(initialFillPolygons);
	const [markerIcon, setMarkerIcon] = useState<IconType>(initialMarkerIcon);

	const reset = useCallback(() => {
		setLayerName(initialName);
		setCategory(initialCategory);
		setDescription(initialDescription);
		setLayerColor(initialColor);
		setEditableBy(initialEditableBy);
		setLineWidth(initialLineWidth);
		setFillPolygons(initialFillPolygons);
		setMarkerIcon(initialMarkerIcon);
	}, [
		initialName,
		initialCategory,
		initialDescription,
		initialColor,
		initialEditableBy,
		initialLineWidth,
		initialFillPolygons,
		initialMarkerIcon,
	]);

	const setMetadata = useCallback((metadata: Partial<LayerMetadata>) => {
		if (metadata.layerName !== undefined) setLayerName(metadata.layerName);
		if (metadata.category !== undefined) setCategory(metadata.category);
		if (metadata.description !== undefined)
			setDescription(metadata.description);
		if (metadata.layerColor !== undefined) setLayerColor(metadata.layerColor);
		if (metadata.editableBy !== undefined) setEditableBy(metadata.editableBy);
		if (metadata.lineWidth !== undefined) setLineWidth(metadata.lineWidth);
		if (metadata.fillPolygons !== undefined)
			setFillPolygons(metadata.fillPolygons);
		if (metadata.markerIcon !== undefined) setMarkerIcon(metadata.markerIcon);
	}, []);

	return {
		// State
		layerName,
		category,
		description,
		layerColor,
		editableBy,
		lineWidth,
		fillPolygons,
		markerIcon,

		// Actions
		setLayerName,
		setCategory,
		setDescription,
		setLayerColor,
		setEditableBy,
		setLineWidth,
		setFillPolygons,
		setMarkerIcon,
		setMetadata,
		reset,
	};
}

export type LayerMetadataHook = ReturnType<typeof useLayerMetadata>;
