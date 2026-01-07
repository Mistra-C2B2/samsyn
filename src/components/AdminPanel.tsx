import { FileJson, Globe, Image, Loader2, Plus, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Layer } from "../App";
import { useAdminLayerForm } from "../hooks/admin-layer-form";
import type { WmsServer } from "../services/wmsServerService";
import type { WmsLayerInfo, WmsServerLayersResponse } from "../types/api";
import {
	AdminPanelTabs,
	type AdminTab,
	GeoTiffLayerForm,
	LayerLibraryList,
	LayerMetadataFields,
	VectorLayerForm,
	WmsServerForm,
	WmsServerLayerBrowser,
	WmsServerList,
} from "./admin";
import { Button } from "./ui/button";

// ============================================================================
// Types
// ============================================================================

interface AdminPanelProps {
	availableLayers: Layer[];
	onAddLayer: (layer: Layer) => void | Promise<void>;
	onRemoveLayer: (layerId: string) => void | Promise<void>;
	onUpdateLayer: (
		layerId: string,
		updates: Partial<Layer>,
	) => void | Promise<void>;
	onClose: () => void;
	// Preview layer support
	onPreviewLayer?: (layer: Layer | null) => void;
	// WMS Server props
	wmsServers: WmsServer[];
	onAddWmsServer: (data: {
		name: string;
		baseUrl: string;
		description?: string;
	}) => Promise<WmsServer>;
	onRemoveWmsServer: (serverId: string) => void | Promise<void>;
	onUpdateWmsServer: (
		serverId: string,
		updates: { name?: string; description?: string },
	) => void | Promise<void>;
	onRefreshWmsServer: (serverId: string) => Promise<WmsServer>;
	onGetWmsServerLayers: (serverId: string) => Promise<WmsServerLayersResponse>;
}

// ============================================================================
// Component
// ============================================================================

export function AdminPanel({
	availableLayers,
	onAddLayer,
	onRemoveLayer,
	onUpdateLayer,
	onClose,
	onPreviewLayer,
	wmsServers,
	onAddWmsServer,
	onRemoveWmsServer,
	onUpdateWmsServer,
	onRefreshWmsServer,
	onGetWmsServerLayers,
}: AdminPanelProps) {
	// Tab state
	const [activeTab, setActiveTab] = useState<AdminTab>("wms-servers");

	// Filter layers by type
	const libraryLayers = availableLayers.filter((layer) => layer.isGlobal);
	const communityLayers = availableLayers.filter((layer) => !layer.isGlobal);

	// Layer view state
	const [showAddLayerForm, setShowAddLayerForm] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [layerToDelete, setLayerToDelete] = useState<Layer | null>(null);

	// WMS layer creation flow state
	const [wmsLayerStep, setWmsLayerStep] = useState<
		"select-server" | "select-layer" | "configure"
	>("select-server");
	const [selectedWmsServer, setSelectedWmsServer] = useState<WmsServer | null>(
		null,
	);

	// WMS Server view state
	const [wmsServerView, setWmsServerView] = useState<
		"list" | "add" | "edit" | "browse"
	>("list");
	const [editingServer, setEditingServer] = useState<WmsServer | null>(null);
	const [browsingServer, setBrowsingServer] = useState<WmsServer | null>(null);
	const [serverToDelete, setServerToDelete] = useState<WmsServer | null>(null);
	const [refreshingServerId, setRefreshingServerId] = useState<string | null>(
		null,
	);

	// Form state via composed hooks
	const form = useAdminLayerForm();

	// Get unique categories from existing layers
	const existingCategories = Array.from(
		new Set(
			availableLayers.map((l) => l.category).filter((c): c is string => !!c),
		),
	).sort();

	// Layer Handlers
	const handleStartAddLayer = (source: "wms" | "geotiff" | "vector") => {
		form.resetForm();
		form.setLayerSource(source);
		if (source === "wms") {
			// Start WMS flow at server selection
			setWmsLayerStep("select-server");
			setSelectedWmsServer(null);
		}
		setShowAddLayerForm(true);
	};

	const handleEditLayer = (layer: Layer) => {
		form.loadLayerForEdit(layer);
		setShowAddLayerForm(true);
	};

	const handleCancelLayerForm = () => {
		setShowAddLayerForm(false);
		form.resetForm();
		setWmsLayerStep("select-server");
		setSelectedWmsServer(null);
		// Clear any preview layer
		onPreviewLayer?.(null);
	};

	// Handle preview for vector/GeoJSON layers
	const handleVectorPreview = () => {
		if (!form.vector.isValid || !form.vector.parsedGeoJson) return;

		const newShowPreview = !form.vector.showPreview;
		form.vector.setShowPreview(newShowPreview);

		if (newShowPreview) {
			// Turning preview ON
			const previewLayer: Layer = {
				id: "__preview__",
				name: form.metadata.name || "Preview",
				type: "geojson",
				visible: true,
				opacity: 1,
				data: form.vector.parsedGeoJson,
				color: form.vector.styling.color,
				lineWidth: form.vector.styling.lineWidth,
				fillPolygons: form.vector.styling.fillPolygons,
			};
			onPreviewLayer?.(previewLayer);
		} else {
			// Turning preview OFF
			onPreviewLayer?.(null);
		}
	};

	// Auto-update preview when styling changes
	useEffect(() => {
		// Only update if preview is already showing and we have valid GeoJSON
		if (
			form.vector.showPreview &&
			form.vector.isValid &&
			form.vector.parsedGeoJson
		) {
			const updatedPreview: Layer = {
				id: "__preview__",
				name: form.metadata.name || "Preview",
				type: "geojson",
				visible: true,
				opacity: 1,
				data: form.vector.parsedGeoJson,
				color: form.vector.styling.color,
				lineWidth: form.vector.styling.lineWidth,
				fillPolygons: form.vector.styling.fillPolygons,
			};
			onPreviewLayer?.(updatedPreview);
		}
	}, [
		form.vector.styling.color,
		form.vector.styling.lineWidth,
		form.vector.styling.fillPolygons,
		form.vector.showPreview,
		form.vector.isValid,
		form.vector.parsedGeoJson,
		form.metadata.name,
		onPreviewLayer,
	]);

	const handleSubmitLayer = async () => {
		const layerData = form.buildLayer();
		if (!layerData) {
			if (form.layerSource === "vector" && !form.vector.isValid) {
				alert("Please provide valid GeoJSON data");
			} else {
				alert("Please enter a layer name");
			}
			return;
		}

		setIsSaving(true);

		try {
			if (form.editingLayerId) {
				await onUpdateLayer(form.editingLayerId, layerData);
			} else {
				const newLayer: Layer = {
					id: crypto.randomUUID(),
					...layerData,
				};
				await onAddLayer(newLayer);
			}

			form.resetForm();
			setShowAddLayerForm(false);
			// Clear preview after successful save
			onPreviewLayer?.(null);
		} catch (error) {
			console.error("Failed to save layer:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleDeleteLayerConfirm = () => {
		if (layerToDelete) {
			onRemoveLayer(layerToDelete.id);
			setLayerToDelete(null);
		}
	};

	// WMS Server Handlers
	const handleStartAddServer = () => {
		setEditingServer(null);
		setWmsServerView("add");
	};

	const handleEditServer = (server: WmsServer) => {
		setEditingServer(server);
		setWmsServerView("edit");
	};

	const handleBrowseLayers = (server: WmsServer) => {
		setBrowsingServer(server);
		setWmsServerView("browse");
	};

	// WMS Layer creation flow handlers
	const handleSelectWmsServer = (server: WmsServer) => {
		setSelectedWmsServer(server);
		setWmsLayerStep("select-layer");
	};

	const handleSelectWmsLayerFromBrowser = (
		server: WmsServer,
		layer: WmsLayerInfo,
	) => {
		// Pre-fill the form with the selected WMS layer
		form.wms.setUrl(server.baseUrl);
		form.wms.setLayerName(layer.name);

		// Set metadata from layer
		form.metadata.setName(layer.title || layer.name);
		if (layer.abstract) {
			form.metadata.setDescription(layer.abstract);
		}
		if (server.serviceProvider) {
			form.metadata.setAuthor(server.serviceProvider);
		}

		// Set legend from first style if available
		if (layer.styles.length > 0 && layer.styles[0].legendUrl) {
			form.legend.setLegendSource("wms");
			form.legend.setWmsLegend(layer.styles[0].legendUrl);
		}

		// Move to configure step
		setWmsLayerStep("configure");
	};

	const handleBackFromWmsLayerSelect = () => {
		setSelectedWmsServer(null);
		setWmsLayerStep("select-server");
	};

	const handleBackFromWmsConfigure = () => {
		setWmsLayerStep("select-layer");
	};

	const handleRefreshServer = async (server: WmsServer) => {
		setRefreshingServerId(server.id);
		try {
			await onRefreshWmsServer(server.id);
		} finally {
			setRefreshingServerId(null);
		}
	};

	const handleDeleteServerConfirm = () => {
		if (serverToDelete) {
			onRemoveWmsServer(serverToDelete.id);
			setServerToDelete(null);
		}
	};

	const handleServerFormSubmit = async (data: {
		name: string;
		baseUrl: string;
		description?: string;
	}) => {
		if (editingServer) {
			// Update existing server (only name and description can be changed)
			await onUpdateWmsServer(editingServer.id, {
				name: data.name,
				description: data.description,
			});
			return editingServer;
		}
		// Create new server
		return await onAddWmsServer(data);
	};

	const handleServerFormCancel = () => {
		setEditingServer(null);
		setWmsServerView("list");
	};

	const handleSelectLayerFromServer = (
		server: WmsServer,
		layer: WmsLayerInfo,
	) => {
		// Pre-fill the layer form with the selected WMS layer
		form.resetForm();
		form.setLayerSource("wms");

		// Set WMS URL and trigger capability state
		form.wms.setUrl(server.baseUrl);

		// Set the available layers from server cache (simulated)
		// The form will handle setting the layer details
		form.wms.setLayerName(layer.name);

		// Set metadata from layer
		form.metadata.setName(layer.title || layer.name);
		if (layer.abstract) {
			form.metadata.setDescription(layer.abstract);
		}
		if (server.serviceProvider) {
			form.metadata.setAuthor(server.serviceProvider);
		}

		// Set WMS-specific data
		if (layer.queryable !== undefined) {
			// The form handles queryable through availableLayers selection
		}

		// Set legend from first style if available
		if (layer.styles.length > 0 && layer.styles[0].legendUrl) {
			form.legend.setLegendSource("wms");
			form.legend.setWmsLegend(layer.styles[0].legendUrl);
		}

		// Switch to layer form
		setShowAddLayerForm(true);
		setActiveTab("library-layers");
		setWmsServerView("list");
		setBrowsingServer(null);
	};

	// Render WMS Servers tab content
	const renderWmsServersContent = () => {
		switch (wmsServerView) {
			case "add":
			case "edit":
				return (
					<WmsServerForm
						editingServer={editingServer}
						onSubmit={handleServerFormSubmit}
						onCancel={handleServerFormCancel}
					/>
				);
			case "browse":
				if (!browsingServer) return null;
				return (
					<WmsServerLayerBrowser
						server={browsingServer}
						onSelectLayer={handleSelectLayerFromServer}
						onBack={() => {
							setBrowsingServer(null);
							setWmsServerView("list");
						}}
						onLoadLayers={onGetWmsServerLayers}
					/>
				);
			default:
				return (
					<>
						{/* Add Server Button */}
						<div className="px-4 py-3 border-b border-slate-200">
							<Button
								onClick={handleStartAddServer}
								className="w-full"
								size="sm"
							>
								<Plus className="w-4 h-4 mr-2" />
								Add WMS Server
							</Button>
						</div>

						{/* Server List */}
						<WmsServerList
							servers={wmsServers}
							serverToDelete={serverToDelete}
							refreshingServerId={refreshingServerId}
							onBrowseLayers={handleBrowseLayers}
							onEdit={handleEditServer}
							onRefresh={handleRefreshServer}
							onDeleteRequest={setServerToDelete}
							onDeleteConfirm={handleDeleteServerConfirm}
							onDeleteCancel={() => setServerToDelete(null)}
						/>
					</>
				);
		}
	};

	// Render WMS server selection for layer creation
	const renderWmsServerSelection = () => (
		<>
			<div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
				<Button variant="outline" onClick={handleCancelLayerForm} size="sm">
					← Back
				</Button>
				<span className="text-sm font-medium text-slate-700">
					Select WMS Server
				</span>
			</div>
			<div className="flex-1 overflow-y-auto">
				{wmsServers.length === 0 ? (
					<div className="p-8 text-center">
						<Globe className="w-12 h-12 text-slate-300 mx-auto mb-3" />
						<p className="text-sm text-slate-600 mb-2">
							No WMS servers configured
						</p>
						<p className="text-xs text-slate-500 mb-4">
							Add a WMS server first in the "WMS Servers" tab
						</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								handleCancelLayerForm();
								setActiveTab("wms-servers");
								handleStartAddServer();
							}}
						>
							<Plus className="w-4 h-4 mr-2" />
							Add WMS Server
						</Button>
					</div>
				) : (
					wmsServers.map((server) => (
						<button
							key={server.id}
							type="button"
							onClick={() => handleSelectWmsServer(server)}
							className="w-full text-left border-b border-slate-200 p-4 hover:bg-teal-50 transition-colors"
						>
							<div className="flex items-center gap-3">
								<Globe className="w-5 h-5 text-teal-600 flex-shrink-0" />
								<div className="flex-1 min-w-0">
									<h4 className="font-medium text-slate-900 text-sm truncate">
										{server.name}
									</h4>
									<p className="text-xs text-slate-500 truncate">
										{server.baseUrl}
									</p>
									<p className="text-xs text-slate-400 mt-1">
										{server.layerCount} layers available
									</p>
								</div>
							</div>
						</button>
					))
				)}
			</div>
		</>
	);

	// Render WMS layer configuration form
	const renderWmsLayerConfigForm = () => (
		<>
			<div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
				<Button
					variant="outline"
					onClick={handleBackFromWmsConfigure}
					size="sm"
				>
					← Back
				</Button>
				<span className="text-sm font-medium text-slate-700">
					Configure Layer
				</span>
			</div>

			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{/* Show selected layer info */}
				<div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
					<p className="text-xs text-teal-600 font-medium">Selected Layer</p>
					<p className="text-sm text-teal-900 font-medium">
						{form.wms.layerName}
					</p>
					<p className="text-xs text-teal-700 truncate">{form.wms.url}</p>
				</div>

				{/* Metadata Fields */}
				<LayerMetadataFields
					name={form.metadata.name}
					description={form.metadata.description}
					author={form.metadata.author}
					category={form.metadata.category}
					existingCategories={existingCategories}
					onNameChange={form.metadata.setName}
					onDescriptionChange={form.metadata.setDescription}
					onAuthorChange={form.metadata.setAuthor}
					onCategoryChange={form.metadata.setCategory}
				/>
			</div>

			<div className="p-4 border-t border-slate-200">
				<Button
					onClick={handleSubmitLayer}
					className="w-full"
					disabled={!form.isValid || isSaving}
				>
					{isSaving ? (
						<Loader2 className="w-4 h-4 mr-2 animate-spin" />
					) : (
						<Save className="w-4 h-4 mr-2" />
					)}
					Add to Library
				</Button>
			</div>
		</>
	);

	// Render Library Layers tab content
	const renderLibraryLayersContent = () => {
		if (!showAddLayerForm) {
			return (
				<>
					{/* Add Layer Buttons */}
					<div className="px-4 py-3 border-b border-slate-200 space-y-2">
						<p className="text-xs text-slate-500 font-medium mb-2">
							Add New Layer
						</p>
						<div className="grid grid-cols-3 gap-2">
							<Button
								onClick={() => handleStartAddLayer("wms")}
								variant="outline"
								size="sm"
								className="flex flex-col items-center gap-1 h-auto py-3"
							>
								<Globe className="w-5 h-5 text-teal-600" />
								<span className="text-xs">WMS</span>
							</Button>
							<Button
								onClick={() => handleStartAddLayer("vector")}
								variant="outline"
								size="sm"
								className="flex flex-col items-center gap-1 h-auto py-3"
							>
								<FileJson className="w-5 h-5 text-blue-600" />
								<span className="text-xs">GeoJSON</span>
							</Button>
							<Button
								onClick={() => handleStartAddLayer("geotiff")}
								variant="outline"
								size="sm"
								className="flex flex-col items-center gap-1 h-auto py-3"
							>
								<Image className="w-5 h-5 text-purple-600" />
								<span className="text-xs">GeoTIFF</span>
							</Button>
						</div>
					</div>

					{/* Layer List */}
					<LayerLibraryList
						layers={libraryLayers}
						layerToDelete={layerToDelete}
						onEdit={handleEditLayer}
						onDeleteRequest={setLayerToDelete}
						onDeleteConfirm={handleDeleteLayerConfirm}
						onDeleteCancel={() => setLayerToDelete(null)}
						title="Library Layers"
						subtitle="Library layer"
						emptyMessage="No layers in library"
					/>
				</>
			);
		}

		// WMS layer creation flow
		if (form.layerSource === "wms" && !form.editingLayerId) {
			if (wmsLayerStep === "select-server") {
				return renderWmsServerSelection();
			}
			if (wmsLayerStep === "select-layer" && selectedWmsServer) {
				return (
					<WmsServerLayerBrowser
						server={selectedWmsServer}
						onSelectLayer={handleSelectWmsLayerFromBrowser}
						onBack={handleBackFromWmsLayerSelect}
						onLoadLayers={onGetWmsServerLayers}
					/>
				);
			}
			if (wmsLayerStep === "configure") {
				return renderWmsLayerConfigForm();
			}
		}

		// Non-WMS layer forms or editing existing layer
		const formTitle = form.editingLayerId
			? "Edit Layer"
			: form.layerSource === "vector"
				? "Add GeoJSON Layer"
				: "Add GeoTIFF Layer";

		return (
			<>
				{/* Back Button and Title */}
				<div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
					<Button variant="outline" onClick={handleCancelLayerForm} size="sm">
						← Back
					</Button>
					<span className="text-sm font-medium text-slate-700">
						{formTitle}
					</span>
				</div>

				{/* Form Content */}
				<div className="flex-1 overflow-y-auto p-4 space-y-4">
					{form.layerSource === "geotiff" && (
						<GeoTiffLayerForm
							url={form.geotiff.url}
							onUrlChange={form.geotiff.setUrl}
						/>
					)}

					{form.layerSource === "vector" && (
						<VectorLayerForm
							form={form.vector}
							onPreview={handleVectorPreview}
						/>
					)}

					{/* For editing WMS layers, show a simplified view */}
					{form.layerSource === "wms" && form.editingLayerId && (
						<div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
							<p className="text-xs text-teal-600 font-medium">WMS Layer</p>
							<p className="text-sm text-teal-900 font-medium">
								{form.wms.layerName}
							</p>
							<p className="text-xs text-teal-700 truncate">{form.wms.url}</p>
						</div>
					)}

					{/* Metadata Fields */}
					<LayerMetadataFields
						name={form.metadata.name}
						description={form.metadata.description}
						author={form.metadata.author}
						category={form.metadata.category}
						existingCategories={existingCategories}
						onNameChange={form.metadata.setName}
						onDescriptionChange={form.metadata.setDescription}
						onAuthorChange={form.metadata.setAuthor}
						onCategoryChange={form.metadata.setCategory}
					/>
				</div>

				{/* Submit Button */}
				<div className="p-4 border-t border-slate-200">
					<Button
						onClick={handleSubmitLayer}
						className="w-full"
						disabled={!form.isValid || isSaving}
					>
						{isSaving ? (
							<Loader2 className="w-4 h-4 mr-2 animate-spin" />
						) : (
							<Save className="w-4 h-4 mr-2" />
						)}
						{form.editingLayerId ? "Update Layer" : "Add to Library"}
					</Button>
				</div>
			</>
		);
	};

	// Render Community Layers tab content
	const renderCommunityLayersContent = () => {
		return (
			<LayerLibraryList
				layers={communityLayers}
				layerToDelete={layerToDelete}
				onEdit={handleEditLayer}
				onDeleteRequest={setLayerToDelete}
				onDeleteConfirm={handleDeleteLayerConfirm}
				onDeleteCancel={() => setLayerToDelete(null)}
				title="Community Layers"
				subtitle="Community layer"
				emptyMessage="No community layers yet"
			/>
		);
	};

	return (
		<div className="absolute left-0 top-0 bottom-0 w-96 bg-white border-r border-slate-200 flex flex-col shadow-lg z-50">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-teal-50">
				<div>
					<h2 className="text-slate-900">Admin Panel</h2>
					<p className="text-xs text-slate-600">Manage WMS servers & layers</p>
				</div>
				<Button variant="ghost" size="sm" onClick={onClose}>
					<X className="w-4 h-4" />
				</Button>
			</div>

			{/* Tabs */}
			<AdminPanelTabs activeTab={activeTab} onTabChange={setActiveTab} />

			{/* Tab Content */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{activeTab === "wms-servers" && renderWmsServersContent()}
				{activeTab === "library-layers" && renderLibraryLayersContent()}
				{activeTab === "community-layers" && renderCommunityLayersContent()}
			</div>
		</div>
	);
}
