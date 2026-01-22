import { useCallback } from "react";
import type { Layer } from "../../App";
import type { Feature, GeometryType } from "./useFeatureManager";
import type { ValidationResult } from "./useLayerValidation";

// ============================================================================
// Types
// ============================================================================

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

type IconType = "default" | "anchor" | "ship" | "warning" | "circle";

export interface UseLayerBuilderOptions {
	layerName: string;
	category: string;
	description: string;
	layerColor: string;
	editableBy: "creator-only" | "everyone";
	// Style settings
	lineWidth: number;
	fillPolygons: boolean;
	markerIcon: IconType;
	features: Feature[];
	validate: () => ValidationResult;
	currentUserId?: string;
	originalLayerId: string | null;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for building Layer objects from layer metadata and features.
 * Handles GeoJSON generation and Layer construction.
 */
export function useLayerBuilder(options: UseLayerBuilderOptions) {
	const {
		layerName,
		category,
		description,
		layerColor,
		editableBy,
		lineWidth,
		fillPolygons,
		markerIcon,
		features,
		validate,
		currentUserId = "anonymous",
		originalLayerId,
	} = options;

	const buildLayer = useCallback(
		(editingLayerData?: Layer | null): Layer | null => {
			const validation = validate();
			if (!validation.valid) {
				return null;
			}

			const geoJsonFeatures: GeoJSONFeature[] = features.map((feature) => {
				// Map internal feature types to valid GeoJSON geometry types
				// TerraDraw creates Circle, Rectangle, and Freehand as Polygons internally
				let geometryType: string = feature.type;
				if (feature.type === "Marker") {
					geometryType = "Point";
				} else if (
					feature.type === "Circle" ||
					feature.type === "Rectangle" ||
					feature.type === "Freehand"
				) {
					geometryType = "Polygon";
				}

				return {
					type: "Feature" as const,
					properties: {
						name: feature.name,
						description: feature.description,
						featureType: feature.type, // Preserve original type for UI display
					},
					geometry: {
						type: geometryType as GeometryType,
						coordinates: feature.coordinates,
					},
				};
			});

			const layerData: GeoJSONFeatureCollection = {
				type: "FeatureCollection",
				features: geoJsonFeatures,
			};

			return {
				id: originalLayerId || crypto.randomUUID(),
				name: layerName,
				type: "geojson",
				visible: true,
				opacity: editingLayerData?.opacity || 0.7,
				color: layerColor,
				data: layerData,
				legend: {
					type: "categories",
					items: [{ color: layerColor, label: layerName }],
				},
				category: category || undefined,
				description: description || undefined,
				editable: editableBy,
				createdBy: editingLayerData?.createdBy || currentUserId,
				// Style settings at layer level
				lineWidth,
				fillPolygons,
				markerIcon,
			};
		},
		[
			layerName,
			category,
			description,
			layerColor,
			editableBy,
			lineWidth,
			fillPolygons,
			markerIcon,
			features,
			validate,
			currentUserId,
			originalLayerId,
		],
	);

	return {
		buildLayer,
	};
}

export type LayerBuilderHook = ReturnType<typeof useLayerBuilder>;
