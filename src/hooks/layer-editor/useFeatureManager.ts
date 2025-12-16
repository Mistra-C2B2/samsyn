import { useCallback, useReducer } from "react";
import type { TerraDrawFeature } from "../../components/MapView";

// ============================================================================
// Types
// ============================================================================

export type GeometryType =
	| "Point"
	| "Marker"
	| "LineString"
	| "Polygon"
	| "Rectangle"
	| "Circle"
	| "Freehand";
export type IconType = "default" | "anchor" | "ship" | "warning" | "circle";

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
		featureType?: string;
		[key: string]: unknown;
	};
}

interface GeoJSONFeatureCollection {
	type: "FeatureCollection";
	features: GeoJSONFeature[];
}

// Metadata that we store (NOT coordinates - those are in TerraDraw)
export interface FeatureMetadata {
	name: string;
	description: string;
	icon?: IconType;
}

// Temporary feature data for features not yet in TerraDraw (during import/edit init)
export interface PendingFeature {
	id: string; // Temporary ID
	type: GeometryType;
	coordinates: GeoJSONCoordinates;
	metadata: FeatureMetadata;
}

// Full feature with geometry (merged from metadata + TerraDraw)
export interface Feature {
	id: string; // Unique ID for this feature (from TerraDraw)
	type: GeometryType;
	name: string;
	description: string;
	coordinates: GeoJSONCoordinates;
	icon?: IconType;
}

// ============================================================================
// Helper Functions
// ============================================================================

function isValidCoordinates(coords: unknown, type: GeometryType): boolean {
	if (coords === null || coords === undefined) return false;

	if (type === "Point" || type === "Marker") {
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

	if (type === "LineString" || type === "Freehand") {
		if (!Array.isArray(coords) || coords.length < 2) return false;
		return coords.every((coord) => isValidCoordinates(coord, "Point"));
	}

	// Polygon, Rectangle, and Circle all use the same coordinate structure
	if (type === "Polygon" || type === "Rectangle" || type === "Circle") {
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

// ============================================================================
// Actions
// ============================================================================

type FeatureAction =
	| {
			type: "ADD_FEATURE_METADATA";
			payload: { id: string; metadata: FeatureMetadata };
	  }
	| {
			type: "UPDATE_FEATURE_METADATA";
			payload: { id: string; updates: Partial<FeatureMetadata> };
	  }
	| { type: "REMOVE_FEATURE_METADATA"; payload: string }
	| { type: "CLEAR_FEATURES" }
	| { type: "SYNC_FROM_TERRADRAW"; payload: TerraDrawFeature[] }
	| { type: "IMPORT_GEOJSON"; payload: PendingFeature[] }
	| {
			type: "REMAP_FEATURE_IDS";
			payload: Array<{ oldId: string; newId: string }>;
	  }
	| { type: "CLEAR_PENDING_FEATURES" };

interface FeatureState {
	featureMetadata: Map<string, FeatureMetadata>;
	pendingFeatures: PendingFeature[];
}

// ============================================================================
// Reducer
// ============================================================================

function featureReducer(
	state: FeatureState,
	action: FeatureAction,
): FeatureState {
	switch (action.type) {
		case "ADD_FEATURE_METADATA": {
			const newMetadata = new Map(state.featureMetadata);
			newMetadata.set(action.payload.id, action.payload.metadata);
			return {
				...state,
				featureMetadata: newMetadata,
			};
		}

		case "UPDATE_FEATURE_METADATA": {
			const newMetadata = new Map(state.featureMetadata);
			const existing = newMetadata.get(action.payload.id);
			if (existing) {
				newMetadata.set(action.payload.id, {
					...existing,
					...action.payload.updates,
				});
			}
			return {
				...state,
				featureMetadata: newMetadata,
			};
		}

		case "REMOVE_FEATURE_METADATA": {
			const newMetadata = new Map(state.featureMetadata);
			newMetadata.delete(action.payload);
			return {
				...state,
				featureMetadata: newMetadata,
			};
		}

		case "CLEAR_FEATURES":
			return {
				featureMetadata: new Map(),
				pendingFeatures: [],
			};

		case "SYNC_FROM_TERRADRAW": {
			// Create a set of feature IDs that exist in TerraDraw
			const terraDrawIds = new Set(action.payload.map((f) => String(f.id)));

			// Remove metadata for features that no longer exist in TerraDraw (were deleted)
			const newMetadata = new Map(state.featureMetadata);
			for (const featureId of newMetadata.keys()) {
				if (!terraDrawIds.has(featureId)) {
					newMetadata.delete(featureId);
				}
			}

			return { ...state, featureMetadata: newMetadata };
		}

		case "REMAP_FEATURE_IDS": {
			// When pending features are added to TerraDraw, remap their IDs
			const idMap = new Map(
				action.payload.map(({ oldId, newId }) => [oldId, newId]),
			);

			const newMetadata = new Map<string, FeatureMetadata>();

			// Transfer pending feature metadata to featureMetadata with new IDs
			for (const pending of state.pendingFeatures) {
				const newId = idMap.get(pending.id);
				if (newId) {
					newMetadata.set(newId, pending.metadata);
				}
			}

			// Keep existing metadata
			for (const [id, metadata] of state.featureMetadata) {
				newMetadata.set(id, metadata);
			}

			return {
				...state,
				featureMetadata: newMetadata,
				pendingFeatures: [], // Clear pending features after remapping
			};
		}

		case "IMPORT_GEOJSON":
			return {
				...state,
				pendingFeatures: action.payload,
			};

		case "CLEAR_PENDING_FEATURES":
			return { ...state, pendingFeatures: [] };

		default:
			return state;
	}
}

// ============================================================================
// Helper: Merge metadata with TerraDraw snapshot to create full features
// ============================================================================

function mergeFeatures(
	featureMetadata: Map<string, FeatureMetadata>,
	terraDrawSnapshot: TerraDrawFeature[],
): Feature[] {
	const features: Feature[] = [];

	for (const terraFeature of terraDrawSnapshot) {
		const id = String(terraFeature.id);
		const metadata = featureMetadata.get(id);

		// If no metadata exists, skip this feature (it was just drawn but not named yet)
		if (!metadata) continue;

		features.push({
			id,
			type: terraFeature.geometry.type as GeometryType,
			coordinates: terraFeature.geometry.coordinates as GeoJSONCoordinates,
			name: metadata.name,
			description: metadata.description,
			icon: metadata.icon,
		});
	}

	return features;
}

// ============================================================================
// Hook Options
// ============================================================================

export interface UseFeatureManagerOptions {
	initialMetadata?: Map<string, FeatureMetadata>;
	initialPendingFeatures?: PendingFeature[];
	terraDrawSnapshot?: TerraDrawFeature[];
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing feature metadata and pending features.
 * Coordinates are stored in TerraDraw; this manages metadata and syncing.
 */
export function useFeatureManager(options: UseFeatureManagerOptions = {}) {
	const {
		initialMetadata = new Map(),
		initialPendingFeatures = [],
		terraDrawSnapshot,
	} = options;

	const [state, dispatch] = useReducer(featureReducer, {
		featureMetadata: initialMetadata,
		pendingFeatures: initialPendingFeatures,
	});

	// Merge metadata with TerraDraw snapshot to get full features
	const features = terraDrawSnapshot
		? mergeFeatures(state.featureMetadata, terraDrawSnapshot)
		: [];

	const addFeatureMetadata = useCallback(
		(id: string, metadata: FeatureMetadata) => {
			dispatch({ type: "ADD_FEATURE_METADATA", payload: { id, metadata } });
		},
		[],
	);

	const updateFeatureMetadata = useCallback(
		(id: string, updates: Partial<FeatureMetadata>) => {
			dispatch({
				type: "UPDATE_FEATURE_METADATA",
				payload: { id, updates },
			});
		},
		[],
	);

	const removeFeatureMetadata = useCallback((id: string) => {
		dispatch({ type: "REMOVE_FEATURE_METADATA", payload: id });
	}, []);

	const clearFeatures = useCallback(() => {
		dispatch({ type: "CLEAR_FEATURES" });
	}, []);

	const syncFromTerraDraw = useCallback(
		(terraDrawFeatures: TerraDrawFeature[]) => {
			dispatch({ type: "SYNC_FROM_TERRADRAW", payload: terraDrawFeatures });
		},
		[],
	);

	const remapFeatureIds = useCallback(
		(idMappings: Array<{ oldId: string; newId: string }>) => {
			dispatch({ type: "REMAP_FEATURE_IDS", payload: idMappings });
		},
		[],
	);

	const clearPendingFeatures = useCallback(() => {
		dispatch({ type: "CLEAR_PENDING_FEATURES" });
	}, []);

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

				const pendingFeatures: PendingFeature[] = geoJsonData.features
					.map((feature, _index: number) => {
						const geometryType = feature.geometry.type;
						const coordinates = feature.geometry.coordinates;

						// Skip features with invalid coordinates
						if (!isValidCoordinates(coordinates, geometryType)) {
							return null;
						}

						return {
							id: crypto.randomUUID(), // Temporary ID
							type: geometryType,
							coordinates,
							metadata: {
								name: feature.properties?.name || "",
								description: feature.properties?.description || "",
								icon: (feature.properties?.icon as IconType) || "default",
							},
						};
					})
					.filter((f): f is PendingFeature => f !== null);

				if (pendingFeatures.length === 0) {
					return {
						success: false,
						error: "No valid features found in GeoJSON",
					};
				}

				if (pendingFeatures.length < geoJsonData.features.length) {
					// Some features were invalid but we imported what we could
					dispatch({ type: "IMPORT_GEOJSON", payload: pendingFeatures });
					return {
						success: true,
						warning: `Imported ${pendingFeatures.length} of ${geoJsonData.features.length} features (${geoJsonData.features.length - pendingFeatures.length} had invalid coordinates)`,
					};
				}

				dispatch({ type: "IMPORT_GEOJSON", payload: pendingFeatures });
				return { success: true };
			} catch (error: unknown) {
				return { success: false, error: (error as Error).message };
			}
		},
		[],
	);

	return {
		// State
		featureMetadata: state.featureMetadata,
		pendingFeatures: state.pendingFeatures,
		features, // Merged features (metadata + TerraDraw coordinates)

		// Actions
		addFeatureMetadata,
		updateFeatureMetadata,
		removeFeatureMetadata,
		clearFeatures,
		syncFromTerraDraw,
		remapFeatureIds,
		clearPendingFeatures,
		importGeoJson,
	};
}

export type FeatureManagerHook = ReturnType<typeof useFeatureManager>;
