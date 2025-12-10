import maplibregl from "maplibre-gl";
import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Layer } from "../App";
import { Legend } from "./Legend";

// TerraDraw is loaded dynamically to avoid bundling issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let TerradrawControlClass: any = null;

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

interface MapViewProps {
	center: [number, number];
	zoom: number;
	layers: Layer[];
	basemap: string;
	onDrawComplete?: (feature: unknown) => void;
	onTerraDrawChange?: (features: TerraDrawFeature[]) => void;
	drawingMode?: "Point" | "LineString" | "Polygon" | "select" | "delete" | null;
	onFeatureClick?: (layerId: string) => void;
	highlightedLayerId?: string | null;
}

export interface MapViewRef {
	startDrawing: (
		type: "Point" | "LineString" | "Polygon",
		color?: string,
	) => void;
	setDrawMode: (mode: "select" | "delete") => void;
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
}

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

		useImperativeHandle(ref, () => ({
			startDrawing: (
				type: "Point" | "LineString" | "Polygon",
				color?: string,
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
						// Update point style
						terraDraw.updateModeOptions("point", {
							styles: {
								pointColor: color,
								pointOutlineColor: "#ffffff",
							},
						});
						// Update linestring style
						terraDraw.updateModeOptions("linestring", {
							styles: {
								lineStringColor: color,
								lineStringWidth: 3,
								closingPointColor: color,
								closingPointOutlineColor: "#ffffff",
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
								closingPointOutlineColor: "#ffffff",
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
				}
			},
			setDrawMode: (mode: "select" | "delete") => {
				if (!drawRef.current || !mapLoaded) return;

				const terraDraw = drawRef.current.getTerraDrawInstance();
				if (!terraDraw) return;

				// Enable TerraDraw if not already enabled
				if (!terraDraw.enabled) {
					terraDraw.start();
				}

				terraDraw.setMode(mode);
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
								pointOutlineColor: "#ffffff",
							},
						});
						terraDraw.updateModeOptions("linestring", {
							styles: {
								lineStringColor: color,
								lineStringWidth: 3,
								closingPointColor: color,
								closingPointOutlineColor: "#ffffff",
							},
						});
						terraDraw.updateModeOptions("polygon", {
							styles: {
								fillColor: color,
								fillOpacity: 0.3,
								outlineColor: color,
								outlineWidth: 2,
								closingPointColor: color,
								closingPointOutlineColor: "#ffffff",
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
						// Create a GeoJSON feature to add
						const geoJsonFeature = {
							type: "Feature" as const,
							properties: {},
							geometry: {
								type: feature.type,
								coordinates: feature.coordinates,
							},
						};

						// Use TerraDraw's addFeatures method
						const ids = terraDraw.addFeatures([geoJsonFeature]);
						if (ids && ids.length > 0) {
							addedIds.push(String(ids[0]));
						}
					} catch (err) {
						console.warn("Failed to add feature to TerraDraw:", err);
					}
				}

				// Set to select mode so user can interact with features
				terraDraw.setMode("select");

				return addedIds;
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
			const map = new maplibregl.Map({
				container: mapContainerRef.current,
				style: getBasemapStyle(initBasemap),
				center: [initCenter[1], initCenter[0]], // uses [lng, lat]
				zoom: initZoom - 1,
				attributionControl: false, // Disable default attribution
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
				const lineStyles = ["solid", "dashed", "dotted"];

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
				// Update styled line layers
				lineStyles.forEach((style) => {
					const styledLineId = `${layerId}-line-${style}`;
					if (map.getLayer(styledLineId)) {
						map.setPaintProperty(styledLineId, "line-opacity", opacity);
					}
				});
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

					// Add polygon fills
					map.addLayer({
						id: `${layer.id}-fill`,
						type: "fill",
						source: layer.id,
						filter: ["==", ["geometry-type"], "Polygon"],
						paint: {
							"fill-color": fillColor,
							"fill-opacity": normalizedOpacity,
						},
					});

					// Add lines with different styles
					const features = layer.data.features || [];
					const hasLineStyles = features.some(
						(f: unknown) =>
							(f as Record<string, unknown>).properties?.lineStyle,
					);

					if (hasLineStyles) {
						// Create separate layers for each line style
						["solid", "dashed", "dotted"].forEach((style) => {
							const paintConfig: Record<string, unknown> = {
								"line-color": fillColor,
								"line-width": 2,
								"line-opacity": normalizedOpacity,
							};

							// Only add line-dasharray for non-solid styles
							if (style === "dashed") {
								paintConfig["line-dasharray"] = [2, 2];
							} else if (style === "dotted") {
								paintConfig["line-dasharray"] = [0.5, 1.5];
							}

							map.addLayer({
								id: `${layer.id}-line-${style}`,
								type: "line",
								source: layer.id,
								filter: [
									"all",
									[
										"in",
										["geometry-type"],
										["literal", ["Polygon", "LineString"]],
									],
									["==", ["get", "lineStyle"], style],
								],
								paint: paintConfig,
							});
						});

						// Default line for features without lineStyle
						map.addLayer({
							id: `${layer.id}-line`,
							type: "line",
							source: layer.id,
							filter: [
								"all",
								[
									"in",
									["geometry-type"],
									["literal", ["Polygon", "LineString"]],
								],
								["!", ["has", "lineStyle"]],
							],
							paint: {
								"line-color": fillColor,
								"line-width": 2,
								"line-opacity": normalizedOpacity,
							},
						});
					} else {
						// Standard line layer
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
								"line-width": 2,
								"line-opacity": normalizedOpacity,
							},
						});
					}

					// Add point markers with icon support
					map.addLayer({
						id: `${layer.id}-circle`,
						type: "circle",
						source: layer.id,
						filter: ["==", ["geometry-type"], "Point"],
						paint: {
							"circle-radius": 8,
							"circle-color": fillColor,
							"circle-opacity": normalizedOpacity,
							"circle-stroke-width": 2,
							"circle-stroke-color": "#ffffff",
						},
					});

					// Add popups on click and notify layer selection
					map.on("click", `${layer.id}-fill`, (e: unknown) => {
						// Notify parent about the clicked layer
						if (onFeatureClickRef.current) {
							onFeatureClickRef.current(layer.id);
						}
						if (e.features?.[0]) {
							const feature = e.features[0];
							const name = feature.properties.name || "Unnamed";
							const description = feature.properties.description || "";
							new maplibregl.Popup()
								.setLngLat(e.lngLat)
								.setHTML(
									`<strong>${name}</strong>${description ? `<br/>${description}` : ""}`,
								)
								.addTo(map);
						}
					});

					map.on("click", `${layer.id}-circle`, (e: unknown) => {
						// Notify parent about the clicked layer
						if (onFeatureClickRef.current) {
							onFeatureClickRef.current(layer.id);
						}
						if (e.features?.[0]) {
							const feature = e.features[0];
							const name = feature.properties.name || "Unnamed";
							const description = feature.properties.description || "";
							new maplibregl.Popup()
								.setLngLat(e.lngLat)
								.setHTML(
									`<strong>${name}</strong>${description ? `<br/>${description}` : ""}`,
								)
								.addTo(map);
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
				// Order matters: fill first (bottom), then lines, then circles/symbols (top)
				const mapLayerIds = [
					`${layerId}-fill`,
					`${layerId}-line`,
					`${layerId}-line-solid`,
					`${layerId}-line-dashed`,
					`${layerId}-line-dotted`,
					`${layerId}-circle`,
					`${layerId}-symbol`,
				].filter((id) => map.getLayer(id));

				// Move each sublayer to the top (no beforeId = move to top)
				for (const mapLayerId of mapLayerIds) {
					map.moveLayer(mapLayerId);
				}
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
					padding: 50,
					maxZoom: 15,
					duration: 500,
				});
			}
		}, [highlightedLayerId, layers, mapLoaded]);

		const visibleLayers = layers.filter((layer) => layer.visible);
		const activeLegend = visibleLayers.find((layer) => layer.legend);

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
						className={`absolute top-4 left-1/2 -translate-x-1/2 ${drawingMode === "delete" ? "bg-red-600" : "bg-blue-600"} text-white px-4 py-2 rounded-lg shadow-lg`}
					>
						<p className="text-sm">
							{drawingMode === "Point" && "Click on the map to place a point"}
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
			</div>
		);
	},
);

MapView.displayName = "MapView";
