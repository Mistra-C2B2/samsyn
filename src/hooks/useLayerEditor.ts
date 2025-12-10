import { useCallback, useEffect, useReducer, useRef } from "react";
import type { Layer } from "../App";
import type { TerraDrawFeature } from "../components/MapView";

// ============================================================================
// Types
// ============================================================================

export type GeometryType = "Point" | "LineString" | "Polygon";
export type IconType = "default" | "anchor" | "ship" | "warning" | "circle";
export type LineStyle = "solid" | "dashed" | "dotted";

// GeoJSON Types
type GeoJSONCoordinates =
	| [number, number] // Point
	| [number, number][] // LineString
	| [number, number][][] // Polygon
	| [number, number][][][]; // MultiPolygon

interface GeoJSONGeometry {
	type: GeometryType;
	coordinates: GeoJSONCoordinates;
}

interface GeoJSONFeature {
	type: "Feature";
	geometry: GeoJSONGeometry;
	properties?: {
		name?: string;
		description?: string;
		icon?: string;
		lineStyle?: string;
		featureType?: string;
		[key: string]: unknown;
	};
}

interface GeoJSONFeatureCollection {
	type: "FeatureCollection";
	features: GeoJSONFeature[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function isValidCoordinates(coords: unknown, type: GeometryType): boolean {
	if (coords === null || coords === undefined) return false;

	if (type === "Point") {
		if (!Array.isArray(coords) || coords.length < 2) return false;
		return (
			typeof coords[0] === "number" &&
			typeof coords[1] === "number" &&
			Number.isFinite(coords[0]) &&
			Number.isFinite(coords[1]) &&
			coords[0] >= -180 &&
			coords[0] <= 180 &&
			coords[1] >= -90 &&
			coords[1] <= 90
		);
	}

	if (type === "LineString") {
		if (!Array.isArray(coords) || coords.length < 2) return false;
		return coords.every((coord) => isValidCoordinates(coord, "Point"));
	}

	if (type === "Polygon") {
		if (!Array.isArray(coords) || coords.length === 0) return false;
		return coords.every(
			(ring) =>
				Array.isArray(ring) &&
				ring.length >= 4 &&
				ring.every((coord) => isValidCoordinates(coord, "Point")),
		);
	}

	return false;
}

export interface Feature {
	id: string; // Unique ID for this feature (used for both local and TerraDraw tracking)
	type: GeometryType;
	name: string;
	description: string;
	coordinates: GeoJSONCoordinates;
	icon?: IconType;
	lineStyle?: LineStyle;
	// Internal: tracks if this feature exists in TerraDraw
	syncedToTerraDraw: boolean;
}

export interface LayerEditorState {
	// Layer metadata
	layerName: string;
	category: string;
	description: string;
	layerColor: string;
	editableBy: "creator-only" | "everyone";

	// Features
	features: Feature[];

	// UI state
	saving: boolean;
	error: string | null;

	// Edit mode tracking
	isEditMode: boolean;
	originalLayerId: string | null;
}

// ============================================================================
// Actions
// ============================================================================

type LayerEditorAction =
	| { type: "SET_LAYER_NAME"; payload: string }
	| { type: "SET_CATEGORY"; payload: string }
	| { type: "SET_DESCRIPTION"; payload: string }
	| { type: "SET_LAYER_COLOR"; payload: string }
	| { type: "SET_EDITABLE_BY"; payload: "creator-only" | "everyone" }
	| { type: "ADD_FEATURE"; payload: Feature }
	| {
			type: "UPDATE_FEATURE";
			payload: { id: string; updates: Partial<Feature> };
	  }
	| { type: "REMOVE_FEATURE"; payload: string }
	| { type: "CLEAR_FEATURES" }
	| { type: "SYNC_FROM_TERRADRAW"; payload: TerraDrawFeature[] }
	| { type: "MARK_FEATURES_SYNCED"; payload: string[] }
	| { type: "IMPORT_GEOJSON"; payload: Feature[] }
	| {
			type: "REMAP_FEATURE_IDS";
			payload: Array<{ oldId: string; newId: string }>;
	  }
	| { type: "SET_SAVING"; payload: boolean }
	| { type: "SET_ERROR"; payload: string | null }
	| { type: "CLEAR_ERROR" }
	| { type: "RESET" };

// ============================================================================
// Initial State Factory
// ============================================================================

function createInitialState(editingLayer?: Layer | null): LayerEditorState {
	if (editingLayer) {
		// Extract features from the editing layer's GeoJSON data
		const layerData = editingLayer.data as GeoJSONFeatureCollection | undefined;

		const features: Feature[] = layerData?.features
			? layerData.features.map((feature, _index) => ({
					id: crypto.randomUUID(), // Generate unique ID
					type: feature.geometry.type,
					name: feature.properties?.name || "",
					description: feature.properties?.description || "",
					coordinates: feature.geometry.coordinates,
					icon: (feature.properties?.icon as IconType) || "default",
					lineStyle: (feature.properties?.lineStyle as LineStyle) || "solid",
					syncedToTerraDraw: false, // Not yet synced - will be added to TerraDraw
				}))
			: [];

		return {
			layerName: editingLayer.name || "",
			category: editingLayer.category || "",
			description: editingLayer.description || "",
			layerColor: editingLayer.color || "#3b82f6",
			editableBy: editingLayer.editable || "creator-only",
			features,
			saving: false,
			error: null,
			isEditMode: true,
			originalLayerId: editingLayer.id,
		};
	}

	return {
		layerName: "",
		category: "",
		description: "",
		layerColor: "#3b82f6",
		editableBy: "creator-only",
		features: [],
		saving: false,
		error: null,
		isEditMode: false,
		originalLayerId: null,
	};
}

// ============================================================================
// Reducer
// ============================================================================

function layerEditorReducer(
	state: LayerEditorState,
	action: LayerEditorAction,
): LayerEditorState {
	switch (action.type) {
		case "SET_LAYER_NAME":
			return { ...state, layerName: action.payload, error: null };

		case "SET_CATEGORY":
			return { ...state, category: action.payload };

		case "SET_DESCRIPTION":
			return { ...state, description: action.payload };

		case "SET_LAYER_COLOR":
			return { ...state, layerColor: action.payload };

		case "SET_EDITABLE_BY":
			return { ...state, editableBy: action.payload };

		case "ADD_FEATURE":
			return {
				...state,
				features: [...state.features, action.payload],
				error: null,
			};

		case "UPDATE_FEATURE":
			return {
				...state,
				features: state.features.map((f) =>
					f.id === action.payload.id ? { ...f, ...action.payload.updates } : f,
				),
				error: null,
			};

		case "REMOVE_FEATURE":
			return {
				...state,
				features: state.features.filter((f) => f.id !== action.payload),
			};

		case "CLEAR_FEATURES":
			return { ...state, features: [] };

		case "SYNC_FROM_TERRADRAW": {
			// Create a map of TerraDraw features by ID for quick lookup
			const terraDrawMap = new Map(
				action.payload.map((f) => [String(f.id), f]),
			);

			// Update existing features with new coordinates from TerraDraw
			// Remove features that no longer exist in TerraDraw (were deleted)
			const syncedFeatures = state.features
				.map((feature) => {
					// If feature isn't synced to TerraDraw yet, keep it unchanged
					if (!feature.syncedToTerraDraw) {
						return feature;
					}

					// Find the corresponding TerraDraw feature
					const terraFeature = terraDrawMap.get(feature.id);

					// If not found in TerraDraw, it was deleted
					if (!terraFeature) {
						return null;
					}

					// Update coordinates if they changed (modified via select mode)
					return {
						...feature,
						coordinates: terraFeature.geometry.coordinates,
					};
				})
				.filter((f): f is Feature => f !== null);

			return { ...state, features: syncedFeatures };
		}

		case "MARK_FEATURES_SYNCED":
			return {
				...state,
				features: state.features.map((f) =>
					action.payload.includes(f.id) ? { ...f, syncedToTerraDraw: true } : f,
				),
			};

		case "REMAP_FEATURE_IDS": {
			const idMap = new Map(
				action.payload.map(({ oldId, newId }) => [oldId, newId]),
			);
			return {
				...state,
				features: state.features.map((f) => {
					const newId = idMap.get(f.id);
					if (newId) {
						return { ...f, id: newId, syncedToTerraDraw: true };
					}
					return f;
				}),
			};
		}

		case "IMPORT_GEOJSON":
			return {
				...state,
				features: action.payload,
				error: null,
			};

		case "SET_SAVING":
			return { ...state, saving: action.payload };

		case "SET_ERROR":
			return { ...state, error: action.payload };

		case "CLEAR_ERROR":
			return { ...state, error: null };

		case "RESET":
			return createInitialState();

		default:
			return state;
	}
}

// ============================================================================
// Hook Options
// ============================================================================

interface UseLayerEditorOptions {
	editingLayer?: Layer | null;
	terraDrawSnapshot?: TerraDrawFeature[];
	onAddFeaturesToTerraDraw?: (features: Feature[]) => void;
	currentUserId?: string;
}

// ============================================================================
// Hook
// ============================================================================

export function useLayerEditor(options: UseLayerEditorOptions = {}) {
	const {
		editingLayer,
		terraDrawSnapshot,
		onAddFeaturesToTerraDraw,
		currentUserId = "user-123",
	} = options;

	// Track if we've initialized from editingLayer
	const initializedRef = useRef(false);
	const editingLayerIdRef = useRef<string | null>(null);
	// Use a ref to track synced features state without triggering re-renders
	const hasSyncedFeaturesRef = useRef(false);

	// Initialize state based on editingLayer
	const [state, dispatch] = useReducer(
		layerEditorReducer,
		editingLayer,
		createInitialState,
	);

	// Reset when editingLayer changes (different layer selected for editing)
	useEffect(() => {
		const newLayerId = editingLayer?.id || null;

		if (newLayerId !== editingLayerIdRef.current) {
			editingLayerIdRef.current = newLayerId;
			initializedRef.current = false;

			// Reinitialize state for the new layer
			const newState = createInitialState(editingLayer);

			// Apply all the state changes
			dispatch({ type: "SET_LAYER_NAME", payload: newState.layerName });
			dispatch({ type: "SET_CATEGORY", payload: newState.category });
			dispatch({ type: "SET_DESCRIPTION", payload: newState.description });
			dispatch({ type: "SET_LAYER_COLOR", payload: newState.layerColor });
			dispatch({ type: "SET_EDITABLE_BY", payload: newState.editableBy });
			dispatch({ type: "IMPORT_GEOJSON", payload: newState.features });
		}
	}, [editingLayer]);

	// When editing an existing layer, add its features to TerraDraw
	useEffect(() => {
		if (
			!initializedRef.current &&
			state.isEditMode &&
			state.features.length > 0 &&
			onAddFeaturesToTerraDraw
		) {
			const unsyncedFeatures = state.features.filter(
				(f) => !f.syncedToTerraDraw,
			);
			if (unsyncedFeatures.length > 0) {
				onAddFeaturesToTerraDraw(unsyncedFeatures);
				initializedRef.current = true;
			}
		}
	}, [state.isEditMode, state.features, onAddFeaturesToTerraDraw]);

	// Update ref whenever features change
	useEffect(() => {
		hasSyncedFeaturesRef.current = state.features.some(
			(f) => f.syncedToTerraDraw,
		);
	}, [state.features]);

	// Sync features with TerraDraw snapshot (handles modifications and deletions)
	useEffect(() => {
		if (!terraDrawSnapshot || terraDrawSnapshot.length === 0) {
			// If TerraDraw is empty and we have synced features, they were all deleted
			if (hasSyncedFeaturesRef.current && terraDrawSnapshot?.length === 0) {
				dispatch({ type: "SYNC_FROM_TERRADRAW", payload: [] });
			}
			return;
		}

		dispatch({ type: "SYNC_FROM_TERRADRAW", payload: terraDrawSnapshot });
	}, [terraDrawSnapshot]);

	// ============================================================================
	// Actions
	// ============================================================================

	const setLayerName = useCallback((name: string) => {
		dispatch({ type: "SET_LAYER_NAME", payload: name });
	}, []);

	const setCategory = useCallback((category: string) => {
		dispatch({ type: "SET_CATEGORY", payload: category });
	}, []);

	const setDescription = useCallback((description: string) => {
		dispatch({ type: "SET_DESCRIPTION", payload: description });
	}, []);

	const setLayerColor = useCallback((color: string) => {
		dispatch({ type: "SET_LAYER_COLOR", payload: color });
	}, []);

	const setEditableBy = useCallback(
		(editableBy: "creator-only" | "everyone") => {
			dispatch({ type: "SET_EDITABLE_BY", payload: editableBy });
		},
		[],
	);

	const addFeature = useCallback(
		(
			feature: Omit<Feature, "id" | "syncedToTerraDraw">,
			terraDrawId?: string | number,
		) => {
			const newFeature: Feature = {
				...feature,
				id: terraDrawId ? String(terraDrawId) : crypto.randomUUID(),
				syncedToTerraDraw: !!terraDrawId, // If we have a TerraDraw ID, it's synced
			};
			dispatch({ type: "ADD_FEATURE", payload: newFeature });
			return newFeature.id;
		},
		[],
	);

	const updateFeature = useCallback(
		(id: string, updates: Partial<Omit<Feature, "id">>) => {
			dispatch({ type: "UPDATE_FEATURE", payload: { id, updates } });
		},
		[],
	);

	const removeFeature = useCallback((id: string) => {
		dispatch({ type: "REMOVE_FEATURE", payload: id });
	}, []);

	const clearFeatures = useCallback(() => {
		dispatch({ type: "CLEAR_FEATURES" });
	}, []);

	const markFeaturesSynced = useCallback((ids: string[]) => {
		dispatch({ type: "MARK_FEATURES_SYNCED", payload: ids });
	}, []);

	const remapFeatureIds = useCallback(
		(idMappings: Array<{ oldId: string; newId: string }>) => {
			dispatch({ type: "REMAP_FEATURE_IDS", payload: idMappings });
		},
		[],
	);

	const importGeoJson = useCallback(
		(
			geoJsonString: string,
		): { success: boolean; error?: string; warning?: string } => {
			try {
				const geoJsonData = JSON.parse(
					geoJsonString,
				) as GeoJSONFeatureCollection;
				if (geoJsonData.type !== "FeatureCollection") {
					return {
						success: false,
						error: "Invalid GeoJSON: Must be a FeatureCollection",
					};
				}

				const features: Feature[] = geoJsonData.features
					.map((feature, _index: number) => {
						const geometryType = feature.geometry.type;
						const coordinates = feature.geometry.coordinates;

						// Skip features with invalid coordinates
						if (!isValidCoordinates(coordinates, geometryType)) {
							return null;
						}

						return {
							id: crypto.randomUUID(),
							type: geometryType,
							name: feature.properties?.name || "",
							description: feature.properties?.description || "",
							coordinates,
							icon: (feature.properties?.icon as IconType) || "default",
							lineStyle:
								(feature.properties?.lineStyle as LineStyle) || "solid",
							syncedToTerraDraw: false,
						};
					})
					.filter((f): f is Feature => f !== null);

				if (features.length === 0) {
					return {
						success: false,
						error: "No valid features found in GeoJSON",
					};
				}

				if (features.length < geoJsonData.features.length) {
					// Some features were invalid but we imported what we could
					dispatch({ type: "IMPORT_GEOJSON", payload: features });
					return {
						success: true,
						warning: `Imported ${features.length} of ${geoJsonData.features.length} features (${geoJsonData.features.length - features.length} had invalid coordinates)`,
					};
				}

				dispatch({ type: "IMPORT_GEOJSON", payload: features });
				return { success: true };
			} catch (error: unknown) {
				return { success: false, error: (error as Error).message };
			}
		},
		[],
	);

	const setError = useCallback((error: string | null) => {
		dispatch({ type: "SET_ERROR", payload: error });
	}, []);

	const clearError = useCallback(() => {
		dispatch({ type: "CLEAR_ERROR" });
	}, []);

	const reset = useCallback(() => {
		initializedRef.current = false;
		editingLayerIdRef.current = null;
		dispatch({ type: "RESET" });
	}, []);

	const setSaving = useCallback((saving: boolean) => {
		dispatch({ type: "SET_SAVING", payload: saving });
	}, []);

	// ============================================================================
	// Validation
	// ============================================================================

	const validate = useCallback((): {
		valid: boolean;
		error?: string;
		warning?: string;
	} => {
		if (!state.layerName.trim()) {
			return { valid: false, error: "Please enter a layer name" };
		}
		if (state.features.length === 0) {
			return {
				valid: false,
				error: "Please add at least one feature to the layer",
			};
		}
		const featuresWithNames = state.features.filter((f) => f.name.trim());
		if (featuresWithNames.length === 0) {
			return { valid: false, error: "Please give each feature a name" };
		}
		// Warn if some features will be skipped
		if (featuresWithNames.length < state.features.length) {
			const skippedCount = state.features.length - featuresWithNames.length;
			return {
				valid: true,
				warning: `${skippedCount} unnamed feature${skippedCount > 1 ? "s" : ""} will not be saved`,
			};
		}
		return { valid: true };
	}, [state.layerName, state.features]);

	// ============================================================================
	// Build Layer
	// ============================================================================

	const buildLayer = useCallback(
		(editingLayerData?: Layer | null): Layer | null => {
			const validation = validate();
			if (!validation.valid) {
				dispatch({
					type: "SET_ERROR",
					payload: validation.error || "Validation failed",
				});
				return null;
			}

			const geoJsonFeatures: GeoJSONFeature[] = state.features
				.filter((f) => f.name.trim())
				.map((feature) => ({
					type: "Feature" as const,
					properties: {
						name: feature.name,
						description: feature.description,
						featureType: feature.type,
						icon: feature.icon,
						lineStyle: feature.lineStyle,
					},
					geometry: {
						type: feature.type,
						coordinates: feature.coordinates,
					},
				}));

			const layerData: GeoJSONFeatureCollection = {
				type: "FeatureCollection",
				features: geoJsonFeatures,
			};

			return {
				id: state.originalLayerId || crypto.randomUUID(),
				name: state.layerName,
				type: "geojson",
				visible: true,
				opacity: editingLayerData?.opacity || 0.7,
				color: state.layerColor,
				data: layerData,
				legend: {
					type: "categories",
					items: [{ color: state.layerColor, label: state.layerName }],
				},
				category: state.category || undefined,
				description: state.description || undefined,
				editable: state.editableBy,
				createdBy: editingLayerData?.createdBy || currentUserId,
			};
		},
		[state, validate, currentUserId],
	);

	// ============================================================================
	// Return
	// ============================================================================

	return {
		// State
		...state,

		// Metadata actions
		setLayerName,
		setCategory,
		setDescription,
		setLayerColor,
		setEditableBy,

		// Feature actions
		addFeature,
		updateFeature,
		removeFeature,
		clearFeatures,
		markFeaturesSynced,
		remapFeatureIds,
		importGeoJson,

		// Error handling
		setError,
		clearError,

		// Utility
		validate,
		buildLayer,
		reset,

		// For saving state management
		setSaving,
	};
}

export type LayerEditorHook = ReturnType<typeof useLayerEditor>;
