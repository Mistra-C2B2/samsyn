import maplibregl from "maplibre-gl";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Layer } from "../App";
import {
	createLoadingSection,
	generateAggregatedPopupHTML,
	type PopupSection,
	updatePopupSection,
} from "../utils/aggregatedPopup";
import { generateFeaturePopupHTML } from "../utils/featurePopup";
import { Legend } from "./Legend";

// TerraDraw is loaded dynamically to avoid bundling issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let TerradrawControlClass: any = null;

// Marker icon SVGs as data URLs for MapLibre
// These are based on Lucide icons and will be rendered as map symbols
const MARKER_ICONS: Record<string, string> = {
	// Default pin marker
	default: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white"/></svg>`,
	// Anchor icon
	anchor: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="21"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>`,
	// Ship icon
	ship: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/></svg>`,
	// Warning triangle
	warning: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13" stroke="white" stroke-width="2"/><circle cx="12" cy="17" r="1" fill="white"/></svg>`,
	// Circle marker
	circle: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="8"/></svg>`,
};

// Helper function to create a colored SVG and convert to ImageData for MapLibre
async function loadSvgAsImage(
	iconSvg: string,
	color: string,
	size: number = 48,
): Promise<ImageData> {
	return new Promise((resolve, reject) => {
		// Replace currentColor with the actual color
		const coloredSvg = iconSvg.replace(/currentColor/g, color);

		// Create an image from the SVG
		const img = new Image();
		img.width = size;
		img.height = size;

		img.onload = () => {
			// Draw to canvas to get ImageData
			const canvas = document.createElement("canvas");
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				reject(new Error("Could not get canvas context"));
				return;
			}
			ctx.drawImage(img, 0, 0, size, size);
			const imageData = ctx.getImageData(0, 0, size, size);
			resolve(imageData);
		};

		img.onerror = (err) => {
			reject(err);
		};

		// Use base64 encoding for better compatibility
		const base64 = btoa(coloredSvg);
		img.src = `data:image/svg+xml;base64,${base64}`;
	});
}

// Helper function to load icon images into the map
// Uses a mutex pattern to prevent concurrent updates causing "already exists" errors
const iconLoadingPromise: { current: Promise<void> | null } = { current: null };

// Helper to create a color-specific icon ID
function getMarkerIconId(iconType: string, color: string): string {
	// Normalize color to create a valid ID (remove # and lowercase)
	const colorKey = color.replace("#", "").toLowerCase();
	return `marker-${iconType}-${colorKey}`;
}

async function loadMarkerIcons(
	map: maplibregl.Map,
	color: string,
): Promise<void> {
	// Wait for any in-progress loading to complete first
	if (iconLoadingPromise.current) {
		await iconLoadingPromise.current;
	}

	const loadIcons = async () => {
		const iconTypes = Object.keys(MARKER_ICONS) as Array<
			keyof typeof MARKER_ICONS
		>;

		for (const iconType of iconTypes) {
			const iconId = getMarkerIconId(iconType, color);
			// Skip if this color variant already exists
			if (map.hasImage(iconId)) {
				continue;
			}

			try {
				const imageData = await loadSvgAsImage(
					MARKER_ICONS[iconType],
					color,
					48,
				);
				// Double-check after async operation
				if (!map.hasImage(iconId)) {
					map.addImage(iconId, imageData, { sdf: false });
				}
			} catch (err) {
				console.warn(`Failed to load marker icon ${iconType}:`, err);
			}
		}
	};

	iconLoadingPromise.current = loadIcons();
	await iconLoadingPromise.current;
	iconLoadingPromise.current = null;
}

// TerraDraw feature type for change events
export interface TerraDrawFeature {
	id: string | number;
	type: "Feature";
	geometry: {
		type: string;
		coordinates: unknown;
	};
	properties: Record<string, unknown>;
}

type MarkerIconType = "default" | "anchor" | "ship" | "warning" | "circle";

// WMS GetFeatureInfo request parameters
export interface WMSFeatureInfoParams {
	wmsUrl: string;
	layers: string;
	bbox: string;
	width: number;
	height: number;
	x: number;
	y: number;
	time?: string;
	version?: "1.1.1" | "1.3.0";
	cqlFilter?: string;
}

// WMS GetFeatureInfo response
export interface WMSFeatureInfoResponse {
	type?: "html" | "text";
	content?: string;
	features?: Array<{
		type: string;
		properties: Record<string, unknown>;
		geometry?: unknown;
	}>;
	[key: string]: unknown;
}

interface MapViewProps {
	center: [number, number];
	zoom: number;
	layers: Layer[];
	basemap: string;
	onDrawComplete?: (feature: unknown) => void;
	onTerraDrawChange?: (features: TerraDrawFeature[]) => void;
	drawingMode?:
		| "Point"
		| "Marker" // For display purposes only - mapped to Point for TerraDraw
		| "LineString"
		| "Polygon"
		| "Rectangle"
		| "Circle"
		| "Freehand"
		| "select"
		| "delete"
		| "delete-selection"
		| null;
	onFeatureClick?: (layerId: string) => void;
	highlightedLayerId?: string | null;
	// For showing marker icons on top of TerraDraw during editing
	markerIcon?: MarkerIconType;
	markerFeatureIds?: Set<string>; // IDs of features that should show as markers
	markerColor?: string;
	// Pass snapshot to trigger overlay updates when features move
	terraDrawSnapshot?: TerraDrawFeature[];
	// WMS GetFeatureInfo callback for queryable layers
	onWMSFeatureInfoRequest?: (
		params: WMSFeatureInfoParams,
	) => Promise<WMSFeatureInfoResponse | null>;
}

export interface DrawingStyles {
	color: string;
	lineWidth: number;
	fillPolygons: boolean;
}

export interface MapViewRef {
	startDrawing: (
		type:
			| "Point"
			| "LineString"
			| "Polygon"
			| "Rectangle"
			| "Circle"
			| "Freehand",
		color?: string,
		isMarker?: boolean,
	) => void;
	setDrawMode: (mode: "select" | "delete" | "delete-selection") => void;
	cancelDrawing: () => void;
	clearDrawings: () => void;
	addFeatures: (
		features: Array<{
			id: string;
			type: "Point" | "LineString" | "Polygon";
			coordinates: unknown;
		}>,
		color?: string,
	) => string[];
	removeFeature: (id: string) => void;
	updateDrawingStyles: (styles: DrawingStyles) => void;
	zoomToBounds: (bounds: [number, number, number, number]) => void;
}

/**
 * Formats WMS GetFeatureInfo response data into styled HTML
 * Handles multiple response formats: HTML, text, GeoJSON features, and raw JSON
 */
const formatFeatureInfoHTML = (
	data: WMSFeatureInfoResponse,
	layerName: string,
): string => {
	// Handle HTML response
	if (data.type === "html" && data.content) {
		return `
			<div style="font-size: 13px; min-width: 150px;">
				<div style="margin-bottom: 4px;">
					<span style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Layer</span>
					<div style="font-weight: 600; color: #1e293b;">${layerName}</div>
				</div>
				<div style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px;">
					<div style="font-size: 12px;">${data.content}</div>
				</div>
			</div>
		`;
	}

	// Handle text response
	if (data.type === "text" && data.content) {
		return `
			<div style="font-size: 13px; min-width: 150px;">
				<div style="margin-bottom: 4px;">
					<span style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Layer</span>
					<div style="font-weight: 600; color: #1e293b;">${layerName}</div>
				</div>
				<div style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px;">
					<pre style="font-size: 12px; white-space: pre-wrap; margin: 0;">${data.content}</pre>
				</div>
			</div>
		`;
	}

	// Handle empty features array (no data at location)
	if (data.features && data.features.length === 0) {
		return `
			<div style="font-size: 13px; min-width: 150px;">
				<div style="margin-bottom: 4px;">
					<span style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Layer</span>
					<div style="font-weight: 600; color: #1e293b;">${layerName}</div>
				</div>
				<div style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px;">
					<div style="font-size: 12px; color: #64748b;">No data at this location</div>
				</div>
			</div>
		`;
	}

	// Handle GeoJSON/JSON response with features
	if (data.features && data.features.length > 0) {
		const feature = data.features[0];
		const props = feature.properties || {};

		// Label mappings for better display
		const labelMap: Record<string, string> = {
			DEFAULT: "Density (hours/km²)",
			time: "Time Period",
			category: "Category",
		};

		// Fields to hide (not useful to display)
		const hideFields = ["category_column"];

		// Build property list
		const propEntries = Object.entries(props)
			.filter(
				([key]) =>
					!key.startsWith("_") &&
					key !== "geometry" &&
					!hideFields.includes(key),
			)
			.slice(0, 10); // Limit to 10 properties

		if (propEntries.length === 0) {
			return `
				<div style="font-size: 13px; min-width: 150px;">
					<div style="margin-bottom: 4px;">
						<span style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Layer</span>
						<div style="font-weight: 600; color: #1e293b;">${layerName}</div>
					</div>
					<div style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px;">
						<div style="font-size: 12px; color: #64748b;">No properties available</div>
					</div>
				</div>
			`;
		}

		const propsHtml = propEntries
			.map(([key, value]) => {
				const label = labelMap[key] || key;
				let displayValue = value ?? "—";

				// Format numeric values
				if (key === "DEFAULT" && typeof value === "string") {
					const num = parseFloat(value);
					if (!isNaN(num)) {
						displayValue = num.toFixed(2);
					}
				}

				// Skip "time" field - we'll show the queried range instead
				if (key === "time") {
					return "";
				}

				return `<tr>
					<td style="padding-right: 8px; color: #64748b;">${label}:</td>
					<td style="font-weight: 500; color: #334155;">${displayValue}</td>
				</tr>`;
			})
			.filter(Boolean)
			.join("");

		return `
			<div style="font-size: 13px; min-width: 150px;">
				<div style="margin-bottom: 4px;">
					<span style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Layer</span>
					<div style="font-weight: 600; color: #1e293b;">${layerName}</div>
				</div>
				<div style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px;">
					<table style="font-size: 12px; width: 100%;">
						<tbody>${propsHtml}</tbody>
					</table>
				</div>
			</div>
		`;
	}

	// Try to parse as raw JSON response (some servers return properties directly)
	const rawProps = Object.entries(data)
		.filter(
			([key]) =>
				!["type", "content", "features", "raw"].includes(key) &&
				!key.startsWith("_"),
		)
		.slice(0, 10);

	if (rawProps.length > 0) {
		const propsHtml = rawProps
			.map(
				([key, value]) =>
					`<tr>
						<td style="padding-right: 8px; color: #64748b;">${key}:</td>
						<td style="font-weight: 500; color: #334155;">${typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</td>
					</tr>`,
			)
			.join("");

		return `
			<div style="font-size: 13px; min-width: 150px;">
				<div style="margin-bottom: 4px;">
					<span style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Layer</span>
					<div style="font-weight: 600; color: #1e293b;">${layerName}</div>
				</div>
				<div style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px;">
					<table style="font-size: 12px; width: 100%;">
						<tbody>${propsHtml}</tbody>
					</table>
				</div>
			</div>
		`;
	}

	return `
		<div style="font-size: 13px; min-width: 150px;">
			<div style="margin-bottom: 4px;">
				<span style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Layer</span>
				<div style="font-weight: 600; color: #1e293b;">${layerName}</div>
			</div>
			<div style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px;">
				<div style="font-size: 12px; color: #64748b;">No data at this location</div>
			</div>
		</div>
	`;
};

export const MapView = forwardRef<MapViewRef, MapViewProps>(
	(
		{
			center,
			zoom,
			layers,
			basemap,
			onDrawComplete,
			onTerraDrawChange,
			drawingMode,
			onFeatureClick,
			highlightedLayerId,
			markerIcon,
			markerFeatureIds,
			markerColor,
			terraDrawSnapshot: markerOverlaySnapshot,
			onWMSFeatureInfoRequest,
		},
		ref,
	) => {
		const mapContainerRef = useRef<HTMLDivElement>(null);
		const mapRef = useRef<maplibregl.Map | null>(null);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const drawRef = useRef<any>(null);
		const onDrawCompleteRef = useRef(onDrawComplete);
		const onTerraDrawChangeRef = useRef(onTerraDrawChange);
		const onFeatureClickRef = useRef(onFeatureClick);
		const onWMSFeatureInfoRequestRef = useRef(onWMSFeatureInfoRequest);
		const currentPopupRef = useRef<maplibregl.Popup | null>(null);
		const initialPropsRef = useRef({ center, zoom, basemap });
		const [mapLoaded, setMapLoaded] = useState(false);
		const mapLoadedRef = useRef(false);
		const previousLayerIdsRef = useRef<Set<string>>(new Set());
		// Track previous layer state for efficient updates (only recreate when data changes)
		const previousLayerStateRef = useRef<
			Map<string, { visible: boolean; opacity: number; dataHash: string }>
		>(new Map());

		// Keep the refs updated with the latest callbacks
		useEffect(() => {
			onDrawCompleteRef.current = onDrawComplete;
		}, [onDrawComplete]);

		useEffect(() => {
			onTerraDrawChangeRef.current = onTerraDrawChange;
		}, [onTerraDrawChange]);

		useEffect(() => {
			onFeatureClickRef.current = onFeatureClick;
		}, [onFeatureClick]);

		useEffect(() => {
			onWMSFeatureInfoRequestRef.current = onWMSFeatureInfoRequest;
		}, [onWMSFeatureInfoRequest]);

		useImperativeHandle(ref, () => ({
			startDrawing: (
				type:
					| "Point"
					| "LineString"
					| "Polygon"
					| "Rectangle"
					| "Circle"
					| "Freehand",
				color?: string,
				isMarker?: boolean,
			) => {
				if (!drawRef.current || !mapLoaded) return;

				const terraDraw = drawRef.current.getTerraDrawInstance();
				if (!terraDraw) return;

				// Enable TerraDraw if not already enabled (must be done before updating styles)
				if (!terraDraw.enabled) {
					terraDraw.start();
				}

				// Update styles with the selected color if provided
				if (color) {
					try {
						// Update point style - make transparent if drawing markers
						// Markers use point mode but display via icon overlay instead
						terraDraw.updateModeOptions("point", {
							styles: {
								pointColor: isMarker ? "transparent" : color,
								pointOutlineColor: "transparent",
								pointOutlineWidth: 0,
							},
						});
						// Update linestring style
						terraDraw.updateModeOptions("linestring", {
							styles: {
								lineStringColor: color,
								lineStringWidth: 3,
								closingPointColor: color,
								closingPointOutlineColor: "transparent",
							},
						});
						// Update polygon style
						terraDraw.updateModeOptions("polygon", {
							styles: {
								fillColor: color,
								fillOpacity: 0.3,
								outlineColor: color,
								outlineWidth: 2,
								closingPointColor: color,
								closingPointOutlineColor: "transparent",
							},
						});
						// Update rectangle style
						terraDraw.updateModeOptions("rectangle", {
							styles: {
								fillColor: color,
								fillOpacity: 0.3,
								outlineColor: color,
								outlineWidth: 2,
							},
						});
						// Update circle style
						terraDraw.updateModeOptions("circle", {
							styles: {
								fillColor: color,
								fillOpacity: 0.3,
								outlineColor: color,
								outlineWidth: 2,
							},
						});
						// Update freehand style
						terraDraw.updateModeOptions("freehand", {
							styles: {
								fillColor: color,
								fillOpacity: 0.3,
								outlineColor: color,
								outlineWidth: 2,
							},
						});
					} catch (err) {
						console.warn("Failed to update drawing styles:", err);
					}
				}

				// Don't clear existing features - allow users to draw multiple features
				// Features will be cleared when the layer is created or drawing is cancelled

				// Start drawing based on type
				if (type === "Point") {
					terraDraw.setMode("point");
				} else if (type === "LineString") {
					terraDraw.setMode("linestring");
				} else if (type === "Polygon") {
					terraDraw.setMode("polygon");
				} else if (type === "Rectangle") {
					terraDraw.setMode("rectangle");
				} else if (type === "Circle") {
					terraDraw.setMode("circle");
				} else if (type === "Freehand") {
					terraDraw.setMode("freehand");
				}
			},
			setDrawMode: (mode: "select" | "delete" | "delete-selection") => {
				if (!drawRef.current || !mapLoaded) return;

				const terraDraw = drawRef.current.getTerraDrawInstance();
				if (!terraDraw) return;

				// Enable TerraDraw if not already enabled
				if (!terraDraw.enabled) {
					terraDraw.start();
				}

				// Handle delete-selection as an action, not a mode
				if (mode === "delete-selection") {
					// Get all selected features and delete them
					const snapshot = terraDraw.getSnapshot();
					const selectedIds = snapshot
						.filter((f) => f.properties?.selected === true)
						.map((f) => String(f.id));

					if (selectedIds.length > 0) {
						terraDraw.removeFeatures(selectedIds);
					}
					// Stay in select mode after deletion
					terraDraw.setMode("select");
				} else {
					terraDraw.setMode(mode);
				}
			},
			cancelDrawing: () => {
				if (drawRef.current && mapLoaded) {
					const terraDraw = drawRef.current.getTerraDrawInstance();
					if (terraDraw) {
						terraDraw.setMode("select");
						const snapshot = terraDraw.getSnapshot();
						if (snapshot.length > 0) {
							terraDraw.clear();
						}
					}
				}
			},
			clearDrawings: () => {
				if (drawRef.current && mapLoaded) {
					const terraDraw = drawRef.current.getTerraDrawInstance();
					if (terraDraw) {
						terraDraw.setMode("select");
						const snapshot = terraDraw.getSnapshot();
						if (snapshot.length > 0) {
							terraDraw.clear();
						}
					}
				}
			},
			addFeatures: (features, color) => {
				if (!drawRef.current || !mapLoaded) return [];

				const terraDraw = drawRef.current.getTerraDrawInstance();
				if (!terraDraw) return [];

				// Enable TerraDraw if not already enabled
				if (!terraDraw.enabled) {
					terraDraw.start();
				}

				// Update styles with the provided color
				if (color) {
					try {
						terraDraw.updateModeOptions("point", {
							styles: {
								pointColor: color,
								pointOutlineColor: "transparent",
								pointOutlineWidth: 0,
							},
						});
						terraDraw.updateModeOptions("linestring", {
							styles: {
								lineStringColor: color,
								lineStringWidth: 3,
								closingPointColor: color,
								closingPointOutlineColor: "transparent",
							},
						});
						terraDraw.updateModeOptions("polygon", {
							styles: {
								fillColor: color,
								fillOpacity: 0.3,
								outlineColor: color,
								outlineWidth: 2,
								closingPointColor: color,
								closingPointOutlineColor: "transparent",
							},
						});
					} catch (err) {
						console.warn("Failed to update drawing styles:", err);
					}
				}

				const addedIds: string[] = [];

				// Add each feature to TerraDraw
				for (const feature of features) {
					try {
						// Map geometry type to TerraDraw mode name
						// Note: Marker uses Point geometry in GeoJSON/TerraDraw but has different rendering
						// Circle, Rectangle, and Freehand use Polygon geometry but different TerraDraw modes
						const modeMap: Record<string, string> = {
							Point: "point",
							Marker: "point", // Markers use point mode in TerraDraw
							LineString: "linestring",
							Polygon: "polygon",
							Circle: "circle",
							Rectangle: "rectangle",
							Freehand: "freehand",
						};
						const mode = modeMap[feature.type] || feature.type.toLowerCase();

						// Create a GeoJSON feature to add
						// Map internal types to valid GeoJSON geometry types
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

						const geoJsonFeature = {
							type: "Feature" as const,
							properties: {
								mode, // TerraDraw requires a mode property
							},
							geometry: {
								type: geometryType,
								coordinates: feature.coordinates,
							},
						};

						// Use TerraDraw's addFeatures method
						const ids = terraDraw.addFeatures([geoJsonFeature]);
						if (ids && ids.length > 0) {
							const idValue =
								typeof ids[0] === "object" && ids[0] !== null && "id" in ids[0]
									? String((ids[0] as { id: unknown }).id)
									: String(ids[0]);
							addedIds.push(idValue);
						}
					} catch (err) {
						console.warn("Failed to add feature to TerraDraw:", err);
					}
				}

				// Set to select mode so user can interact with features
				terraDraw.setMode("select");

				// Notify parent of the new snapshot after adding features
				if (onTerraDrawChangeRef.current) {
					const snapshot = terraDraw.getSnapshot();
					onTerraDrawChangeRef.current(snapshot as TerraDrawFeature[]);
				}

				return addedIds;
			},
			removeFeature: (id: string) => {
				if (!drawRef.current || !mapLoaded) return;

				const terraDraw = drawRef.current.getTerraDrawInstance();
				if (!terraDraw) return;

				try {
					const snapshotBefore = terraDraw.getSnapshot();

					// If the feature is selected, deselect it first
					const featureToRemove = snapshotBefore.find(
						(f) => String(f.id) === id,
					);
					if (featureToRemove?.properties?.selected) {
						terraDraw.deselectFeature(id);
					}

					// Check if this is the only feature - if so, use clear() instead
					// because removeFeatures() doesn't properly trigger visual updates in TerraDraw
					if (snapshotBefore.length === 1) {
						terraDraw.clear();
						terraDraw.setMode("select");
					} else {
						terraDraw.removeFeatures([id]);
						terraDraw.setMode("select");
					}

					// Notify parent of the updated snapshot after removing the feature
					if (onTerraDrawChangeRef.current) {
						const snapshot = terraDraw.getSnapshot();
						onTerraDrawChangeRef.current(snapshot as TerraDrawFeature[]);
					}
				} catch (err) {
					console.warn("Failed to remove feature from TerraDraw:", err);
				}
			},
			updateDrawingStyles: (styles: DrawingStyles) => {
				if (!drawRef.current || !mapLoaded) return;

				const terraDraw = drawRef.current.getTerraDrawInstance();
				if (!terraDraw) return;

				const { color, lineWidth, fillPolygons } = styles;
				const fillOpacity = fillPolygons ? 0.3 : 0;

				try {
					// Update point style - keep transparent if drawing markers
					// Markers use point mode but display via icon overlay instead
					const isMarkerMode = drawingMode === "Marker";
					terraDraw.updateModeOptions("point", {
						styles: {
							pointColor: isMarkerMode ? "transparent" : color,
							pointOutlineColor: "transparent",
							pointOutlineWidth: 0,
						},
					});
					// Update linestring style
					terraDraw.updateModeOptions("linestring", {
						styles: {
							lineStringColor: color,
							lineStringWidth: lineWidth,
							closingPointColor: color,
							closingPointOutlineColor: "transparent",
						},
					});
					// Update polygon style
					terraDraw.updateModeOptions("polygon", {
						styles: {
							fillColor: color,
							fillOpacity,
							outlineColor: color,
							outlineWidth: lineWidth,
							closingPointColor: color,
							closingPointOutlineColor: "transparent",
						},
					});
					// Update rectangle style
					terraDraw.updateModeOptions("rectangle", {
						styles: {
							fillColor: color,
							fillOpacity,
							outlineColor: color,
							outlineWidth: lineWidth,
						},
					});
					// Update circle style
					terraDraw.updateModeOptions("circle", {
						styles: {
							fillColor: color,
							fillOpacity,
							outlineColor: color,
							outlineWidth: lineWidth,
						},
					});
					// Update freehand style
					terraDraw.updateModeOptions("freehand", {
						styles: {
							fillColor: color,
							fillOpacity,
							outlineColor: color,
							outlineWidth: lineWidth,
						},
					});
					// Update select mode styling for existing features
					terraDraw.updateModeOptions("select", {
						styles: {
							selectedPolygonColor: color,
							selectedPolygonFillOpacity: fillOpacity,
							selectedPolygonOutlineColor: color,
							selectedPolygonOutlineWidth: lineWidth,
							selectedLineStringColor: color,
							selectedLineStringWidth: lineWidth,
							selectedPointColor: isMarkerMode ? "transparent" : color,
							selectedPointOutlineColor: "transparent",
							selectionPolygonFillOpacity: 0.1,
							selectionPolygonOutlineColor: color,
						},
					});

					// Note: TerraDraw doesn't support updating styles of existing features
					// without clearing and re-adding them (which causes flicker).
					// New features will use the updated styles, and when saved,
					// the layer will store the final style settings.
				} catch (err) {
					console.warn("Failed to update drawing styles:", err);
				}
			},
			panToCoordinates: (coordinates: unknown, geometryType: string) => {
				if (!mapRef.current || !mapLoaded) return;

				const map = mapRef.current;

				try {
					// Handle different geometry types
					if (geometryType === "Point" || geometryType === "Marker") {
						// Point: [lng, lat]
						const coords = coordinates as [number, number];
						map.flyTo({
							center: coords,
							zoom: Math.max(map.getZoom(), 12),
							duration: 1000,
						});
					} else if (
						geometryType === "LineString" ||
						geometryType === "Freehand"
					) {
						// LineString: [[lng, lat], ...]
						const coords = coordinates as [number, number][];
						const bounds = new maplibregl.LngLatBounds();
						for (const coord of coords) {
							bounds.extend(coord);
						}
						map.fitBounds(bounds, {
							padding: 100,
							maxZoom: 14,
							duration: 1000,
						});
					} else if (
						geometryType === "Polygon" ||
						geometryType === "Rectangle" ||
						geometryType === "Circle"
					) {
						// Polygon: [[[lng, lat], ...], ...]
						const coords = coordinates as [number, number][][];
						const bounds = new maplibregl.LngLatBounds();
						for (const ring of coords) {
							for (const coord of ring) {
								bounds.extend(coord);
							}
						}
						map.fitBounds(bounds, {
							padding: 100,
							maxZoom: 14,
							duration: 1000,
						});
					}
				} catch (err) {
					console.warn("Failed to pan to coordinates:", err);
				}
			},
			selectFeature: (featureId: string) => {
				if (!drawRef.current || !mapLoaded) return;

				const terraDraw = drawRef.current.getTerraDrawInstance();
				if (!terraDraw) return;

				try {
					// First deselect any currently selected features
					const snapshot = terraDraw.getSnapshot();
					for (const f of snapshot) {
						if (f.properties?.selected === true) {
							terraDraw.deselectFeature(String(f.id));
						}
					}

					// Select the specified feature
					terraDraw.selectFeature(featureId);

					// Notify parent of the updated snapshot
					if (onTerraDrawChangeRef.current) {
						const newSnapshot = terraDraw.getSnapshot();
						onTerraDrawChangeRef.current(newSnapshot as TerraDrawFeature[]);
					}
				} catch (err) {
					console.warn("Failed to select feature:", err);
				}
			},
			zoomToBounds: (bounds: [number, number, number, number]) => {
				if (!mapRef.current || !mapLoaded) return;

				const map = mapRef.current;
				const [west, south, east, north] = bounds;

				try {
					map.fitBounds(
						[
							[west, south],
							[east, north],
						],
						{
							padding: 50,
							maxZoom: 14,
							duration: 1000,
						},
					);
				} catch (err) {
					console.warn("Failed to zoom to bounds:", err);
				}
			},
		}));

		useEffect(() => {
			if (!mapContainerRef.current || mapRef.current) return;

			// Create basemap style based on basemap prop
			const getBasemapStyle = (
				basemapType: string,
			): maplibregl.StyleSpecification => {
				// Use raster tile sources for better compatibility
				const rasterStyles: Record<string, maplibregl.StyleSpecification> = {
					osm: {
						version: 8,
						sources: {
							osm: {
								type: "raster",
								tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
								tileSize: 256,
								attribution: "&copy; OpenStreetMap contributors",
							},
						},
						layers: [
							{
								id: "osm",
								type: "raster",
								source: "osm",
							},
						],
					},
					"carto-light": {
						version: 8,
						sources: {
							carto: {
								type: "raster",
								tiles: [
									"https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
								],
								tileSize: 256,
								attribution: "&copy; CARTO",
							},
						},
						layers: [
							{
								id: "carto",
								type: "raster",
								source: "carto",
							},
						],
					},
					"carto-dark": {
						version: 8,
						sources: {
							carto: {
								type: "raster",
								tiles: [
									"https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
								],
								tileSize: 256,
								attribution: "&copy; CARTO",
							},
						},
						layers: [
							{
								id: "carto",
								type: "raster",
								source: "carto",
							},
						],
					},
					voyager: {
						version: 8,
						sources: {
							carto: {
								type: "raster",
								tiles: [
									"https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
								],
								tileSize: 256,
								attribution: "&copy; CARTO, &copy; OpenStreetMap contributors",
							},
						},
						layers: [
							{
								id: "carto",
								type: "raster",
								source: "carto",
							},
						],
					},
				};

				return rasterStyles[basemapType] || rasterStyles.osm;
			};

			const {
				center: initCenter,
				zoom: initZoom,
				basemap: initBasemap,
			} = initialPropsRef.current;

			// GFW API configuration for transformRequest
			const GFW_API_BASE = "https://gateway.api.globalfishingwatch.org";
			const GFW_API_TOKEN = import.meta.env.VITE_GFW_API_TOKEN;

			// Debug: Log if GFW token is loaded
			if (!GFW_API_TOKEN) {
				console.warn(
					"GFW API token not found. Set VITE_GFW_API_TOKEN in .env.local and restart dev server.",
				);
			}

			const map = new maplibregl.Map({
				container: mapContainerRef.current,
				style: getBasemapStyle(initBasemap),
				center: [initCenter[1], initCenter[0]], // uses [lng, lat]
				zoom: initZoom - 1,
				attributionControl: false, // Disable default attribution
				// Add Authorization header for GFW API tile requests
				transformRequest: (url: string) => {
					if (url.startsWith(GFW_API_BASE)) {
						if (!GFW_API_TOKEN) {
							console.error("GFW API request without token:", url);
							return { url };
						}
						return {
							url,
							headers: {
								Authorization: `Bearer ${GFW_API_TOKEN}`,
							},
						};
					}
					return { url };
				},
			});

			// Add attribution control to bottom-left
			map.addControl(new maplibregl.AttributionControl(), "bottom-left");

			const initializeDrawControl = async () => {
				if (mapLoadedRef.current) return; // Already initialized
				mapLoadedRef.current = true;
				setMapLoaded(true);

				try {
					// Dynamically import TerraDraw to avoid bundling issues
					if (!TerradrawControlClass) {
						const module = await import("@watergis/maplibre-gl-terradraw");
						TerradrawControlClass = module.MaplibreTerradrawControl;
						// @ts-expect-error dynamic CSS import
						await import(
							"@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css"
						);
					}

					// Initialize terradraw control after map style is loaded
					const draw = new TerradrawControlClass({
						modes: [
							"point",
							"linestring",
							"polygon",
							"rectangle",
							"circle",
							"freehand",
							"select",
							"delete",
							"delete-selection",
						],
						open: false,
					});

					map.addControl(draw, "top-right");
					drawRef.current = draw;

					// Handle draw events via TerraDraw instance
					const terraDraw = draw.getTerraDrawInstance();
					if (terraDraw) {
						terraDraw.on("finish", (id: string | number) => {
							if (onDrawCompleteRef.current) {
								const snapshot = terraDraw.getSnapshot();
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								const feature = snapshot.find((f: any) => f.id === id);
								if (feature) {
									onDrawCompleteRef.current(feature);
									// Don't clear here - keep the drawing visible until the layer is created
									// The drawing will be cleared when startDrawing is called again or when cancelDrawing is called
								}
							}
						});

						// Listen for changes (modifications, deletions, selections)
						terraDraw.on("change", () => {
							if (onTerraDrawChangeRef.current) {
								const snapshot = terraDraw.getSnapshot();
								onTerraDrawChangeRef.current(snapshot as TerraDrawFeature[]);
							}
						});
					}
				} catch (error) {
					console.error("Failed to load TerraDraw:", error);
				}
			};

			// Listen for map load event
			map.on("load", initializeDrawControl);

			// Fallback: poll for style loaded state in case load event is missed
			const checkLoaded = () => {
				if (map.isStyleLoaded() && !mapLoadedRef.current) {
					initializeDrawControl();
				}
			};

			const timeoutId = setTimeout(checkLoaded, 100);
			const intervalId = setInterval(() => {
				if (mapLoadedRef.current) {
					clearInterval(intervalId);
				} else {
					checkLoaded();
				}
			}, 500);

			mapRef.current = map;
			// Expose map globally for debugging/testing
			(window as unknown as { map: maplibregl.Map }).map = map;

			return () => {
				clearTimeout(timeoutId);
				clearInterval(intervalId);
				map.remove();
				mapRef.current = null;
				drawRef.current = null;
			};
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, []);

		// Handle center/zoom changes when switching maps
		useEffect(() => {
			if (!mapRef.current || !mapLoaded) return;

			const map = mapRef.current;
			map.setCenter([center[1], center[0]]);
			map.setZoom(zoom - 1);
		}, [center, zoom, mapLoaded]);

		// Handle basemap changes
		useEffect(() => {
			if (!mapRef.current || !mapLoaded) return;

			const map = mapRef.current;

			// Use raster tile sources for better compatibility
			const getBasemapStyle = (
				basemapType: string,
			): maplibregl.StyleSpecification => {
				const rasterStyles: Record<string, maplibregl.StyleSpecification> = {
					osm: {
						version: 8,
						sources: {
							osm: {
								type: "raster",
								tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
								tileSize: 256,
								attribution: "&copy; OpenStreetMap contributors",
							},
						},
						layers: [{ id: "osm", type: "raster", source: "osm" }],
					},
					"carto-light": {
						version: 8,
						sources: {
							carto: {
								type: "raster",
								tiles: [
									"https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
								],
								tileSize: 256,
								attribution: "&copy; CARTO",
							},
						},
						layers: [{ id: "carto", type: "raster", source: "carto" }],
					},
					"carto-dark": {
						version: 8,
						sources: {
							carto: {
								type: "raster",
								tiles: [
									"https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
								],
								tileSize: 256,
								attribution: "&copy; CARTO",
							},
						},
						layers: [{ id: "carto", type: "raster", source: "carto" }],
					},
					voyager: {
						version: 8,
						sources: {
							carto: {
								type: "raster",
								tiles: [
									"https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
								],
								tileSize: 256,
								attribution: "&copy; CARTO, &copy; OpenStreetMap contributors",
							},
						},
						layers: [{ id: "carto", type: "raster", source: "carto" }],
					},
				};

				return rasterStyles[basemapType] || rasterStyles.osm;
			};

			// Remove existing terradraw control before style change
			if (drawRef.current) {
				map.removeControl(drawRef.current);
				drawRef.current = null;
			}

			map.setStyle(getBasemapStyle(basemap));

			// Wait for style to load before re-adding layers and terradraw
			map.once("style.load", async () => {
				setMapLoaded(true);

				// Re-add terradraw control after style change (class should already be loaded)
				if (TerradrawControlClass) {
					const draw = new TerradrawControlClass({
						modes: [
							"point",
							"linestring",
							"polygon",
							"rectangle",
							"circle",
							"freehand",
							"select",
							"delete",
						],
						open: false,
					});

					map.addControl(draw, "top-right");
					drawRef.current = draw;

					// Re-attach draw event handler
					const terraDraw = draw.getTerraDrawInstance();
					if (terraDraw) {
						terraDraw.on("finish", (id: string | number) => {
							if (onDrawCompleteRef.current) {
								const snapshot = terraDraw.getSnapshot();
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								const feature = snapshot.find((f: any) => f.id === id);
								if (feature) {
									onDrawCompleteRef.current(feature);
									// Don't clear here - keep the drawing visible until the layer is created
								}
							}
						});
					}
				}
			});
		}, [basemap, mapLoaded]);

		useEffect(() => {
			if (!mapRef.current || !mapLoaded) return;

			const map = mapRef.current;
			const currentLayerIds = new Set(layers.map((l) => l.id));
			const previousLayerIds = previousLayerIdsRef.current;
			const previousLayerState = previousLayerStateRef.current;

			// Helper to create a simple hash of layer data for comparison
			const getDataHash = (layer: Layer): string => {
				// For GFW layers, include the date range in the hash
				if (layer.gfw4WingsDataset) {
					return `gfw-${layer.gfw4WingsDataset}-${layer.gfw4WingsInterval}-${layer.gfw4WingsDateRange?.start}-${layer.gfw4WingsDateRange?.end}`;
				}
				// For WMS layers, include time dimension, style, version, and CQL filter in the hash
				if (layer.wmsUrl) {
					const timeHash = layer.wmsTimeDimension?.current || "";
					const styleHash = layer.wmsStyle || "";
					const versionHash = layer.wmsVersion || "1.3.0";
					const cqlHash = layer.wmsCqlFilter || "";
					return `wms-${layer.wmsUrl}-${layer.wmsLayerName}-${timeHash}-${styleHash}-${versionHash}-${cqlHash}`;
				}
				if (!layer.data) return "";
				return JSON.stringify(layer.data);
			};

			// Helper function to remove a layer and its source from the map
			const removeLayerFromMap = (layerId: string) => {
				const layerVariations = [
					`${layerId}-fill`,
					`${layerId}-line`,
					`${layerId}-line-solid`,
					`${layerId}-line-dashed`,
					`${layerId}-line-dotted`,
					`${layerId}-circle`,
					`${layerId}-symbol`,
					`${layerId}-marker`,
					`${layerId}-raster`,
				];

				layerVariations.forEach((id) => {
					if (map.getLayer(id)) {
						map.removeLayer(id);
					}
				});

				if (map.getSource(layerId)) {
					map.removeSource(layerId);
				}

				// Clean up state tracking
				previousLayerState.delete(layerId);
			};

			// Helper to update opacity for existing layers
			const updateLayerOpacity = (
				layerId: string,
				opacity: number,
				layerType?: string,
			) => {
				const fillLayerId = `${layerId}-fill`;
				const lineLayerId = `${layerId}-line`;
				const circleLayerId = `${layerId}-circle`;
				const rasterLayerId = `${layerId}-raster`;

				if (map.getLayer(fillLayerId)) {
					map.setPaintProperty(fillLayerId, "fill-opacity", opacity);
				}
				if (map.getLayer(lineLayerId)) {
					map.setPaintProperty(lineLayerId, "line-opacity", opacity);
				}
				if (map.getLayer(circleLayerId)) {
					// Heatmap circles use different opacity calculation
					const circleOpacity =
						layerType === "heatmap" ? opacity * 0.6 : opacity;
					map.setPaintProperty(circleLayerId, "circle-opacity", circleOpacity);
				}
				if (map.getLayer(rasterLayerId)) {
					map.setPaintProperty(rasterLayerId, "raster-opacity", opacity);
				}
			};

			// Remove layers that are no longer in the layers array (were removed)
			previousLayerIds.forEach((layerId) => {
				if (!currentLayerIds.has(layerId)) {
					removeLayerFromMap(layerId);
				}
			});

			// Update the ref with current layer IDs
			previousLayerIdsRef.current = currentLayerIds;

			// Process each layer - update existing or add new
			layers.forEach((layer) => {
				const currentDataHash = getDataHash(layer);
				const prevState = previousLayerState.get(layer.id);
				const layerExistsOnMap = map.getSource(layer.id) !== undefined;

				// Handle visibility changes
				if (!layer.visible) {
					// If layer was visible before, remove it
					if (prevState?.visible) {
						removeLayerFromMap(layer.id);
					}
					// Update state to track visibility
					previousLayerState.set(layer.id, {
						visible: false,
						opacity: layer.opacity,
						dataHash: currentDataHash,
					});
					return;
				}

				// Layer is visible - check if we can just update opacity or need to recreate
				if (layerExistsOnMap && prevState) {
					// Layer exists - check if only opacity changed (data is same)
					if (prevState.dataHash === currentDataHash && prevState.visible) {
						// Only opacity changed - just update paint properties
						if (prevState.opacity !== layer.opacity) {
							updateLayerOpacity(layer.id, layer.opacity, layer.type);
							previousLayerState.set(layer.id, {
								visible: true,
								opacity: layer.opacity,
								dataHash: currentDataHash,
							});
						}
						return;
					}
					// Data changed or visibility changed from false to true - need to recreate
					removeLayerFromMap(layer.id);
				}

				// Create new layer
				if (layer.type === "geojson" && layer.data) {
					map.addSource(layer.id, {
						type: "geojson",
						data: layer.data,
					});

					// Opacity is already in 0-1 range from the frontend layer state
					const normalizedOpacity = layer.opacity;

					// Determine fill color based on intensity or use layer color
					const firstFeature = layer.data.features?.[0];
					const intensity = firstFeature?.properties?.intensity;
					let fillColor = layer.color || "#3388ff";

					if (intensity === "high") fillColor = "#d73027";
					else if (intensity === "medium") fillColor = "#fee08b";
					else if (intensity === "low") fillColor = "#1a9850";

					// Get layer-level style settings (with defaults)
					const layerLineWidth = layer.lineWidth ?? 2;
					const layerFillPolygons = layer.fillPolygons ?? true;

					// Add polygon fills (respect fillPolygons setting)
					map.addLayer({
						id: `${layer.id}-fill`,
						type: "fill",
						source: layer.id,
						filter: ["==", ["geometry-type"], "Polygon"],
						paint: {
							"fill-color": fillColor,
							"fill-opacity": layerFillPolygons ? normalizedOpacity : 0,
						},
					});

					// Add line layer with layer-level style
					map.addLayer({
						id: `${layer.id}-line`,
						type: "line",
						source: layer.id,
						filter: [
							"in",
							["geometry-type"],
							["literal", ["Polygon", "LineString"]],
						],
						paint: {
							"line-color": fillColor,
							"line-width": layerLineWidth,
							"line-opacity": normalizedOpacity,
						},
					});

					// Add circle layer for Points (not Markers)
					map.addLayer({
						id: `${layer.id}-circle`,
						type: "circle",
						source: layer.id,
						filter: [
							"all",
							["==", ["geometry-type"], "Point"],
							["!=", ["get", "featureType"], "Marker"],
						],
						paint: {
							"circle-radius": 8,
							"circle-color": fillColor,
							"circle-opacity": normalizedOpacity,
							"circle-stroke-width": 0,
							"circle-stroke-color": "transparent",
						},
					});

					// Add symbol layer for Markers with icon support
					// First, load the marker icons for this layer's color
					const markerIconType = layer.markerIcon || "default";
					const markerIconId = getMarkerIconId(markerIconType, fillColor);

					// Load icons asynchronously
					loadMarkerIcons(map, fillColor).then(() => {
						// Only add symbol layer if icons loaded successfully
						if (map.hasImage(markerIconId)) {
							// Check if layer still exists (might have been removed during async load)
							if (!map.getLayer(`${layer.id}-marker`)) {
								map.addLayer({
									id: `${layer.id}-marker`,
									type: "symbol",
									source: layer.id,
									filter: [
										"all",
										["==", ["geometry-type"], "Point"],
										["==", ["get", "featureType"], "Marker"],
									],
									layout: {
										"icon-image": markerIconId,
										"icon-size": 1.2,
										"icon-anchor":
											markerIconType === "default" ? "bottom" : "center",
										"icon-allow-overlap": true,
									},
									paint: {
										"icon-opacity": normalizedOpacity,
									},
								});

								// Change cursor on hover for markers
								map.on("mouseenter", `${layer.id}-marker`, () => {
									map.getCanvas().style.cursor = "pointer";
								});
								map.on("mouseleave", `${layer.id}-marker`, () => {
									map.getCanvas().style.cursor = "";
								});
							}
						}
					});

					// Change cursor on hover
					map.on("mouseenter", `${layer.id}-fill`, () => {
						map.getCanvas().style.cursor = "pointer";
					});
					map.on("mouseleave", `${layer.id}-fill`, () => {
						map.getCanvas().style.cursor = "";
					});
					map.on("mouseenter", `${layer.id}-circle`, () => {
						map.getCanvas().style.cursor = "pointer";
					});
					map.on("mouseleave", `${layer.id}-circle`, () => {
						map.getCanvas().style.cursor = "";
					});

					// Track state for this layer
					previousLayerState.set(layer.id, {
						visible: true,
						opacity: layer.opacity,
						dataHash: currentDataHash,
					});
				} else if (layer.type === "heatmap" && layer.data) {
					// Opacity is already in 0-1 range from the frontend layer state
					const heatmapOpacity = layer.opacity;

					const features = layer.data.map((point: unknown) => {
						const p = point as Record<string, unknown>;
						return {
							type: "Feature",
							geometry: {
								type: "Point",
								coordinates: [p.lng, p.lat],
							},
							properties: {
								intensity: p.intensity,
							},
						};
					});

					map.addSource(layer.id, {
						type: "geojson",
						data: {
							type: "FeatureCollection",
							features,
						},
					});

					map.addLayer({
						id: `${layer.id}-circle`,
						type: "circle",
						source: layer.id,
						paint: {
							"circle-radius": 30,
							"circle-color": [
								"interpolate",
								["linear"],
								["get", "intensity"],
								0,
								"#fee5d9",
								0.5,
								"#fcae91",
								1,
								"#fb6a4a",
							],
							"circle-opacity": heatmapOpacity * 0.6,
						},
					});

					// Track state for this layer
					previousLayerState.set(layer.id, {
						visible: true,
						opacity: layer.opacity,
						dataHash: currentDataHash,
					});
				} else if (
					layer.type === "raster" &&
					layer.wmsUrl &&
					layer.wmsLayerName
				) {
					// WMS layer rendering with version-specific parameters
					const wmsBaseUrl = layer.wmsUrl.replace(/\/$/, ""); // Remove trailing slash
					const wmsVersion = layer.wmsVersion || "1.3.0"; // Default to 1.3.0

					// Build WMS parameters based on version
					// WMS 1.1.1 uses SRS, WMS 1.3.0 uses CRS
					const wmsParams = new URLSearchParams({
						SERVICE: "WMS",
						VERSION: wmsVersion,
						REQUEST: "GetMap",
						LAYERS: layer.wmsLayerName,
						STYLES: layer.wmsStyle || "", // Use selected style or default
						FORMAT: "image/png",
						TRANSPARENT: "true",
						WIDTH: "256",
						HEIGHT: "256",
					});

					// Set coordinate reference system parameter based on WMS version
					if (wmsVersion === "1.1.1") {
						wmsParams.set("SRS", "EPSG:3857");
					} else {
						wmsParams.set("CRS", "EPSG:3857");
					}

					// Add TIME parameter if layer has temporal dimension with current value
					if (layer.wmsTimeDimension?.current) {
						wmsParams.set("TIME", layer.wmsTimeDimension.current);
					}

					// Add CQL_FILTER if specified (GeoServer/MapServer vendor extension)
					if (layer.wmsCqlFilter) {
						wmsParams.set("CQL_FILTER", layer.wmsCqlFilter);
					}

					// MapLibre expects {bbox-epsg-3857} placeholder for WMS tile requests
					const tileUrlTemplate = `${wmsBaseUrl}?${wmsParams.toString()}&BBOX={bbox-epsg-3857}`;

					// Add WMS as a raster tile source
					map.addSource(layer.id, {
						type: "raster",
						tiles: [tileUrlTemplate],
						tileSize: 256,
					});

					// Add raster layer
					map.addLayer({
						id: `${layer.id}-raster`,
						type: "raster",
						source: layer.id,
						paint: {
							"raster-opacity": layer.opacity,
						},
					});

					// Track state for this layer (include time, style, version, CQL filter in hash for change detection)
					const wmsTimeHash = layer.wmsTimeDimension?.current || "";
					const wmsStyleHash = layer.wmsStyle || "";
					const wmsVersionHash = layer.wmsVersion || "1.3.0";
					const wmsCqlHash = layer.wmsCqlFilter || "";
					previousLayerState.set(layer.id, {
						visible: true,
						opacity: layer.opacity,
						dataHash: `wms-${layer.wmsUrl}-${layer.wmsLayerName}-${wmsTimeHash}-${wmsStyleHash}-${wmsVersionHash}-${wmsCqlHash}`,
					});
				} else if (layer.gfw4WingsDataset) {
					// GFW 4Wings layer rendering using MVT (vector tiles)
					const dataset = layer.gfw4WingsDataset;
					const interval = layer.gfw4WingsInterval || "YEAR";
					const dateRange = layer.gfw4WingsDateRange || {
						start: "2023-01-01",
						end: "2023-12-31",
					};

					// Build the property expression based on interval
					// For YEAR interval: property is just the year (e.g., "2023")
					// For MONTH interval: uses numeric encoding (year * 12 + month_index)
					let valueExpression: maplibregl.ExpressionSpecification;
					let propertyNames: string[] = []; // Used for hover to calculate total

					if (interval === "YEAR") {
						const yearProperty = dateRange.start.substring(0, 4);
						propertyNames = [yearProperty];
						valueExpression = ["coalesce", ["get", yearProperty], 0];
					} else {
						// For MONTH/DAY, sum all month properties in the date range
						// GFW uses numeric encoding for month properties: year * 12 + month_index (0-based)
						// e.g., January 2023 = 2023 * 12 + 0 = 24276
						// Parse dates directly from strings to avoid timezone issues
						const [startYear, startMonth] = dateRange.start
							.split("-")
							.map(Number);
						const [endYear, endMonth] = dateRange.end.split("-").map(Number);

						let currentYear = startYear;
						let currentMonth = startMonth; // 1-indexed from the date string

						while (
							currentYear < endYear ||
							(currentYear === endYear && currentMonth <= endMonth)
						) {
							// GFW encoding: year * 12 + month_index (where month_index is 0-based)
							const monthEncoded = currentYear * 12 + (currentMonth - 1);
							propertyNames.push(String(monthEncoded));
							currentMonth++;
							if (currentMonth > 12) {
								currentMonth = 1;
								currentYear++;
							}
						}
						console.log(
							"[GFW MapView] Month properties to sum (encoded):",
							propertyNames,
						);
						// Sum all month values using + expression
						if (propertyNames.length === 1) {
							valueExpression = ["coalesce", ["get", propertyNames[0]], 0];
						} else {
							// Build a sum expression: ["+", ["coalesce", ["get", "2023-01"], 0], ["coalesce", ["get", "2023-02"], 0], ...]
							const sumParts: maplibregl.ExpressionSpecification[] =
								propertyNames.map(
									(prop) =>
										[
											"coalesce",
											["get", prop],
											0,
										] as maplibregl.ExpressionSpecification,
								);
							valueExpression = [
								"+",
								...sumParts,
							] as maplibregl.ExpressionSpecification;
						}
					}

					// Build tile URL with query parameters - use MVT format for vector tiles
					const params = new URLSearchParams({
						format: "MVT",
						interval: interval,
						"datasets[0]": dataset,
						"date-range": `${dateRange.start},${dateRange.end}`,
					});

					const tileUrl = `https://gateway.api.globalfishingwatch.org/v3/4wings/tile/heatmap/{z}/{x}/{y}?${params.toString()}`;
					console.log("[GFW MapView] Building tile URL:", {
						interval,
						dateRange: `${dateRange.start},${dateRange.end}`,
						fullUrl: tileUrl.replace("{z}/{x}/{y}", "0/0/0"),
					});

					map.addSource(layer.id, {
						type: "vector",
						tiles: [tileUrl],
						minzoom: 0,
						maxzoom: 12,
						attribution: "&copy; Global Fishing Watch",
					});

					// Add fill layer for the heatmap visualization
					// The MVT layer name is "main" and the value property depends on interval
					map.addLayer({
						id: `${layer.id}-fill`,
						type: "fill",
						source: layer.id,
						"source-layer": "main",
						paint: {
							// Color based on fishing hours - using a heatmap color ramp
							"fill-color": [
								"interpolate",
								["linear"],
								valueExpression,
								0,
								"rgba(12, 39, 108, 0)",
								1,
								"rgba(18, 83, 167, 0.6)",
								10,
								"rgba(59, 144, 136, 0.7)",
								100,
								"rgba(138, 189, 107, 0.8)",
								1000,
								"rgba(237, 242, 82, 0.9)",
								10000,
								"rgba(255, 68, 68, 1)",
							],
							"fill-opacity": layer.opacity,
						},
					});

					// Add hover interaction for GFW layer
					const gfwLayerId = `${layer.id}-fill`;
					const gfwPopup = new maplibregl.Popup({
						closeButton: false,
						closeOnClick: false,
						className: "gfw-hover-popup",
					});

					// Store property names for hover calculation
					const hoverPropertyNames = [...propertyNames];

					map.on("mousemove", gfwLayerId, (e) => {
						if (!e.features || e.features.length === 0) return;

						map.getCanvas().style.cursor = "pointer";
						const feature = e.features[0];
						const properties = feature.properties || {};

						// Calculate total fishing hours from all properties
						let totalHours = 0;
						for (const prop of hoverPropertyNames) {
							const value = properties[prop];
							if (typeof value === "number") {
								totalHours += value;
							}
						}

						// Format the hours nicely
						const formattedHours =
							totalHours < 1
								? totalHours.toFixed(2)
								: totalHours < 10
									? totalHours.toFixed(1)
									: Math.round(totalHours).toLocaleString();

						gfwPopup
							.setLngLat(e.lngLat)
							.setHTML(
								`<div class="text-sm font-medium">${formattedHours} fishing hours</div>`,
							)
							.addTo(map);
					});

					map.on("mouseleave", gfwLayerId, () => {
						map.getCanvas().style.cursor = "";
						gfwPopup.remove();
					});

					// Track state for this layer
					previousLayerState.set(layer.id, {
						visible: true,
						opacity: layer.opacity,
						dataHash: `gfw-${dataset}-${interval}-${dateRange.start}-${dateRange.end}`,
					});
				}
			});

			// Reorder layers on the map to match the layers array order
			// Layers at the start of the array (top of the UI list) should be rendered on top
			// MapLibre renders layers in order they appear in the style, later = on top
			// So we need to ensure layers at index 0 are rendered last (on top)
			const visibleLayerIds = layers
				.filter((l) => l.visible && map.getSource(l.id))
				.map((l) => l.id);

			// Move layers in reverse order - last layer first, so first layer ends up on top
			for (let i = visibleLayerIds.length - 1; i >= 0; i--) {
				const layerId = visibleLayerIds[i];

				// Get all map layer IDs for this layer and move them to the top
				// Order matters: raster first (bottom), then fill, lines, circles/symbols/markers (top)
				const mapLayerIds = [
					`${layerId}-raster`,
					`${layerId}-fill`,
					`${layerId}-line`,
					`${layerId}-line-solid`,
					`${layerId}-line-dashed`,
					`${layerId}-line-dotted`,
					`${layerId}-circle`,
					`${layerId}-symbol`,
					`${layerId}-marker`,
				].filter((id) => map.getLayer(id));

				// Move each sublayer to the top (no beforeId = move to top)
				for (const mapLayerId of mapLayerIds) {
					map.moveLayer(mapLayerId);
				}
			}

			// Move TerraDraw layers to the very top so editing features appear above all other layers
			const terraDrawLayers = [
				"td-polygon",
				"td-polygon-outline",
				"td-linestring",
				"td-point",
				"td-point-marker",
			].filter((id) => map.getLayer(id));

			for (const tdLayerId of terraDrawLayers) {
				map.moveLayer(tdLayerId);
			}
		}, [layers, mapLoaded]);

		// Handle layer selection - pan/zoom to fit layer bounds
		useEffect(() => {
			if (!mapRef.current || !mapLoaded || !highlightedLayerId) return;

			const map = mapRef.current;
			const selectedLayer = layers.find((l) => l.id === highlightedLayerId);

			if (!selectedLayer || !selectedLayer.visible || !selectedLayer.data)
				return;

			// Calculate bounds from the layer's GeoJSON data
			const bounds = new maplibregl.LngLatBounds();
			let hasValidCoords = false;

			const processCoordinates = (coords: unknown, geometryType: string) => {
				if (geometryType === "Point") {
					const [lng, lat] = coords as [number, number];
					if (isFinite(lng) && isFinite(lat)) {
						bounds.extend([lng, lat]);
						hasValidCoords = true;
					}
				} else if (
					geometryType === "LineString" ||
					geometryType === "MultiPoint"
				) {
					(coords as [number, number][]).forEach(([lng, lat]) => {
						if (isFinite(lng) && isFinite(lat)) {
							bounds.extend([lng, lat]);
							hasValidCoords = true;
						}
					});
				} else if (
					geometryType === "Polygon" ||
					geometryType === "MultiLineString"
				) {
					(coords as [number, number][][]).forEach((ring) => {
						ring.forEach(([lng, lat]) => {
							if (isFinite(lng) && isFinite(lat)) {
								bounds.extend([lng, lat]);
								hasValidCoords = true;
							}
						});
					});
				} else if (geometryType === "MultiPolygon") {
					(coords as [number, number][][][]).forEach((polygon) => {
						polygon.forEach((ring) => {
							ring.forEach(([lng, lat]) => {
								if (isFinite(lng) && isFinite(lat)) {
									bounds.extend([lng, lat]);
									hasValidCoords = true;
								}
							});
						});
					});
				}
			};

			// Handle GeoJSON FeatureCollection
			if (selectedLayer.data && typeof selectedLayer.data === "object") {
				const data = selectedLayer.data as {
					type?: string;
					features?: Array<{
						geometry?: { type: string; coordinates: unknown };
					}>;
				};
				if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
					data.features.forEach((feature) => {
						if (feature.geometry?.coordinates) {
							processCoordinates(
								feature.geometry.coordinates,
								feature.geometry.type,
							);
						}
					});
				}
			}

			// Fit map to bounds if we found valid coordinates
			if (hasValidCoords && !bounds.isEmpty()) {
				map.fitBounds(bounds, {
					padding: 150,
					maxZoom: 12,
					duration: 1000,
				});
			}
		}, [highlightedLayerId, layers, mapLoaded]);

		// Marker overlay layer for showing icons on top of TerraDraw features during editing
		useEffect(() => {
			if (!mapRef.current || !mapLoaded) return;

			const map = mapRef.current;
			const MARKER_OVERLAY_SOURCE = "marker-overlay-source";
			const MARKER_OVERLAY_LAYER = "marker-overlay-layer";

			// If no marker features to show, remove the overlay
			if (!markerFeatureIds || markerFeatureIds.size === 0 || !markerIcon) {
				if (map.getLayer(MARKER_OVERLAY_LAYER)) {
					map.removeLayer(MARKER_OVERLAY_LAYER);
				}
				if (map.getSource(MARKER_OVERLAY_SOURCE)) {
					map.removeSource(MARKER_OVERLAY_SOURCE);
				}
				return;
			}

			// Use the passed snapshot to get marker positions (updates when features move)
			const snapshot = markerOverlaySnapshot || [];
			const markerFeatures = snapshot
				.filter((f) => markerFeatureIds.has(String(f.id)))
				.filter((f) => f.geometry.type === "Point")
				.map((f) => ({
					type: "Feature" as const,
					geometry: {
						type: "Point" as const,
						coordinates: f.geometry.coordinates as [number, number],
					},
					properties: { id: String(f.id) },
				}));

			if (markerFeatures.length === 0) {
				// No valid marker features, clean up
				if (map.getLayer(MARKER_OVERLAY_LAYER)) {
					map.removeLayer(MARKER_OVERLAY_LAYER);
				}
				if (map.getSource(MARKER_OVERLAY_SOURCE)) {
					map.removeSource(MARKER_OVERLAY_SOURCE);
				}
				return;
			}

			const geojsonData: GeoJSON.FeatureCollection = {
				type: "FeatureCollection",
				features: markerFeatures,
			};

			// Load marker icons if not already loaded
			const color = markerColor || "#3b82f6";
			const iconId = getMarkerIconId(markerIcon, color);

			loadMarkerIcons(map, color).then(() => {
				if (!map.hasImage(iconId)) return;

				// Update or create the source
				const source = map.getSource(MARKER_OVERLAY_SOURCE) as
					| maplibregl.GeoJSONSource
					| undefined;
				if (source) {
					source.setData(geojsonData);
				} else {
					map.addSource(MARKER_OVERLAY_SOURCE, {
						type: "geojson",
						data: geojsonData,
					});
				}

				// Create or update the layer
				if (map.getLayer(MARKER_OVERLAY_LAYER)) {
					// Layer exists - update the icon properties
					map.setLayoutProperty(MARKER_OVERLAY_LAYER, "icon-image", iconId);
					map.setLayoutProperty(
						MARKER_OVERLAY_LAYER,
						"icon-anchor",
						markerIcon === "default" ? "bottom" : "center",
					);
				} else {
					// Create new layer
					map.addLayer({
						id: MARKER_OVERLAY_LAYER,
						type: "symbol",
						source: MARKER_OVERLAY_SOURCE,
						layout: {
							"icon-image": iconId,
							"icon-size": 1.2,
							"icon-anchor": markerIcon === "default" ? "bottom" : "center",
							"icon-allow-overlap": true,
						},
						paint: {
							"icon-opacity": 1,
						},
					});
				}
			});

			// Cleanup on unmount or when deps change
			return () => {
				// Don't remove immediately - let the effect re-run decide
			};
		}, [
			mapLoaded,
			markerIcon,
			markerFeatureIds,
			markerColor,
			markerOverlaySnapshot,
		]);

	// Helper function to show a popup (closes any existing popup first)
	const showPopup = useCallback((lngLat: maplibregl.LngLat, html: string) => {
		if (!mapRef.current) return;

		// Close existing popup if any
		if (currentPopupRef.current) {
			currentPopupRef.current.remove();
		}

		// Create and show new popup
		const popup = new maplibregl.Popup({
			closeButton: true,
			closeOnClick: true,
			maxWidth: "400px",
		})
			.setLngLat(lngLat)
			.setHTML(html)
			.addTo(mapRef.current);

		// Store reference to current popup
		currentPopupRef.current = popup;

		// Clear reference when popup is closed
		popup.on("close", () => {
			if (currentPopupRef.current === popup) {
				currentPopupRef.current = null;
			}
		});
	}, []);

	// Unified click handler for all layers (vector + WMS)
	useEffect(() => {
		if (!mapRef.current || !mapLoaded) return;

		const map = mapRef.current;

		// Check drawing mode (preserve existing logic)
		const isDrawing =
			drawingMode &&
			drawingMode !== "select" &&
			drawingMode !== "delete" &&
			drawingMode !== "delete-selection";
		if (isDrawing) return;

		// Helper to extract base layer ID (remove -marker, -fill, -circle, etc. suffixes)
		const getOriginalLayerId = (mapLayerId: string): string => {
			const suffixes = [
				"-marker",
				"-fill",
				"-circle",
				"-line",
				"-symbol",
				"-raster",
			];
			for (const suffix of suffixes) {
				if (mapLayerId.endsWith(suffix)) {
					return mapLayerId.slice(0, -suffix.length);
				}
			}
			return mapLayerId;
		};

		// Async helper to fetch WMS data and update popup section
		const fetchWMSDataAndUpdatePopup = async (
			layer: Layer,
			lngLat: maplibregl.LngLat,
		) => {
			if (!onWMSFeatureInfoRequestRef.current) return;

			// Build GetFeatureInfo request params
			const bounds = map.getBounds();
			const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
			const canvas = map.getCanvas();
			const width = canvas.width;
			const height = canvas.height;
			const point = map.project(lngLat);
			const x = Math.round(point.x);
			const y = Math.round(point.y);

			try {
				const result = await onWMSFeatureInfoRequestRef.current({
					wmsUrl: layer.wmsUrl!,
					layers: layer.wmsLayerName!,
					bbox,
					width,
					height,
					x,
					y,
					time: layer.wmsTimeDimension?.current,
					version: layer.wmsVersion,
					cqlFilter: layer.wmsCqlFilter,
				});

				// Update section with result
				if (result && currentPopupRef.current) {
					const newContent = formatFeatureInfoHTML(result, layer.name);
					const popupElement = currentPopupRef.current.getElement();
					if (popupElement) {
						updatePopupSection(popupElement, layer.id, newContent);
					}
				} else if (currentPopupRef.current) {
					// No result - update with "no data" message
					const noDataContent = `
						<div style="font-size: 13px; min-width: 150px;">
							<div style="margin-bottom: 4px;">
								<span style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Layer</span>
								<div style="font-weight: 600; color: #1e293b;">${layer.name}</div>
							</div>
							<div style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px;">
								<div style="font-size: 12px; color: #64748b;">No data at this location</div>
							</div>
						</div>
					`;
					const popupElement = currentPopupRef.current.getElement();
					if (popupElement) {
						updatePopupSection(popupElement, layer.id, noDataContent);
					}
				}
			} catch (error) {
				console.warn(`WMS GetFeatureInfo failed for ${layer.name}:`, error);
				// Update with error message
				if (currentPopupRef.current) {
					const errorContent = `
						<div style="font-size: 13px; min-width: 150px;">
							<div style="margin-bottom: 4px;">
								<span style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Layer</span>
								<div style="font-weight: 600; color: #1e293b;">${layer.name}</div>
							</div>
							<div style="border-top: 1px solid #e2e8f0; margin-top: 8px; padding-top: 8px;">
								<div style="font-size: 12px; color: #ef4444;">Failed to load data</div>
							</div>
						</div>
					`;
					const popupElement = currentPopupRef.current.getElement();
					if (popupElement) {
						updatePopupSection(popupElement, layer.id, errorContent);
					}
				}
			}
		};

		// Main click handler
		const handleUnifiedClick = async (e: maplibregl.MapMouseEvent) => {
			// Query all features at click point
			const features = map.queryRenderedFeatures(e.point);

			// Group by base layer ID (remove -fill, -marker suffixes)
			const layerFeatureMap = new Map<string, any[]>();
			for (const feature of features) {
				const layerId = getOriginalLayerId(feature.layer.id);
				const layer = layers.find((l) => l.id === layerId);
				if (layer && layer.visible) {
					if (!layerFeatureMap.has(layerId)) {
						layerFeatureMap.set(layerId, []);
					}
					layerFeatureMap.get(layerId)!.push(feature);
				}
			}

			// Build sections for vector layers (immediate)
			const sections: PopupSection[] = [];
			for (const [layerId, features] of layerFeatureMap.entries()) {
				const layer = layers.find((l) => l.id === layerId)!;
				const layerIndex = layers.indexOf(layer);

				if (features.length > 0) {
					const feature = features[0];
					const content = generateFeaturePopupHTML({
						layerName: layer.name,
						featureName: feature.properties?.name,
						description: feature.properties?.description,
					});
					sections.push({ layerId, layerName: layer.name, content, layerIndex });
				}
			}

			// Add WMS layer placeholders
			const wmsLayers = layers.filter(
				(l) => l.visible && l.wmsUrl && l.wmsLayerName,
			);
			for (const layer of wmsLayers) {
				sections.push(
					createLoadingSection(layer.id, layer.name, layers.indexOf(layer)),
				);
			}

			// Show popup if any data
			if (sections.length === 0) return;

			// Sort by layer index (top layers first)
			sections.sort((a, b) => a.layerIndex - b.layerIndex);
			const html = generateAggregatedPopupHTML(sections);
			showPopup(e.lngLat, html);

			// Notify parent of top layer click (for highlighting)
			if (layerFeatureMap.size > 0 && onFeatureClickRef.current) {
				const topLayerId = Array.from(layerFeatureMap.keys())
					.map((id) => ({ id, index: layers.findIndex((l) => l.id === id) }))
					.filter((item) => item.index !== -1)
					.sort((a, b) => a.index - b.index)[0]?.id;
				if (topLayerId) {
					onFeatureClickRef.current(topLayerId);
				}
			}

			// Fetch WMS data asynchronously
			for (const layer of wmsLayers) {
				fetchWMSDataAndUpdatePopup(layer, e.lngLat);
			}
		};

		// Register unified click handler
		map.on("click", handleUnifiedClick);

		return () => {
			map.off("click", handleUnifiedClick);
		};
	}, [mapLoaded, layers, drawingMode]);


		const visibleLayers = layers.filter((layer) => layer.visible);
		const activeLegend = visibleLayers.find((layer) => layer.legend);

		// Collect unique attributions from visible layers
		const visibleAttributions = Array.from(
			new Set(
				visibleLayers
					.filter((layer) => layer.wmsAttribution)
					.map((layer) => layer.wmsAttribution as string),
			),
		);

		return (
			<div className="relative w-full h-full">
				<div ref={mapContainerRef} className="w-full h-full" />
				{!mapLoaded && (
					<div className="absolute inset-0 flex items-center justify-center bg-slate-100">
						<p className="text-slate-600">Loading map...</p>
					</div>
				)}
				{drawingMode && (
					<div
						className={`absolute top-4 left-1/2 -translate-x-1/2 ${
							drawingMode === "delete" ? "bg-red-600" : "bg-blue-600"
						} text-white px-4 py-2 rounded-lg shadow-lg`}
					>
						<p className="text-sm">
							{drawingMode === "Point" && "Click on the map to place a point"}
							{drawingMode === "Marker" && "Click on the map to place a marker"}
							{drawingMode === "LineString" &&
								"Click to add points. Double-click to finish the line"}
							{drawingMode === "Polygon" &&
								"Click to add vertices. Double-click to close the polygon"}
							{drawingMode === "select" &&
								"Click on a feature to select and modify it"}
							{drawingMode === "delete" && "Click on a feature to delete it"}
						</p>
					</div>
				)}
				{activeLegend && <Legend layer={activeLegend} />}
				{/* Layer attributions */}
				{visibleAttributions.length > 0 && (
					<div className="absolute bottom-2 left-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-slate-600 max-w-[200px]">
						{visibleAttributions.map((attribution, index) => (
							<span key={attribution}>
								{index > 0 && " | "}
								{attribution}
							</span>
						))}
					</div>
				)}
			</div>
		);
	},
);

MapView.displayName = "MapView";
