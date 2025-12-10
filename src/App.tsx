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
	MapView,
	type MapViewRef,
	type TerraDrawFeature,
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
	// WMS properties
	wmsUrl?: string;
	wmsLayerName?: string;
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
		"Point" | "LineString" | "Polygon" | "select" | "delete" | null
	>(null);
	const [drawCallback, setDrawCallback] = useState<
		((feature: unknown) => void) | null
	>(null);
	const [selectedLayerIdForComments, setSelectedLayerIdForComments] = useState<
		string | null
	>(null);
	const [editingLayer, setEditingLayer] = useState<Layer | null>(null);
	const [showSettings, setShowSettings] = useState(false);
	const [comments, setComments] = useState<CommentResponse[]>([]);
	const [highlightedLayerId, setHighlightedLayerId] = useState<string | null>(
		null,
	);
	const [terraDrawSnapshot, setTerraDrawSnapshot] = useState<
		TerraDrawFeature[]
	>([]);
	const mapViewRef = useRef<MapViewRef>(null);

	// Initialize services
	const commentService = useCommentService();
	const layerService = useLayerService();
	const mapService = useMapService();

	// Function to load layers from API
	const loadLayers = useCallback(async () => {
		setLayersLoading(true);
		try {
			const layerList = await layerService.listLayers();
			// Transform each layer to frontend format
			const layers = await Promise.all(
				layerList.map(async (listItem) => {
					const fullLayer = await layerService.getLayer(listItem.id);
					return layerService.transformToLayer(fullLayer);
				}),
			);
			setAvailableLayers(layers);
		} catch (error) {
			console.error("Failed to load layers:", error);
			toast.error("Failed to load layer library");
		} finally {
			setLayersLoading(false);
		}
	}, [layerService]);

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
		new Date("2023-04-01"),
		new Date("2023-10-01"),
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
	const layersWithTemporalData = useMemo(() => {
		if (!currentMap) return [];
		return currentMap.layers.map((layer) => {
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
	}, [currentMap, currentTimeRange]);

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
			// If layer doesn't exist in availableLayers, create it first
			const existsInAvailable = availableLayers.some((l) => l.id === layer.id);
			let layerId = layer.id;

			if (!existsInAvailable) {
				// Create new layer via API
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

				// Add to available layers
				setAvailableLayers((prev) => [...prev, transformedLayer]);

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
		type: "Point" | "LineString" | "Polygon",
		callback: (feature: unknown) => void,
		color?: string,
	) => {
		setDrawingMode(type);
		setDrawCallback(() => callback);
		mapViewRef.current?.startDrawing(type, color);
	};

	const handleSetDrawMode = (mode: "select" | "delete") => {
		setDrawingMode(mode);
		mapViewRef.current?.setDrawMode(mode);
	};

	const handleDrawComplete = useCallback(
		(feature: unknown) => {
			if (drawCallback) {
				drawCallback(feature);
			}
			setDrawingMode(null);
			setDrawCallback(null);
		},
		[drawCallback],
	);

	const handleEditLayer = (layer: Layer) => {
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

			setShowLayerCreator(false);
			setEditingLayer(null);
			// Clear any TerraDraw drawings after layer is created
			mapViewRef.current?.clearDrawings();
		} catch (error) {
			console.error("Layer operation failed:", error);
			toast.error(
				editingLayer ? "Failed to update layer" : "Failed to create layer",
			);
			throw error;
		}
	};

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
					/>
				)}

				{showLayerCreator && (
					<LayerCreator
						onCreateLayer={handleCreateLayer}
						onClose={() => {
							setShowLayerCreator(false);
							setEditingLayer(null);
							// Clear any TerraDraw drawings when layer creator is closed
							mapViewRef.current?.clearDrawings();
							setTerraDrawSnapshot([]);
						}}
						onStartDrawing={handleStartDrawing}
						onSetDrawMode={handleSetDrawMode}
						onAddFeaturesToMap={(features, color) =>
							mapViewRef.current?.addFeatures(features, color) || []
						}
						availableLayers={availableLayers}
						editingLayer={editingLayer}
						drawingMode={drawingMode}
						terraDrawSnapshot={terraDrawSnapshot}
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
								// Create layer via API
								const createData = layerService.transformToLayerCreate(layer);
								const createdLayer = await layerService.createLayer(createData);
								const transformedLayer =
									layerService.transformToLayer(createdLayer);

								// Add to available layers
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
