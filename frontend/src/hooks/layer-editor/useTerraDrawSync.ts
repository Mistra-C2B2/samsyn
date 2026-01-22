import { useEffect, useRef } from "react";
import type { Layer } from "../../App";
import { useDebouncedCallback } from "../useDebounce";
import type { GeometryType, LayerEditorHook } from "../useLayerEditor";

// ============================================================================
// Types
// ============================================================================

export interface DrawingStyles {
	color: string;
	lineWidth: number;
	fillPolygons: boolean;
}

export type MarkerIconType =
	| "default"
	| "anchor"
	| "ship"
	| "warning"
	| "circle";

export interface UseTerraDrawSyncOptions {
	editor: LayerEditorHook;
	editingLayer?: Layer | null;
	onAddFeaturesToMap?: (
		features: Array<{ id: string; type: GeometryType; coordinates: unknown }>,
		color?: string,
	) => string[];
	onUpdateDrawingStyles?: (styles: DrawingStyles) => void;
	onMarkerIconChange?: (icon: MarkerIconType) => void;
	onMarkerColorChange?: (color: string) => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to synchronize LayerCreator state with TerraDraw.
 * Handles:
 * - Initializing existing features when editing a layer
 * - Adding pending features from GeoJSON import
 * - Cleanup on unmount
 * - Debounced style updates to TerraDraw
 * - Marker icon and color notifications
 */
export function useTerraDrawSync({
	editor,
	editingLayer,
	onAddFeaturesToMap,
	onUpdateDrawingStyles,
	onMarkerIconChange,
	onMarkerColorChange,
}: UseTerraDrawSyncOptions) {
	// Track if we've initialized existing features in TerraDraw
	const initializedFeaturesRef = useRef(false);
	const prevEditingLayerIdRef = useRef(editingLayer?.id);

	// Track features added via GeoJSON import to prevent duplicate adds
	const importedFeaturesRef = useRef<Set<string>>(new Set());

	// ============================================================================
	// Effect 1: Initialize existing features in TerraDraw when editing
	// ============================================================================

	useEffect(() => {
		const editingLayerId = editingLayer?.id;

		// Reset initialization flag when editingLayer changes
		if (prevEditingLayerIdRef.current !== editingLayerId) {
			initializedFeaturesRef.current = false;
			prevEditingLayerIdRef.current = editingLayerId;
		}

		// Initialize pending features in TerraDraw when editing
		if (
			!initializedFeaturesRef.current &&
			editor.isEditMode &&
			editor.pendingFeatures.length > 0 &&
			onAddFeaturesToMap
		) {
			const featuresToAdd = editor.pendingFeatures.map((f) => ({
				id: f.id,
				type: f.type,
				coordinates: f.coordinates,
			}));

			const addedIds = onAddFeaturesToMap(featuresToAdd, editor.layerColor);

			// Update features with new TerraDraw IDs
			if (addedIds.length > 0) {
				const idMappings: Array<{ oldId: string; newId: string }> = [];
				editor.pendingFeatures.forEach((feature, index) => {
					if (addedIds[index]) {
						idMappings.push({ oldId: feature.id, newId: addedIds[index] });
					}
				});

				if (idMappings.length > 0) {
					editor.remapFeatureIds(idMappings);
				}
			}

			initializedFeaturesRef.current = true;
		}
	}, [
		editingLayer?.id,
		editor.isEditMode,
		editor.pendingFeatures,
		editor.layerColor,
		editor.remapFeatureIds,
		onAddFeaturesToMap,
	]);

	// ============================================================================
	// Effect 2: Add pending features from GeoJSON import (create mode)
	// ============================================================================

	useEffect(() => {
		if (
			!editor.isEditMode &&
			editor.pendingFeatures.length > 0 &&
			onAddFeaturesToMap
		) {
			// Filter out features we've already added
			const newFeatures = editor.pendingFeatures.filter(
				(f) => !importedFeaturesRef.current.has(f.id),
			);

			if (newFeatures.length > 0) {
				const featuresToAdd = newFeatures.map((f) => ({
					id: f.id,
					type: f.type,
					coordinates: f.coordinates,
				}));

				const addedIds = onAddFeaturesToMap(featuresToAdd, editor.layerColor);

				// Update features with new TerraDraw IDs
				if (addedIds.length > 0) {
					const idMappings: Array<{ oldId: string; newId: string }> = [];
					newFeatures.forEach((feature, index) => {
						if (addedIds[index]) {
							idMappings.push({ oldId: feature.id, newId: addedIds[index] });
							// Track this feature as added
							importedFeaturesRef.current.add(feature.id);
						}
					});

					if (idMappings.length > 0) {
						editor.remapFeatureIds(idMappings);
					}
				}
			}
		}
	}, [
		editor.isEditMode,
		editor.pendingFeatures,
		editor.layerColor,
		editor.remapFeatureIds,
		onAddFeaturesToMap,
	]);

	// ============================================================================
	// Effect 3: Cleanup on unmount - reset editor state
	// ============================================================================

	useEffect(() => {
		return () => {
			editor.reset();
		};
	}, [editor.reset]);

	// ============================================================================
	// Effect 4: Clean up refs on unmount
	// ============================================================================

	useEffect(() => {
		return () => {
			initializedFeaturesRef.current = false;
			prevEditingLayerIdRef.current = undefined;
			importedFeaturesRef.current.clear();
		};
	}, []);

	// ============================================================================
	// Effect 5: Debounced style updates to TerraDraw
	// ============================================================================

	const debouncedUpdateStyles = useDebouncedCallback(
		(styles: DrawingStyles) => {
			if (onUpdateDrawingStyles) {
				onUpdateDrawingStyles(styles);
			}
		},
		100, // 100ms debounce for responsive feel without overwhelming TerraDraw
	);

	useEffect(() => {
		debouncedUpdateStyles({
			color: editor.layerColor,
			lineWidth: editor.lineWidth,
			fillPolygons: editor.fillPolygons,
		});
	}, [
		editor.layerColor,
		editor.lineWidth,
		editor.fillPolygons,
		debouncedUpdateStyles,
	]);

	// ============================================================================
	// Effect 6: Notify parent of marker icon (always "default")
	// ============================================================================

	useEffect(() => {
		if (onMarkerIconChange) {
			onMarkerIconChange("default");
		}
	}, [onMarkerIconChange]);

	// ============================================================================
	// Effect 7: Notify parent of color changes for marker overlay
	// ============================================================================

	useEffect(() => {
		if (onMarkerColorChange) {
			onMarkerColorChange(editor.layerColor);
		}
	}, [editor.layerColor, onMarkerColorChange]);

	return {
		initializedFeaturesRef,
	};
}
