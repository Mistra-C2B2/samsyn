import { useCallback, useEffect, useRef, useState } from "react";
import type { Layer } from "../App";
import type { TerraDrawFeature } from "../components/MapView";
import {
	type Feature,
	type FeatureMetadata,
	type GeometryType,
	type IconType,
	type LineStyle,
	type PendingFeature,
	useFeatureManager,
} from "./layer-editor/useFeatureManager";
import { useLayerBuilder } from "./layer-editor/useLayerBuilder";
import { useLayerMetadata } from "./layer-editor/useLayerMetadata";
import { useLayerValidation } from "./layer-editor/useLayerValidation";

// Re-export types for backward compatibility
export type {
	Feature,
	FeatureMetadata,
	GeometryType,
	IconType,
	LineStyle,
	PendingFeature,
};

// ============================================================================
// Types
// ============================================================================

// For backward compatibility with old code
export interface LayerEditorState {
	// Layer metadata
	layerName: string;
	category: string;
	description: string;
	layerColor: string;
	editableBy: "creator-only" | "everyone";

	// Feature metadata (geometry is in TerraDraw)
	featureMetadata: Map<string, FeatureMetadata>;

	// Pending features not yet in TerraDraw (during import/edit initialization)
	pendingFeatures: PendingFeature[];

	// UI state
	saving: boolean;
	error: string | null;

	// Edit mode tracking
	isEditMode: boolean;
	originalLayerId: string | null;
}

// ============================================================================
// Hook Options
// ============================================================================

interface UseLayerEditorOptions {
	editingLayer?: Layer | null;
	terraDrawSnapshot?: TerraDrawFeature[];
	onAddFeaturesToTerraDraw?: (features: PendingFeature[]) => void;
	currentUserId?: string;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Main hook for layer editing - orchestrates metadata, features, validation, and building.
 * This is a facade that composes smaller focused hooks.
 *
 * This refactored version splits responsibilities:
 * - useLayerMetadata: Layer name, category, description, color, editableBy
 * - useFeatureManager: Feature CRUD, TerraDraw sync, GeoJSON import
 * - useLayerValidation: Validation logic
 * - useLayerBuilder: Building final Layer object
 */
export function useLayerEditor(options: UseLayerEditorOptions = {}) {
	const {
		editingLayer,
		terraDrawSnapshot,
		onAddFeaturesToTerraDraw,
		currentUserId = "anonymous",
	} = options;

	// ============================================================================
	// UI State
	// ============================================================================

	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isEditMode, setIsEditMode] = useState(!!editingLayer);
	const [originalLayerId, setOriginalLayerId] = useState<string | null>(
		editingLayer?.id || null,
	);

	// Track if we've initialized from editingLayer
	const initializedRef = useRef(false);
	const editingLayerIdRef = useRef<string | null>(null);

	// ============================================================================
	// Compose smaller hooks
	// ============================================================================

	// 1. Layer Metadata Hook
	const metadata = useLayerMetadata({
		initialName: editingLayer?.name || "",
		initialCategory: editingLayer?.category || "",
		initialDescription: editingLayer?.description || "",
		initialColor: editingLayer?.color || "#3b82f6",
		initialEditableBy: editingLayer?.editable || "creator-only",
	});

	// 2. Feature Manager Hook
	const featureManager = useFeatureManager({
		terraDrawSnapshot,
	});

	// 3. Validation Hook
	const validation = useLayerValidation({
		layerName: metadata.layerName,
		features: featureManager.features,
	});

	// 4. Builder Hook
	const builder = useLayerBuilder({
		layerName: metadata.layerName,
		category: metadata.category,
		description: metadata.description,
		layerColor: metadata.layerColor,
		editableBy: metadata.editableBy,
		features: featureManager.features,
		validate: validation.validate,
		currentUserId,
		originalLayerId,
	});

	// ============================================================================
	// Layer initialization and synchronization
	// ============================================================================

	// Reset when editingLayer changes (different layer selected for editing)
	useEffect(() => {
		const newLayerId = editingLayer?.id || null;

		if (newLayerId !== editingLayerIdRef.current) {
			editingLayerIdRef.current = newLayerId;
			initializedRef.current = false;

			// Reinitialize state for the new layer
			if (editingLayer) {
				// Update metadata
				metadata.setMetadata({
					layerName: editingLayer.name || "",
					category: editingLayer.category || "",
					description: editingLayer.description || "",
					layerColor: editingLayer.color || "#3b82f6",
					editableBy: editingLayer.editable || "creator-only",
				});

				// Parse features from editing layer and set as pending
				const layerData = editingLayer.data as
					| {
							type: "FeatureCollection";
							features: Array<{
								type: string;
								geometry?: { type: string; coordinates: unknown };
								properties?: Record<string, unknown>;
							}>;
					  }
					| undefined;

				if (layerData?.features) {
					const pendingFeatures: PendingFeature[] = layerData.features
						.filter((f) => f.type === "Feature" && f.geometry)
						.map((f) => ({
							id: crypto.randomUUID(),
							type: f.geometry?.type as GeometryType,
							coordinates: f.geometry
								?.coordinates as PendingFeature["coordinates"],
							metadata: {
								name: (f.properties?.name as string) || "",
								description: (f.properties?.description as string) || "",
								icon: (f.properties?.icon as IconType) || "default",
								lineStyle: (f.properties?.lineStyle as LineStyle) || "solid",
							},
						}));

					// Import them via the feature manager
					if (pendingFeatures.length > 0) {
						featureManager.importGeoJson(
							JSON.stringify({
								type: "FeatureCollection",
								features: layerData.features,
							}),
						);
					}
				}

				setIsEditMode(true);
				setOriginalLayerId(editingLayer.id);
			} else {
				metadata.reset();
				featureManager.clearFeatures();
				setIsEditMode(false);
				setOriginalLayerId(null);
			}
			setError(null);
			setSaving(false);
		}
	}, [
		editingLayer,
		metadata.setMetadata,
		metadata.reset,
		featureManager.importGeoJson,
		featureManager.clearFeatures,
	]);

	// When editing an existing layer, add its pending features to TerraDraw
	useEffect(() => {
		if (
			!initializedRef.current &&
			isEditMode &&
			featureManager.pendingFeatures.length > 0 &&
			onAddFeaturesToTerraDraw
		) {
			onAddFeaturesToTerraDraw(featureManager.pendingFeatures);
			initializedRef.current = true;
		}
	}, [isEditMode, featureManager.pendingFeatures, onAddFeaturesToTerraDraw]);

	// Sync metadata with TerraDraw snapshot (remove metadata for deleted features)
	useEffect(() => {
		if (!terraDrawSnapshot) return;
		featureManager.syncFromTerraDraw(terraDrawSnapshot);
	}, [terraDrawSnapshot, featureManager.syncFromTerraDraw]);

	// ============================================================================
	// Actions with error handling
	// ============================================================================

	const setLayerNameWithErrorClear = useCallback(
		(name: string) => {
			metadata.setLayerName(name);
			setError(null);
		},
		[metadata.setLayerName],
	);

	// Matches existing API: addFeature(terraDrawId, metadata)
	const addFeature = useCallback(
		(terraDrawId: string | number, featureMetadata: FeatureMetadata) => {
			setError(null);
			const id = String(terraDrawId);
			featureManager.addFeatureMetadata(id, featureMetadata);
			return id;
		},
		[featureManager.addFeatureMetadata],
	);

	// Matches existing API: updateFeature(id, updates)
	const updateFeature = useCallback(
		(id: string, updates: Partial<FeatureMetadata>) => {
			setError(null);
			featureManager.updateFeatureMetadata(id, updates);
		},
		[featureManager.updateFeatureMetadata],
	);

	// Matches existing API: removeFeature(id)
	const removeFeature = useCallback(
		(id: string) => {
			featureManager.removeFeatureMetadata(id);
		},
		[featureManager.removeFeatureMetadata],
	);

	const importGeoJsonWithErrorClear = useCallback(
		(
			geoJsonString: string,
		): { success: boolean; error?: string; warning?: string } => {
			setError(null);
			return featureManager.importGeoJson(geoJsonString);
		},
		[featureManager.importGeoJson],
	);

	const clearError = useCallback(() => {
		setError(null);
	}, []);

	const setErrorWrapper = useCallback((err: string | null) => {
		setError(err);
	}, []);

	const reset = useCallback(() => {
		initializedRef.current = false;
		editingLayerIdRef.current = null;
		metadata.reset();
		featureManager.clearFeatures();
		setIsEditMode(false);
		setOriginalLayerId(null);
		setError(null);
		setSaving(false);
	}, [metadata.reset, featureManager.clearFeatures]);

	const getPendingFeatures = useCallback(() => {
		return featureManager.pendingFeatures;
	}, [featureManager.pendingFeatures]);

	// Validation with error setting
	const validateWithError = useCallback((): {
		valid: boolean;
		error?: string;
		warning?: string;
	} => {
		const result = validation.validate();
		if (!result.valid && result.error) {
			setError(result.error);
		}
		return result;
	}, [validation]);

	// Build layer with error handling
	const buildLayerWithError = useCallback(
		(editingLayerData?: Layer | null): Layer | null => {
			const result = builder.buildLayer(editingLayerData);
			if (!result) {
				const validationResult = validation.validate();
				setError(validationResult.error || "Validation failed");
			}
			return result;
		},
		[builder, validation],
	);

	// ============================================================================
	// Return - Maintains backward compatibility with existing API
	// ============================================================================

	return {
		// State - explicitly listed (matches original API)
		layerName: metadata.layerName,
		category: metadata.category,
		description: metadata.description,
		layerColor: metadata.layerColor,
		editableBy: metadata.editableBy,
		features: featureManager.features, // Merged features
		pendingFeatures: featureManager.pendingFeatures,
		saving,
		error,
		isEditMode,
		originalLayerId,

		// Metadata actions (matches original API)
		setLayerName: setLayerNameWithErrorClear,
		setCategory: metadata.setCategory,
		setDescription: metadata.setDescription,
		setLayerColor: metadata.setLayerColor,
		setEditableBy: metadata.setEditableBy,

		// Feature actions (matches original API signatures)
		addFeature, // (terraDrawId, metadata) => id
		updateFeature, // (id, updates) => void
		removeFeature, // (id) => void
		clearFeatures: featureManager.clearFeatures,
		remapFeatureIds: featureManager.remapFeatureIds,
		importGeoJson: importGeoJsonWithErrorClear,

		// Error handling (matches original API)
		setError: setErrorWrapper,
		clearError,

		// Utility (matches original API)
		validate: validateWithError,
		buildLayer: buildLayerWithError,
		reset,
		getPendingFeatures,

		// For saving state management (matches original API)
		setSaving,
	};
}

export type LayerEditorHook = ReturnType<typeof useLayerEditor>;
