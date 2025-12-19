import {
	ClerkProvider,
	SignedIn,
	SignedOut,
	SignInButton,
	UserButton,
} from "@clerk/clerk-react";
import {
	Layers,
	Map as MapIcon,
	MessageSquare,
	Settings,
	Share2,
	Shield,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminPanel } from "./components/AdminPanel";
import { CommentSection } from "./components/CommentSection";
import { LayerCreator } from "./components/LayerCreator";
import { LayerManager } from "./components/LayerManager";
import { MapSelector } from "./components/MapSelector";
import {
	type DrawingStyles,
	MapView,
	type MapViewRef,
	type TerraDrawFeature,
	type WMSFeatureInfoParams,
	type WMSFeatureInfoResponse,
} from "./components/MapView";
import { RoleBadge } from "./components/RoleBadge";
import { SettingsDialog } from "./components/SettingsDialog";
import { TimeSlider } from "./components/TimeSlider";
import { Button } from "./components/ui/button";
import { Toaster } from "./components/ui/sonner";
import { useCommentService } from "./services/commentService";
import { useLayerService } from "./services/layerService";
import { useMapService } from "./services/mapService";
import type { CommentResponse } from "./types/api";

// Get Clerk publishable key from environment variables
// Make sure to set VITE_CLERK_PUBLISHABLE_KEY in your .env file
const clerkPubKey =
	(typeof import.meta !== "undefined" &&
		import.meta.env?.VITE_CLERK_PUBLISHABLE_KEY) ||
	"";

// Check if Clerk is properly configured
const isClerkConfigured = clerkPubKey?.startsWith("pk_");

export interface Layer {
	id: string;
	name: string;
	type: "geojson" | "heatmap" | "markers" | "raster" | "vector";
	visible: boolean;
	opacity: number;
	data?: unknown;
	color?: string;
	description?: string;
	author?: string;
	doi?: string;
	category?: string;
	// Permission settings
	createdBy?: string; // User ID of the creator
	editable?: "creator-only" | "everyone"; // Who can edit this layer
	isGlobal?: boolean; // Whether layer is in the global library (Admin Panel layers)
	// Style settings (layer-level)
	lineWidth?: number;
	fillPolygons?: boolean;
	markerIcon?: "default" | "anchor" | "ship" | "warning" | "circle";
	// WMS properties
	wmsUrl?: string;
	wmsLayerName?: string;
	wmsTimeDimension?: {
		extent: string; // "2011-01-01/2024-09-01/P1M"
		default?: string;
		current?: string; // Currently selected time value (e.g., "2024-01-01/2024-06-01")
	};
	wmsLegendUrl?: string; // URL to GetLegendGraphic image
	wmsQueryable?: boolean; // Whether layer supports GetFeatureInfo
	wmsStyle?: string; // Selected style name for WMS requests
	wmsAvailableStyles?: Array<{
		name: string;
		title: string;
		legendUrl?: string;
	}>; // Available styles from GetCapabilities
	wmsBounds?: [number, number, number, number]; // [west, south, east, north] geographic bounds
	wmsAttribution?: string; // Attribution text from WMS service provider
	wmsVersion?: "1.1.1" | "1.3.0"; // WMS version (affects CRS/SRS parameter and BBOX order)
	wmsCRS?: string[]; // Supported coordinate reference systems
	wmsCqlFilter?: string; // CQL_FILTER for GeoServer/MapServer (vendor extension)
	// GeoTIFF properties
	geotiffUrl?: string;
	// Vector properties
	features?: unknown[];
	legend?: {
		type: "gradient" | "categories";
		items: Array<{ color: string; label: string; value?: number }>;
	};
	// Temporal properties
	temporal?: boolean;
	timeRange?: {
		start: Date;
		end: Date;
	};
	temporalData?: Array<{
		timestamp: Date;
		data: unknown;
	}>;
	// GFW 4Wings properties
	gfw4WingsDataset?: string;
	gfw4WingsInterval?: "DAY" | "MONTH" | "YEAR";
	gfw4WingsDateRange?: { start: string; end: string };
	// Flag for layers that exist only in frontend (need backend creation when added to map)
	isLocalOnly?: boolean;
}

export interface UserMap {
	id: string;
	name: string;
	description: string;
	layers: Layer[];
	center: [number, number];
	zoom: number;
	createdBy?: string; // User ID or email of creator
	permissions?: {
		editAccess: "private" | "collaborators" | "public";
		collaborators: string[]; // Array of email addresses
		visibility: "private" | "public"; // Who can view the map
	};
	user_role?: string | null; // "owner", "editor", "viewer", or null
}

function AppContent() {
	const [currentMap, setCurrentMap] = useState<UserMap | null>(null);
	const [maps, setMaps] = useState<UserMap[]>([]);
	const [mapsLoading, setMapsLoading] = useState(false);
	const [_layersLoading, setLayersLoading] = useState(false);
	const [showLayerManager, setShowLayerManager] = useState(true);
	const [showMapSelector, setShowMapSelector] = useState(false);
	const [showComments, setShowComments] = useState(false);
	const [showLayerCreator, setShowLayerCreator] = useState(false);
	const [showAdminPanel, setShowAdminPanel] = useState(false);
	const [availableLayers, setAvailableLayers] = useState<Layer[]>([]);
	const [basemap, setBasemap] = useState<string>("osm");
	const [drawingMode, setDrawingMode] = useState<
		| "Point"
		| "Marker"
		| "LineString"
		| "Polygon"
		| "Rectangle"
		| "Circle"
		| "Freehand"
		| "select"
		| "delete"
		| "delete-selection"
		| null
	>(null);
	const [drawCallback, setDrawCallback] = useState<
		((feature: unknown) => void) | null
	>(null);
	const [selectedLayerIdForComments, setSelectedLayerIdForComments] = useState<
		string | null
	>(null);
	const [editingLayer, setEditingLayer] = useState<Layer | null>(null);
	const [editingLayerOriginalIndex, setEditingLayerOriginalIndex] = useState<
		number | null
	>(null);
	const [showSettings, setShowSettings] = useState(false);
	const [comments, setComments] = useState<CommentResponse[]>([]);
	const [highlightedLayerId, setHighlightedLayerId] = useState<string | null>(
		null,
	);
	const [terraDrawSnapshot, setTerraDrawSnapshot] = useState<
		TerraDrawFeature[]
	>([]);
	// Track which features are markers (vs points) for icon rendering overlay
	const [markerFeatureIds, setMarkerFeatureIds] = useState<Set<string>>(
		new Set(),
	);
	const [currentMarkerIcon, setCurrentMarkerIcon] = useState<
		"default" | "anchor" | "ship" | "warning" | "circle"
	>("default");
	const [currentMarkerColor, setCurrentMarkerColor] =
		useState<string>("#3b82f6");
	const mapViewRef = useRef<MapViewRef>(null);

	// Initialize services
	const commentService = useCommentService();
	const layerService = useLayerService();
	const mapService = useMapService();

	// Pre-configured Global Fishing Watch layer (available without backend setup)
	const DEFAULT_GFW_LAYER: Layer = useMemo(
		() => ({
			id: "gfw-fishing-effort-default",
			name: "Global Fishing Effort",
			type: "vector", // Uses MVT vector tiles
			visible: true,
			opacity: 0.7,
			description:
				"Apparent fishing activity based on AIS data from Global Fishing Watch",
			author: "Global Fishing Watch",
			category: "Fishing Activity",
			isGlobal: true,
			isLocalOnly: true, // Not in backend - needs creation when added to map
			gfw4WingsDataset: "public-global-fishing-effort:latest",
			gfw4WingsInterval: "MONTH",
			gfw4WingsDateRange: { start: "2024-01-01", end: "2025-12-31" },
			// Temporal layer properties for TimeSlider integration
			temporal: true,
			timeRange: {
				start: new Date("2024-01-01"),
				end: new Date("2025-12-31"),
			},
		}),
		[],
	);

	// Function to load layers from API (only library layers with is_global=true)
	const loadLayers = useCallback(async () => {
		setLayersLoading(true);
		try {
			// Only load library layers (is_global=true) - these are created via Admin Panel
			const layerList = await layerService.listLayers({ is_global: true });
			// Transform each layer to frontend format
			const backendLayers = await Promise.all(
				layerList.map(async (listItem) => {
					const fullLayer = await layerService.getLayer(listItem.id);
					return layerService.transformToLayer(fullLayer);
				}),
			);
			// Merge default GFW layer with backend layers
			setAvailableLayers([DEFAULT_GFW_LAYER, ...backendLayers]);
		} catch (error) {
			console.error("Failed to load layers:", error);
			toast.error("Failed to load layer library");
			// Still show default GFW layer even if backend fails
			setAvailableLayers([DEFAULT_GFW_LAYER]);
		} finally {
			setLayersLoading(false);
		}
	}, [layerService, DEFAULT_GFW_LAYER]);

	// Function to load maps from API
	const loadMaps = useCallback(async () => {
		setMapsLoading(true);
		try {
			const mapList = await mapService.listMaps();

			// Transform map list responses to UserMap format
			const userMaps = await Promise.all(
				mapList.map(async (mapListItem) => {
					// Fetch full map details to get layers
					const fullMap = await mapService.getMap(mapListItem.id);
					return mapService.transformToUserMap(fullMap);
				}),
			);

			if (userMaps.length > 0) {
				setMaps(userMaps);
				setCurrentMap(userMaps[0]);
			} else {
				// If no maps exist, set to null
				setMaps([]);
				setCurrentMap(null);
			}
		} catch {
			toast.error("Failed to load maps");
			// Set to empty state on error
			setMaps([]);
			setCurrentMap(null);
		} finally {
			setMapsLoading(false);
		}
	}, [mapService]);

	// Function to load comments from API
	const loadComments = useCallback(
		async (mapId: string) => {
			try {
				const data = await commentService.listComments({ map_id: mapId });
				setComments(data);
			} catch {
				toast.error("Failed to load comments");
			}
		},
		[commentService],
	);

	// Load layers on component mount
	useEffect(() => {
		loadLayers();
	}, [loadLayers]);

	// Load maps on component mount
	useEffect(() => {
		loadMaps();
	}, [loadMaps]);

	// Load comments when map changes
	useEffect(() => {
		if (currentMap?.id) {
			loadComments(currentMap.id);
		}
	}, [currentMap?.id, loadComments]);

	// Temporal state management
	const [currentTimeRange, setCurrentTimeRange] = useState<[Date, Date]>([
		new Date("2024-10-01"),
		new Date("2025-03-31"),
	]);

	// Check if any temporal layers are visible
	const hasTemporalLayers = useMemo(() => {
		if (!currentMap) return false;
		return currentMap.layers.some(
			(layer) => layer.temporal && layer.visible && layer.timeRange,
		);
	}, [currentMap]);

	// Calculate overall time range from all temporal layers
	const globalTimeRange = useMemo(() => {
		if (!currentMap) return null;
		const temporalLayers = currentMap.layers.filter(
			(layer) => layer.temporal && layer.visible && layer.timeRange,
		);
		if (temporalLayers.length === 0) return null;

		const firstRange = temporalLayers[0].timeRange;
		if (!firstRange) return null;

		let minStart = firstRange.start;
		let maxEnd = firstRange.end;

		for (const layer of temporalLayers) {
			if (!layer.timeRange) continue;
			if (layer.timeRange.start < minStart) minStart = layer.timeRange.start;
			if (layer.timeRange.end > maxEnd) maxEnd = layer.timeRange.end;
		}

		return { start: minStart, end: maxEnd };
	}, [currentMap]);

	// Update layers with temporal data based on current time
	// Also hide the layer being edited so only TerraDraw features are shown
	const layersWithTemporalData = useMemo(() => {
		if (!currentMap) return [];
		return currentMap.layers.map((layer) => {
			// Hide the layer being edited - but only after TerraDraw has loaded the features
			// This prevents a flash where the layer disappears before TerraDraw shows features
			if (
				editingLayer &&
				layer.id === editingLayer.id &&
				terraDrawSnapshot.length > 0
			) {
				return { ...layer, visible: false };
			}

			// For GFW layers, update the date range based on currentTimeRange
			// Use MONTH interval for ranges < 12 months, YEAR for larger ranges
			if (layer.gfw4WingsDataset && layer.temporal) {
				// Format date without timezone issues (use local date components)
				const formatDate = (year: number, month: number, day: number) => {
					const m = String(month).padStart(2, "0");
					const d = String(day).padStart(2, "0");
					return `${year}-${m}-${d}`;
				};

				// Calculate range in months
				const startDate = currentTimeRange[0];
				const endDate = currentTimeRange[1];
				const monthsDiff =
					(endDate.getFullYear() - startDate.getFullYear()) * 12 +
					(endDate.getMonth() - startDate.getMonth());

				// Use MONTH for ranges < 12 months, YEAR for 12+ months
				const useMonthInterval = monthsDiff < 12;
				const interval: "MONTH" | "YEAR" = useMonthInterval ? "MONTH" : "YEAR";

				let dateRange: { start: string; end: string };
				if (useMonthInterval) {
					// Use actual month dates for MONTH interval
					dateRange = {
						start: formatDate(
							startDate.getFullYear(),
							startDate.getMonth() + 1,
							1,
						),
						end: formatDate(
							endDate.getFullYear(),
							endDate.getMonth() + 1,
							new Date(
								endDate.getFullYear(),
								endDate.getMonth() + 1,
								0,
							).getDate(),
						),
					};
				} else {
					// Snap to full years for YEAR interval
					dateRange = {
						start: formatDate(startDate.getFullYear(), 1, 1),
						end: formatDate(endDate.getFullYear(), 12, 31),
					};
				}

				console.log("[GFW] Date range for request:", {
					...dateRange,
					interval,
					monthsDiff,
				});
				return {
					...layer,
					gfw4WingsDateRange: dateRange,
					gfw4WingsInterval: interval,
				};
			}

			// For WMS temporal layers, update the current time dimension based on TimeSlider
			if (layer.wmsUrl && layer.wmsTimeDimension && layer.temporal) {
				// Format dates as YYYY-MM-DD for WMS TIME parameter
				const startStr = currentTimeRange[0].toISOString().split("T")[0];
				const endStr = currentTimeRange[1].toISOString().split("T")[0];
				const currentTime = `${startStr}/${endStr}`;

				return {
					...layer,
					wmsTimeDimension: {
						...layer.wmsTimeDimension,
						current: currentTime,
					},
				};
			}

			if (!layer.temporal || !layer.temporalData) return layer;

			// Find the closest temporal data point to current time
			const sortedData = [...layer.temporalData].sort(
				(a, b) =>
					Math.abs(a.timestamp.getTime() - currentTimeRange[0].getTime()) -
					Math.abs(b.timestamp.getTime() - currentTimeRange[0].getTime()),
			);

			const closestData = sortedData[0];
			return { ...layer, data: closestData.data };
		});
	}, [currentMap, currentTimeRange, editingLayer, terraDrawSnapshot.length]);

	// Get comment count for a specific layer
	const getLayerCommentCount = (layerId: string) => {
		return comments.filter((c) => c.layer_id === layerId).length;
	};

	// Open comments for a specific layer
	const handleOpenCommentsForLayer = (layerId: string) => {
		setSelectedLayerIdForComments(layerId);
		setShowComments(true);
		setShowLayerManager(false);
		setShowMapSelector(false);
		setShowLayerCreator(false);
	};

	// Transform API comments to component format
	const transformedComments = useMemo(() => {
		return comments.map((comment) => ({
			id: comment.id,
			author: comment.author_name || "Unknown User",
			content: comment.content,
			timestamp: new Date(comment.created_at),
			targetType: (comment.map_id && !comment.layer_id ? "map" : "layer") as
				| "map"
				| "layer",
			targetId: comment.layer_id || comment.map_id || "",
			parentId: comment.parent_id || undefined,
		}));
	}, [comments]);

	// Add a new comment - adapter between component and API
	const handleAddComment = async (commentData: {
		author: string;
		content: string;
		targetType: "map" | "layer";
		targetId: string;
		parentId?: string;
	}) => {
		if (!currentMap) {
			toast.error("No map selected");
			return;
		}
		try {
			const apiCommentData = {
				content: commentData.content,
				map_id:
					commentData.targetType === "map"
						? commentData.targetId
						: currentMap.id,
				layer_id:
					commentData.targetType === "layer" ? commentData.targetId : undefined,
				parent_id: commentData.parentId,
			};
			const newComment = await commentService.createComment(apiCommentData);
			setComments([...comments, newComment]);
			toast.success("Comment added");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			toast.error(`Failed to add comment: ${errorMessage}`);
		}
	};

	const updateLayer = (layerId: string, updates: Partial<Layer>) => {
		// Update local state immediately for responsive UI
		setCurrentMap((prev) => {
			if (!prev) return prev;
			return {
				...prev,
				layers: prev.layers.map((layer) =>
					layer.id === layerId ? { ...layer, ...updates } : layer,
				),
			};
		});

		// Persist visibility/opacity changes to backend
		if (
			currentMap &&
			(updates.visible !== undefined || updates.opacity !== undefined)
		) {
			const apiUpdates: { visible?: boolean; opacity?: number } = {};
			if (updates.visible !== undefined) {
				apiUpdates.visible = updates.visible;
			}
			if (updates.opacity !== undefined) {
				// Convert frontend 0-1 to backend 0-100
				apiUpdates.opacity = Math.round(updates.opacity * 100);
			}

			// Fire and forget - don't block UI for this
			layerService
				.updateMapLayer(currentMap.id, layerId, apiUpdates)
				.catch((error) => {
					console.error("Failed to persist layer update:", error);
				});
		}
	};

	const reorderLayers = async (startIndex: number, endIndex: number) => {
		if (!currentMap) return;

		// Create optimistic update
		const newLayers = Array.from(currentMap.layers);
		const [removed] = newLayers.splice(startIndex, 1);
		newLayers.splice(endIndex, 0, removed);

		// Store previous state for rollback
		const previousLayers = currentMap.layers;

		// Optimistically update UI
		setCurrentMap((prev) => {
			if (!prev) return prev;
			return { ...prev, layers: newLayers };
		});

		try {
			// UUID validation regex
			const uuidRegex =
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

			// Log all layer IDs for debugging
			console.log(
				"Reorder - All layer IDs:",
				newLayers.map((l) => ({ id: l.id, name: l.name })),
			);
			console.log("Reorder - Map ID:", currentMap.id);

			// Build layer_orders array with layer_id and order, filtering out invalid UUIDs
			const layerOrders = newLayers
				.filter((layer) => {
					const isValidUuid = uuidRegex.test(layer.id);
					if (!isValidUuid) {
						console.warn(
							`Skipping layer with non-UUID id during reorder: ${layer.id}`,
						);
					}
					return isValidUuid;
				})
				.map((layer, index) => ({
					layer_id: layer.id,
					order: index,
				}));

			console.log("Reorder - Sending layerOrders:", layerOrders);

			// Only call API if there are layers to reorder
			if (layerOrders.length === 0) {
				console.warn("No valid layer IDs to reorder");
				return;
			}

			// Call API to reorder layers
			await layerService.reorderMapLayers(currentMap.id, layerOrders);
		} catch (error) {
			console.error("Failed to reorder layers:", error);
			toast.error("Failed to reorder layers");

			// Rollback on error
			setCurrentMap((prev) => {
				if (!prev) return prev;
				return { ...prev, layers: previousLayers };
			});
		}
	};

	const createNewMap = async (
		name: string,
		description: string,
		permissions: {
			editAccess: "private" | "collaborators" | "public";
			collaborators: string[];
			visibility: "private" | "public";
		},
	) => {
		try {
			// Step 1: Create the map
			const mapData = mapService.transformToMapCreate({
				name,
				description,
				center: [59.3293, 18.0686],
				zoom: 7,
				permissions,
			});

			const createdMap = await mapService.createMap(mapData);

			// Step 2: Add collaborators if any
			if (permissions.collaborators && permissions.collaborators.length > 0) {
				console.log(
					"🔍 Adding collaborators to new map:",
					permissions.collaborators,
				);

				for (const email of permissions.collaborators) {
					try {
						console.log(`➕ Adding collaborator: ${email}`);
						await mapService.addCollaborator(createdMap.id, email, "editor");
						toast.success(`Added ${email} as collaborator`);
					} catch (error) {
						console.error(`❌ Failed to add ${email}:`, error);
						// Throw with a user-friendly message - error will be shown in form
						const errorMessage =
							error instanceof Error ? error.message : "Unknown error";
						throw new Error(
							`Failed to add collaborator "${email}": ${errorMessage}`,
						);
					}
				}
			}

			const userMap = mapService.transformToUserMap(createdMap);

			setMaps((prev) => [...prev, userMap]);
			setCurrentMap(userMap);
			toast.success("Map created successfully");
		} catch (error) {
			console.error("🔴 createNewMap outer catch - error:", error);
			toast.error("Failed to save changes");
			console.error("Create map error:", error);
			throw error; // Re-throw so MapCreationWizard knows it failed
		}
	};

	const editMap = async (
		mapId: string,
		name: string,
		description: string,
		permissions: {
			editAccess: "private" | "collaborators" | "public";
			collaborators: string[];
			visibility: "private" | "public";
		},
	) => {
		try {
			// Step 1: Update map properties
			const mapUpdate = mapService.transformToMapUpdate({
				name,
				description,
				permissions,
			});

			console.log("🔍 Updating map:", mapId);
			console.log("🔍 Update payload:", mapUpdate);

			const updatedMap = await mapService.updateMap(mapId, mapUpdate);

			// Step 2: Sync collaborators with backend
			console.log("🔍 Syncing collaborators:", permissions.collaborators);

			// Get current collaborators from backend
			const currentCollaborators = await mapService.listCollaborators(mapId);
			const currentEmails = new Set(
				currentCollaborators.map((c) => c.user?.email).filter(Boolean),
			);
			const newEmails = new Set(permissions.collaborators);

			// Add new collaborators
			for (const email of permissions.collaborators) {
				if (!currentEmails.has(email)) {
					try {
						console.log(`➕ Adding collaborator: ${email}`);
						await mapService.addCollaborator(mapId, email, "editor");
						toast.success(`Added ${email} as collaborator`);
					} catch (error) {
						console.error(`❌ Failed to add ${email}:`, error);
						// Re-throw with a user-friendly message - error will be shown in form
						const errorMessage =
							error instanceof Error ? error.message : "Unknown error";
						throw new Error(
							`Failed to add collaborator "${email}": ${errorMessage}`,
						);
					}
				}
			}

			// Remove collaborators that were removed
			for (const collab of currentCollaborators) {
				const email = collab.user?.email;
				if (email && !newEmails.has(email)) {
					try {
						console.log(`➖ Removing collaborator: ${email}`);
						await mapService.removeCollaborator(mapId, collab.user_id);
						toast.success(`Removed ${email} from collaborators`);
					} catch (error) {
						console.error(`❌ Failed to remove ${email}:`, error);
						// Don't throw on removal errors, just log
					}
				}
			}

			console.log("✅ Backend response:", updatedMap);

			const userMap = mapService.transformToUserMap(updatedMap);

			setMaps((prev) => prev.map((map) => (map.id === mapId ? userMap : map)));

			// Update current map if it's the one being edited
			if (currentMap?.id === mapId) {
				setCurrentMap(userMap);
			}

			toast.success("Map updated successfully");
		} catch (error) {
			console.error("🔴 editMap outer catch - error:", error);
			toast.error("Failed to save changes");
			throw error; // Re-throw so MapCreationWizard knows it failed
		}
	};

	const deleteMap = async (mapId: string) => {
		try {
			await mapService.deleteMap(mapId);

			// Remove the map from the list
			const remainingMaps = maps.filter((map) => map.id !== mapId);
			setMaps(remainingMaps);

			// If the deleted map was the current map, switch to first available map or null
			if (currentMap?.id === mapId) {
				if (remainingMaps.length > 0) {
					setCurrentMap(remainingMaps[0]);
				} else {
					// Set to null if no maps remain
					setCurrentMap(null);
				}
			}

			toast.success("Map deleted successfully");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			toast.error(`Failed to delete map: ${errorMessage}`);
			console.error("Delete map error:", error);
			throw error; // Re-throw so calling components know it failed
		}
	};

	const addLayerToMap = async (layer: Layer) => {
		if (!currentMap) return;

		// Check if layer already exists in the current map
		const layerExists = currentMap.layers.some((l) => l.id === layer.id);
		if (layerExists) return;

		try {
			// Check if this is an existing library layer or a new map-specific layer
			// Also check isLocalOnly flag - these layers exist in frontend but not backend
			const existsInLibrary = availableLayers.some((l) => l.id === layer.id);
			const needsBackendCreation = !existsInLibrary || layer.isLocalOnly;
			let layerId = layer.id;

			if (needsBackendCreation) {
				// Create new map-specific layer via API (is_global=false by default)
				// These layers are NOT added to the library - they only exist on this map
				const createData = layerService.transformToLayerCreate(layer);
				const createdLayer = await layerService.createLayer(createData);
				const transformedLayer = layerService.transformToLayer(createdLayer);
				layerId = transformedLayer.id;

				// Preserve the original GeoJSON data if present (for drawn layers)
				// The API may not return features immediately after creation
				if (layer.data && !transformedLayer.data) {
					transformedLayer.data = layer.data;
				}

				// Preserve the color from original layer
				if (layer.color) {
					transformedLayer.color = layer.color;
				}

				// Note: We do NOT add to availableLayers here because:
				// - Layers created via LayerCreator are map-specific (is_global=false)
				// - Only Admin Panel layers (is_global=true) belong in the library

				// Update the layer object with the new ID
				layer = transformedLayer;
			}

			// Add layer to map via API
			const displayOrder = currentMap.layers.length;
			await layerService.addLayerToMap(
				currentMap.id,
				layerId,
				displayOrder,
				true,
				70, // Default 70% opacity (backend uses 0-100 range)
			);

			// Update local state
			setCurrentMap((prev) => {
				if (!prev) return prev;
				return {
					...prev,
					layers: [...prev.layers, { ...layer, visible: true, opacity: 0.7 }],
				};
			});

			toast.success("Layer added to map");
		} catch (error) {
			console.error("Failed to add layer to map:", error);
			toast.error("Failed to add layer to map");
		}
	};

	const removeLayerFromMap = async (layerId: string) => {
		if (!currentMap) return;

		try {
			// Call API to remove layer from map
			await layerService.removeLayerFromMap(currentMap.id, layerId);

			// Update local state on success
			setCurrentMap((prev) => {
				if (!prev) return prev;
				return {
					...prev,
					layers: prev.layers.filter((layer) => layer.id !== layerId),
				};
			});

			toast.success("Layer removed from map");
		} catch (error) {
			console.error("Failed to remove layer from map:", error);
			toast.error("Failed to remove layer from map");
		}
	};

	const handleStartDrawing = (
		type:
			| "Point"
			| "Marker"
			| "LineString"
			| "Polygon"
			| "Rectangle"
			| "Circle"
			| "Freehand",
		callback: (feature: unknown) => void,
		color?: string,
	) => {
		setDrawingMode(type);
		setDrawCallback(() => callback);
		// Map Marker to Point for TerraDraw (same underlying mode)
		const isMarker = type === "Marker";
		const terraDrawType = isMarker ? "Point" : type;
		mapViewRef.current?.startDrawing(terraDrawType, color, isMarker);
	};

	const handleSetDrawMode = (
		mode: "select" | "delete" | "delete-selection",
	) => {
		// delete-selection is an action, not a mode - it deletes selected features and stays in select mode
		if (mode === "delete-selection") {
			mapViewRef.current?.setDrawMode(mode);
			// Keep the UI in select mode after the action
			setDrawingMode("select");
		} else {
			setDrawingMode(mode);
			mapViewRef.current?.setDrawMode(mode);
		}
	};

	const handleDrawComplete = useCallback(
		(feature: unknown) => {
			// Track marker feature IDs before calling callback
			if (drawingMode === "Marker") {
				const featureObj = feature as { id?: string | number };
				if (featureObj.id) {
					setMarkerFeatureIds((prev) => {
						const next = new Set(prev);
						next.add(String(featureObj.id));
						return next;
					});
				}
			}
			if (drawCallback) {
				drawCallback(feature);
			}
			setDrawingMode(null);
			setDrawCallback(null);
		},
		[drawCallback, drawingMode],
	);

	// Restore layer to its original position after editing
	const restoreLayerPosition = () => {
		if (!editingLayer || editingLayerOriginalIndex === null) return;

		// Only restore if the layer originally wasn't at index 0
		if (editingLayerOriginalIndex > 0) {
			// Use functional update to get latest state (not stale closure)
			setCurrentMap((prev) => {
				if (!prev) return prev;

				const currentIndex = prev.layers.findIndex(
					(l) => l.id === editingLayer.id,
				);
				// Only move if layer is currently at index 0
				if (currentIndex !== 0) return prev;

				const newLayers = [...prev.layers];
				const [movedLayer] = newLayers.splice(0, 1);
				newLayers.splice(editingLayerOriginalIndex, 0, movedLayer);

				return { ...prev, layers: newLayers };
			});
		}

		setEditingLayerOriginalIndex(null);
	};

	const handleEditLayer = (layer: Layer) => {
		if (!currentMap) return;

		// Clear any previous TerraDraw state to ensure layer stays visible initially
		setTerraDrawSnapshot([]);

		// Find the original index of the layer
		const originalIndex = currentMap.layers.findIndex((l) => l.id === layer.id);
		setEditingLayerOriginalIndex(originalIndex);

		// Move the layer to index 0 (first position) so it renders on top of the map
		// Using same logic as reorderLayers which works correctly
		if (originalIndex > 0) {
			const newLayers = Array.from(currentMap.layers);
			const [removed] = newLayers.splice(originalIndex, 1);
			newLayers.splice(0, 0, removed);
			setCurrentMap((prev) => {
				if (!prev) return prev;
				return { ...prev, layers: newLayers };
			});
		}

		setEditingLayer(layer);
		setShowLayerManager(false);
		setShowLayerCreator(true);
	};

	const handleCreateLayer = async (layer: Layer) => {
		if (!currentMap) {
			toast.error("Please select a map first before creating a layer");
			return;
		}

		try {
			// If editing existing layer, update it
			if (editingLayer) {
				const updateData = layerService.transformToLayerUpdate(layer);
				await layerService.updateLayer(layer.id, updateData);

				// Update local state
				updateLayer(layer.id, layer);
				setAvailableLayers((prev) =>
					prev.map((l) => (l.id === layer.id ? layer : l)),
				);

				toast.success("Layer updated");
			} else {
				// Create new layer and add to map
				await addLayerToMap(layer);
				toast.success("Layer created");
			}

			// Restore layer to original position before clearing editing state
			restoreLayerPosition();
			setShowLayerCreator(false);
			setEditingLayer(null);
			// Clear any TerraDraw drawings after layer is created
			mapViewRef.current?.clearDrawings();
			setTerraDrawSnapshot([]);
		} catch (error) {
			console.error("Layer operation failed:", error);
			toast.error(
				editingLayer ? "Failed to update layer" : "Failed to create layer",
			);
			throw error;
		}
	};

	// WMS GetFeatureInfo handler for queryable WMS layers
	const handleWMSFeatureInfoRequest = useCallback(
		async (
			params: WMSFeatureInfoParams,
		): Promise<WMSFeatureInfoResponse | null> => {
			try {
				const result = await layerService.getWMSFeatureInfo({
					wmsUrl: params.wmsUrl,
					layers: params.layers,
					bbox: params.bbox,
					width: params.width,
					height: params.height,
					x: params.x,
					y: params.y,
					time: params.time,
					version: params.version,
					cqlFilter: params.cqlFilter,
				});
				return result as WMSFeatureInfoResponse;
			} catch (error) {
				console.error("WMS GetFeatureInfo error:", error);
				return null;
			}
		},
		[layerService],
	);

	const handleShareMap = async () => {
		if (!currentMap) {
			toast.error("No map selected to share");
			return;
		}
		try {
			// Create a shareable URL with the map ID
			const shareUrl = `${window.location.origin}${window.location.pathname}?map=${currentMap.id}`;

			// Copy to clipboard
			await navigator.clipboard.writeText(shareUrl);

			toast.success("Map link copied to clipboard!");
		} catch {
			toast.error("Failed to copy link");
		}
	};

	return (
		<div className="h-screen w-screen flex flex-col bg-slate-50">
			{/* Header */}
			<header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<h1
						className="text-teal-500 tracking-tight"
						style={{ fontWeight: 700 }}
					>
						SAMSYN
					</h1>
					<div className="h-4 w-px bg-slate-300" />
					<p className="text-slate-500 text-sm">
						{currentMap?.name || "No Map Selected"}
					</p>
					{currentMap && <RoleBadge role={currentMap.user_role} />}
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant={showMapSelector ? "default" : "outline"}
						size="sm"
						className={
							!showMapSelector
								? "hover:border-teal-400 hover:bg-white hover:text-slate-900"
								: ""
						}
						onClick={() => {
							setShowMapSelector(!showMapSelector);
							if (!showMapSelector) {
								setShowLayerManager(false);
								setShowComments(false);
								setShowLayerCreator(false);
							}
						}}
					>
						<MapIcon className="w-4 h-4" />
						Maps
					</Button>
					<Button
						variant={showLayerManager ? "default" : "outline"}
						size="sm"
						className={
							!showLayerManager
								? "hover:border-teal-400 hover:bg-white hover:text-slate-900"
								: ""
						}
						onClick={() => {
							setShowLayerManager(!showLayerManager);
							if (!showLayerManager) {
								setShowMapSelector(false);
								setShowComments(false);
								setShowLayerCreator(false);
							}
						}}
					>
						<Layers className="w-4 h-4" />
						Layers
					</Button>
					<Button
						variant={showComments ? "default" : "outline"}
						size="sm"
						className={
							!showComments
								? "hover:border-teal-400 hover:bg-white hover:text-slate-900"
								: ""
						}
						onClick={() => {
							setShowComments(!showComments);
							if (!showComments) {
								setShowMapSelector(false);
								setShowLayerManager(false);
								setShowLayerCreator(false);
							}
						}}
					>
						<MessageSquare className="w-4 h-4" />
						Comments
					</Button>
					<Button
						variant={showAdminPanel ? "default" : "outline"}
						size="sm"
						className={
							!showAdminPanel
								? "hover:border-teal-400 hover:bg-white hover:text-slate-900"
								: ""
						}
						onClick={() => {
							setShowLayerManager(false);
							setShowMapSelector(false);
							setShowComments(false);
							setShowLayerCreator(false);
							// Open the admin panel
							setShowAdminPanel(!showAdminPanel);
						}}
					>
						<Shield className="w-4 h-4" />
						Admin
					</Button>
					<div className="h-4 w-px bg-slate-300" />
					<Button
						variant="ghost"
						size="sm"
						className="hover:bg-slate-100"
						onClick={handleShareMap}
					>
						<Share2 className="w-4 h-4" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="hover:bg-slate-100"
						onClick={() => setShowSettings(true)}
					>
						<Settings className="w-4 h-4" />
					</Button>
					<div className="h-4 w-px bg-slate-300" />
					{isClerkConfigured ? (
						<>
							<SignedOut>
								<SignInButton mode="modal">
									<Button
										variant="outline"
										size="sm"
										className="hover:border-teal-400 hover:bg-white hover:text-slate-900"
									>
										Sign In
									</Button>
								</SignInButton>
							</SignedOut>
							<SignedIn>
								<UserButton
									appearance={{
										elements: {
											avatarBox: "w-8 h-8",
										},
									}}
								/>
							</SignedIn>
						</>
					) : (
						<Button
							variant="outline"
							size="sm"
							className="hover:border-teal-400 hover:bg-white hover:text-slate-900"
							onClick={() => {
								toast.info(
									"Clerk authentication is not configured yet. Add VITE_CLERK_PUBLISHABLE_KEY to your .env file.",
								);
							}}
						>
							Sign In
						</Button>
					)}
				</div>
			</header>

			{/* Main Content */}
			<div className="flex-1 flex relative">
				{/* Map */}
				<div className="flex-1 h-full">
					{currentMap ? (
						<MapView
							ref={mapViewRef}
							center={currentMap.center}
							zoom={currentMap.zoom}
							layers={layersWithTemporalData}
							onDrawComplete={handleDrawComplete}
							onTerraDrawChange={setTerraDrawSnapshot}
							drawingMode={drawingMode}
							basemap={basemap}
							onFeatureClick={setHighlightedLayerId}
							highlightedLayerId={highlightedLayerId}
							markerIcon={currentMarkerIcon}
							markerFeatureIds={markerFeatureIds}
							markerColor={currentMarkerColor}
							terraDrawSnapshot={terraDrawSnapshot}
							onWMSFeatureInfoRequest={handleWMSFeatureInfoRequest}
						/>
					) : (
						<div className="flex items-center justify-center h-full bg-slate-100">
							<div className="text-center">
								<p className="text-slate-500 text-lg font-medium">
									No Maps available
								</p>
								<p className="text-slate-400 text-sm mt-2">
									Create a new map to get started
								</p>
							</div>
						</div>
					)}
				</div>

				{/* Side Panels */}
				{showMapSelector && (
					<MapSelector
						maps={maps}
						currentMapId={currentMap?.id || ""}
						loading={mapsLoading}
						onSelectMap={(mapId) => {
							const map = maps.find((m) => m.id === mapId);
							if (map) setCurrentMap(map);
						}}
						onCreateMap={createNewMap}
						onEditMap={editMap}
						onDeleteMap={deleteMap}
						onClose={() => setShowMapSelector(false)}
						onOpenLayerManager={() => {
							setShowMapSelector(false);
							setShowLayerManager(true);
						}}
					/>
				)}

				{showLayerManager && currentMap && (
					<LayerManager
						layers={currentMap.layers}
						availableLayers={availableLayers}
						mapName={currentMap.name}
						basemap={basemap}
						onUpdateLayer={updateLayer}
						onReorderLayers={reorderLayers}
						onAddLayer={addLayerToMap}
						onRemoveLayer={removeLayerFromMap}
						onClose={() => setShowLayerManager(false)}
						onOpenLayerCreator={() => {
							setShowLayerManager(false);
							setShowLayerCreator(true);
						}}
						onChangeBasemap={setBasemap}
						onOpenComments={handleOpenCommentsForLayer}
						getLayerCommentCount={getLayerCommentCount}
						onEditLayer={handleEditLayer}
						highlightedLayerId={highlightedLayerId}
						onSelectLayer={setHighlightedLayerId}
						mapUserRole={currentMap.user_role}
						onZoomToLayer={(bounds) => mapViewRef.current?.zoomToBounds(bounds)}
					/>
				)}

				{showLayerCreator && (
					<LayerCreator
						onCreateLayer={handleCreateLayer}
						onClose={() => {
							// Restore layer to original position before clearing editing state
							restoreLayerPosition();
							setShowLayerCreator(false);
							setEditingLayer(null);
							// Clear any TerraDraw drawings when layer creator is closed
							mapViewRef.current?.clearDrawings();
							setTerraDrawSnapshot([]);
							// Clear marker tracking
							setMarkerFeatureIds(new Set());
						}}
						onStartDrawing={handleStartDrawing}
						onSetDrawMode={handleSetDrawMode}
						onAddFeaturesToMap={(features, color) => {
							const addedIds =
								mapViewRef.current?.addFeatures(features, color) || [];
							// Track marker feature IDs for the overlay layer
							const markerIds: string[] = [];
							features.forEach((f, index) => {
								if (f.type === "Marker" && addedIds[index]) {
									markerIds.push(addedIds[index]);
								}
							});

							if (markerIds.length > 0) {
								setMarkerFeatureIds((prev) => {
									const next = new Set(prev);
									markerIds.forEach((id) => next.add(id));
									return next;
								});
							}
							return addedIds;
						}}
						onRemoveFeatureFromMap={(id) => {
							mapViewRef.current?.removeFeature(id);
							// Remove from marker tracking if it was a marker
							setMarkerFeatureIds((prev) => {
								if (prev.has(id)) {
									const next = new Set(prev);
									next.delete(id);
									return next;
								}
								return prev;
							});
						}}
						onUpdateDrawingStyles={(styles: DrawingStyles) =>
							mapViewRef.current?.updateDrawingStyles(styles)
						}
						onPanToFeature={(coordinates, geometryType) =>
							mapViewRef.current?.panToCoordinates(coordinates, geometryType)
						}
						onSelectFeature={(featureId) =>
							mapViewRef.current?.selectFeature(featureId)
						}
						availableLayers={availableLayers}
						editingLayer={editingLayer}
						drawingMode={drawingMode}
						terraDrawSnapshot={terraDrawSnapshot}
						onMarkerIconChange={setCurrentMarkerIcon}
						onMarkerColorChange={setCurrentMarkerColor}
					/>
				)}

				{showComments && currentMap && (
					<CommentSection
						mapId={currentMap.id}
						mapName={currentMap.name}
						layers={currentMap.layers}
						initialLayerId={selectedLayerIdForComments}
						comments={transformedComments}
						onAddComment={handleAddComment}
						onClose={() => {
							setShowComments(false);
							setSelectedLayerIdForComments(null);
						}}
					/>
				)}

				{showAdminPanel && (
					<AdminPanel
						availableLayers={availableLayers}
						onAddLayer={async (layer) => {
							try {
								// Create layer via API - Admin Panel layers are global (library) layers
								const createData = layerService.transformToLayerCreate(layer, {
									isGlobal: true,
								});
								const createdLayer = await layerService.createLayer(createData);
								const transformedLayer =
									layerService.transformToLayer(createdLayer);

								// Add to available layers (library)
								setAvailableLayers((prev) => [...prev, transformedLayer]);
								toast.success("Layer added to library");
							} catch (error) {
								console.error("Failed to add layer:", error);
								toast.error("Failed to add layer");
							}
						}}
						onRemoveLayer={async (layerId) => {
							try {
								// Delete layer via API
								await layerService.deleteLayer(layerId);

								// Remove from available layers
								setAvailableLayers((prev) =>
									prev.filter((l) => l.id !== layerId),
								);

								// Also remove from current map if it's there
								if (currentMap?.layers.some((l) => l.id === layerId)) {
									await removeLayerFromMap(layerId);
								}

								toast.success("Layer removed from library");
							} catch (error) {
								console.error("Failed to remove layer:", error);
								toast.error("Failed to remove layer");
							}
						}}
						onUpdateLayer={async (layerId, updates) => {
							try {
								// Update layer via API
								const updateData = layerService.transformToLayerUpdate(updates);
								await layerService.updateLayer(layerId, updateData);

								// Update in available layers
								setAvailableLayers((prev) =>
									prev.map((l) =>
										l.id === layerId ? { ...l, ...updates } : l,
									),
								);

								// Also update in current map if it's there
								if (currentMap?.layers.some((l) => l.id === layerId)) {
									updateLayer(layerId, updates);
								}

								toast.success("Layer updated");
							} catch (error) {
								console.error("Failed to update layer:", error);
								toast.error("Failed to update layer");
							}
						}}
						onClose={() => setShowAdminPanel(false)}
					/>
				)}

				{/* Time Slider for temporal layers */}
				{hasTemporalLayers && globalTimeRange && (
					<TimeSlider
						startDate={globalTimeRange.start}
						endDate={globalTimeRange.end}
						currentRange={currentTimeRange}
						onRangeChange={setCurrentTimeRange}
					/>
				)}
			</div>

			{/* Settings Dialog */}
			<SettingsDialog
				open={showSettings}
				onOpenChange={setShowSettings}
				isClerkConfigured={isClerkConfigured}
			/>

			<Toaster />
		</div>
	);
}

export default function App() {
	// Only wrap with ClerkProvider if Clerk is properly configured
	if (isClerkConfigured) {
		return (
			<ClerkProvider publishableKey={clerkPubKey}>
				<AppContent />
			</ClerkProvider>
		);
	}

	// If Clerk is not configured, render app without authentication
	return <AppContent />;
}
