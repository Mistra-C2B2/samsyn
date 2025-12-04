import { toast } from "sonner@2.0.3";
import {
	ClerkProvider,
	SignedIn,
	SignedOut,
	SignInButton,
	UserButton,
} from "@clerk/clerk-react";
import {
	Layers,
	Map,
	MessageSquare,
	Settings,
	Share2,
	Shield,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminPanel } from "./components/AdminPanel";
import { CommentSection } from "./components/CommentSection";
import { LayerCreator } from "./components/LayerCreator";
import { LayerManager } from "./components/LayerManager";
import { MapSelector } from "./components/MapSelector";
import { MapView, type MapViewRef } from "./components/MapView";
import { RoleBadge } from "./components/RoleBadge";
import { SettingsDialog } from "./components/SettingsDialog";
import { TimeSlider } from "./components/TimeSlider";
import { Button } from "./components/ui/button";
import { Toaster } from "./components/ui/sonner";
import { useCommentService } from "./services/commentService";
import { useMapService } from "./services/mapService";
import type { CommentResponse } from "./types/api";

// Get Clerk publishable key from environment variables
// Make sure to set VITE_CLERK_PUBLISHABLE_KEY in your .env file
const clerkPubKey =
	(typeof import.meta !== "undefined" &&
		import.meta.env?.VITE_CLERK_PUBLISHABLE_KEY) ||
	"";

// Check if Clerk is properly configured
const isClerkConfigured = clerkPubKey && clerkPubKey.startsWith("pk_");

export interface Layer {
	id: string;
	name: string;
	type: "geojson" | "heatmap" | "markers" | "raster" | "vector";
	visible: boolean;
	opacity: number;
	data?: any;
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
	features?: any[];
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
		data: any;
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
	const [mapsError, setMapsError] = useState<string | null>(null);
	const [showLayerManager, setShowLayerManager] = useState(true);
	const [showMapSelector, setShowMapSelector] = useState(false);
	const [showComments, setShowComments] = useState(false);
	const [showLayerCreator, setShowLayerCreator] = useState(false);
	const [showAdminPanel, setShowAdminPanel] = useState(false);
	const [availableLayers, setAvailableLayers] = useState<Layer[]>([]);
	const [basemap, setBasemap] = useState<string>("osm");
	const [drawingMode, setDrawingMode] = useState<
		"Point" | "LineString" | "Polygon" | null
	>(null);
	const [drawCallback, setDrawCallback] = useState<
		((feature: any) => void) | null
	>(null);
	const [selectedLayerIdForComments, setSelectedLayerIdForComments] = useState<
		string | null
	>(null);
	const [editingLayer, setEditingLayer] = useState<Layer | null>(null);
	const [showSettings, setShowSettings] = useState(false);
	const [comments, setComments] = useState<CommentResponse[]>([]);
	const [commentsLoading, setCommentsLoading] = useState(false);
	const [commentsError, setCommentsError] = useState<string | null>(null);
	const mapViewRef = useRef<MapViewRef>(null);

	// Initialize services
	const commentService = useCommentService();
	const mapService = useMapService();

	// Load maps on component mount
	useEffect(() => {
		loadMaps();
	}, []);

	// Load comments when map changes
	useEffect(() => {
		if (currentMap?.id) {
			loadComments(currentMap.id);
		}
	}, [currentMap?.id]);

	// Function to load maps from API
	const loadMaps = async () => {
		setMapsLoading(true);
		setMapsError(null);
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
		} catch (error: any) {
			setMapsError(error.message);
			toast.error("Failed to load maps");
			// Set to empty state on error
			setMaps([]);
			setCurrentMap(null);
		} finally {
			setMapsLoading(false);
		}
	};

	// Function to load comments from API
	const loadComments = async (mapId: string) => {
		setCommentsLoading(true);
		setCommentsError(null);
		try {
			const data = await commentService.listComments({ map_id: mapId });
			setComments(data);
		} catch (error: any) {
			setCommentsError(error.message);
			toast.error("Failed to load comments");
		} finally {
			setCommentsLoading(false);
		}
	};

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
	}, [currentMap?.layers]);

	// Calculate overall time range from all temporal layers
	const globalTimeRange = useMemo(() => {
		if (!currentMap) return null;
		const temporalLayers = currentMap.layers.filter(
			(layer) => layer.temporal && layer.visible && layer.timeRange,
		);
		if (temporalLayers.length === 0) return null;

		let minStart = temporalLayers[0].timeRange!.start;
		let maxEnd = temporalLayers[0].timeRange!.end;

		temporalLayers.forEach((layer) => {
			if (layer.timeRange!.start < minStart) minStart = layer.timeRange!.start;
			if (layer.timeRange!.end > maxEnd) maxEnd = layer.timeRange!.end;
		});

		return { start: minStart, end: maxEnd };
	}, [currentMap?.layers]);

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
	}, [currentMap?.layers, currentTimeRange]);

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
		} catch (error: any) {
			toast.error("Failed to add comment: " + error.message);
		}
	};

	const updateLayer = (layerId: string, updates: Partial<Layer>) => {
		setCurrentMap((prev) => {
			if (!prev) return prev;
			return {
				...prev,
				layers: prev.layers.map((layer) =>
					layer.id === layerId ? { ...layer, ...updates } : layer,
				),
			};
		});
	};

	const reorderLayers = (startIndex: number, endIndex: number) => {
		setCurrentMap((prev) => {
			if (!prev) return prev;
			const newLayers = Array.from(prev.layers);
			const [removed] = newLayers.splice(startIndex, 1);
			newLayers.splice(endIndex, 0, removed);
			return { ...prev, layers: newLayers };
		});
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
						await mapService.addCollaborator(createdMap.id, email, "viewer");
						toast.success(`Added ${email} as collaborator`);
					} catch (error: any) {
						console.error(`❌ Failed to add ${email}:`, error);
						// Throw with a user-friendly message - error will be shown in form
						throw new Error(
							`Failed to add collaborator "${email}": ${error.message}`,
						);
					}
				}
			}

			const userMap = mapService.transformToUserMap(createdMap);

			setMaps((prev) => [...prev, userMap]);
			setCurrentMap(userMap);
			toast.success("Map created successfully");
		} catch (error: any) {
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
						await mapService.addCollaborator(mapId, email, "viewer");
						toast.success(`Added ${email} as collaborator`);
					} catch (error: any) {
						console.error(`❌ Failed to add ${email}:`, error);
						// Re-throw with a user-friendly message - error will be shown in form
						throw new Error(
							`Failed to add collaborator "${email}": ${error.message}`,
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
					} catch (error: any) {
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
		} catch (error: any) {
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
		} catch (error: any) {
			toast.error("Failed to delete map: " + error.message);
			console.error("Delete map error:", error);
			throw error; // Re-throw so calling components know it failed
		}
	};

	const addLayerToMap = (layer: Layer) => {
		if (!currentMap) return;

		// Check if layer already exists in the current map
		const layerExists = currentMap.layers.some((l) => l.id === layer.id);
		if (layerExists) return;

		setCurrentMap((prev) => {
			if (!prev) return prev;
			return {
				...prev,
				layers: [...prev.layers, { ...layer, visible: true }],
			};
		});

		// Add to available layers if it's a new custom layer
		const existsInAvailable = availableLayers.some((l) => l.id === layer.id);
		if (!existsInAvailable) {
			setAvailableLayers((prev) => [...prev, layer]);
		}
	};

	const removeLayerFromMap = (layerId: string) => {
		setCurrentMap((prev) => {
			if (!prev) return prev;
			return {
				...prev,
				layers: prev.layers.filter((layer) => layer.id !== layerId),
			};
		});
	};

	const handleStartDrawing = (
		type: "Point" | "LineString" | "Polygon",
		callback: (feature: any) => void,
	) => {
		setDrawingMode(type);
		setDrawCallback(() => callback);
		mapViewRef.current?.startDrawing(type);
	};

	const handleDrawComplete = (feature: any) => {
		if (drawCallback) {
			drawCallback(feature);
		}
		setDrawingMode(null);
		setDrawCallback(null);
	};

	const handleEditLayer = (layer: Layer) => {
		setEditingLayer(layer);
		setShowLayerManager(false);
		setShowLayerCreator(true);
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
		} catch (error) {
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
						<Map className="w-4 h-4" />
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
				<div className="flex-1">
					{currentMap ? (
						<MapView
							ref={mapViewRef}
							center={currentMap.center}
							zoom={currentMap.zoom}
							layers={layersWithTemporalData}
							onDrawComplete={handleDrawComplete}
							drawingMode={drawingMode}
							basemap={basemap}
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
					/>
				)}

				{showLayerCreator && (
					<LayerCreator
						onCreateLayer={(layer) => {
							if (editingLayer) {
								// Update existing layer
								updateLayer(layer.id, layer);
								// Also update in availableLayers
								setAvailableLayers((prev) =>
									prev.map((l) => (l.id === layer.id ? layer : l)),
								);
							} else {
								// Add new layer
								addLayerToMap(layer);
							}
							setShowLayerCreator(false);
							setEditingLayer(null);
						}}
						onClose={() => {
							setShowLayerCreator(false);
							setEditingLayer(null);
						}}
						onStartDrawing={handleStartDrawing}
						availableLayers={availableLayers}
						editingLayer={editingLayer}
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
						onAddLayer={(layer) => {
							setAvailableLayers((prev) => [...prev, layer]);
						}}
						onRemoveLayer={(layerId) => {
							setAvailableLayers((prev) =>
								prev.filter((l) => l.id !== layerId),
							);
							// Also remove from current map if it's there
							removeLayerFromMap(layerId);
						}}
						onUpdateLayer={(layerId, updates) => {
							setAvailableLayers((prev) =>
								prev.map((l) => (l.id === layerId ? { ...l, ...updates } : l)),
							);
							// Also update in current map if it's there
							if (currentMap) {
								const layerInMap = currentMap.layers.find(
									(l) => l.id === layerId,
								);
								if (layerInMap) {
									updateLayer(layerId, updates);
								}
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
