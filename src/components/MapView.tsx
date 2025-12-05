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

interface MapViewProps {
	center: [number, number];
	zoom: number;
	layers: Layer[];
	basemap: string;
	onDrawComplete?: (feature: unknown) => void;
	drawingMode?: "Point" | "LineString" | "Polygon" | null;
}

export interface MapViewRef {
	startDrawing: (type: "Point" | "LineString" | "Polygon") => void;
	cancelDrawing: () => void;
}

export const MapView = forwardRef<MapViewRef, MapViewProps>(
	({ center, zoom, layers, basemap, onDrawComplete, drawingMode }, ref) => {
		const mapContainerRef = useRef<HTMLDivElement>(null);
		const mapRef = useRef<maplibregl.Map | null>(null);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const drawRef = useRef<any>(null);
		const onDrawCompleteRef = useRef(onDrawComplete);
		const initialPropsRef = useRef({ center, zoom, basemap });
		const [mapLoaded, setMapLoaded] = useState(false);
		const mapLoadedRef = useRef(false);

		// Keep the ref updated with the latest callback
		useEffect(() => {
			onDrawCompleteRef.current = onDrawComplete;
		}, [onDrawComplete]);

		useImperativeHandle(ref, () => ({
			startDrawing: (type: "Point" | "LineString" | "Polygon") => {
				if (!drawRef.current || !mapLoaded) return;

				const terraDraw = drawRef.current.getTerraDrawInstance();
				if (!terraDraw) return;

				// Enable TerraDraw if not already enabled
				if (!terraDraw.enabled) {
					terraDraw.start();
				}

				// Only clear if there are existing features
				const snapshot = terraDraw.getSnapshot();
				if (snapshot.length > 0) {
					terraDraw.clear();
				}

				// Start drawing based on type
				if (type === "Point") {
					terraDraw.setMode("point");
				} else if (type === "LineString") {
					terraDraw.setMode("linestring");
				} else if (type === "Polygon") {
					terraDraw.setMode("polygon");
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
		}));

		useEffect(() => {
			if (!mapContainerRef.current || mapRef.current) return;

			// Create basemap style based on basemap prop
			const getBasemapStyle = (basemapType: string): maplibregl.StyleSpecification => {
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
								tiles: ["https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"],
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
								tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
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
								tiles: ["https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"],
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
						await import("@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css");
					}

					// Initialize terradraw control after map style is loaded
					const draw = new TerradrawControlClass({
						modes: ["point", "linestring", "polygon", "rectangle", "circle", "freehand", "select", "delete"],
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
									// Clear the drawing after completion
									terraDraw.clear();
								}
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
			const getBasemapStyle = (basemapType: string): maplibregl.StyleSpecification => {
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
								tiles: ["https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"],
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
								tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
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
								tiles: ["https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"],
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
						modes: ["point", "linestring", "polygon", "rectangle", "circle", "freehand", "select", "delete"],
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
									terraDraw.clear();
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

			// Remove all existing layers and sources
			layers.forEach((layer) => {
				// Remove all possible layer variations
				const layerIds = [
					`${layer.id}-fill`,
					`${layer.id}-line`,
					`${layer.id}-line-solid`,
					`${layer.id}-line-dashed`,
					`${layer.id}-line-dotted`,
					`${layer.id}-circle`,
					`${layer.id}-symbol`,
				];

				layerIds.forEach((layerId) => {
					if (map.getLayer(layerId)) {
						map.removeLayer(layerId);
					}
				});

				// Now safe to remove source after all layers are removed
				if (map.getSource(layer.id)) {
					map.removeSource(layer.id);
				}
			});

			// Add visible layers
			layers.forEach((layer) => {
				if (!layer.visible) return;

				if (layer.type === "geojson" && layer.data) {
					map.addSource(layer.id, {
						type: "geojson",
						data: layer.data,
					});

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
							"fill-opacity": layer.opacity * 0.5,
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
								"line-opacity": layer.opacity,
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
								"line-opacity": layer.opacity,
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
								"line-opacity": layer.opacity,
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
							"circle-opacity": layer.opacity,
							"circle-stroke-width": 2,
							"circle-stroke-color": "#ffffff",
						},
					});

					// Add popups on click
					map.on("click", `${layer.id}-fill`, (e: unknown) => {
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
				} else if (layer.type === "heatmap" && layer.data) {
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
							"circle-opacity": layer.opacity * 0.6,
						},
					});
				}
			});
		}, [layers, mapLoaded]);

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
					<div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
						<p className="text-sm">
							{drawingMode === "Point" && "Click on the map to place a point"}
							{drawingMode === "LineString" &&
								"Click to add points. Double-click to finish the line"}
							{drawingMode === "Polygon" &&
								"Click to add vertices. Double-click to close the polygon"}
						</p>
					</div>
				)}
				{activeLegend && <Legend layer={activeLegend} />}
			</div>
		);
	},
);

MapView.displayName = "MapView";
