import { Edit, Loader2, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { Layer } from "../App";
import { useLayerService } from "../services/layerService";
import { CategorySelector } from "./CategorySelector";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./ui/alert-dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";

interface AdminPanelProps {
	availableLayers: Layer[];
	onAddLayer: (layer: Layer) => void | Promise<void>;
	onRemoveLayer: (layerId: string) => void | Promise<void>;
	onUpdateLayer: (
		layerId: string,
		updates: Partial<Layer>,
	) => void | Promise<void>;
	onClose: () => void;
}

type LayerSource = "wms" | "geotiff" | "vector";

export function AdminPanel({
	availableLayers,
	onAddLayer,
	onRemoveLayer,
	onUpdateLayer,
	onClose,
}: AdminPanelProps) {
	const [showAddForm, setShowAddForm] = useState(false);
	const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
	const [layerSource, setLayerSource] = useState<LayerSource>("wms");
	const [isSaving, setIsSaving] = useState(false);
	const [layerToDelete, setLayerToDelete] = useState<Layer | null>(null);

	// Layer service for WMS capabilities
	const layerService = useLayerService();

	// Form state
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [author, setAuthor] = useState("");
	const [doi, setDoi] = useState("");
	const [category, setCategory] = useState("");
	const [wmsUrl, setWmsUrl] = useState("");
	const [wmsLayerName, setWmsLayerName] = useState("");
	const [geotiffUrl, setGeotiffUrl] = useState("");

	// WMS layer discovery state
	const [availableWmsLayers, setAvailableWmsLayers] = useState<
		Array<{
			name: string;
			title: string;
			abstract: string | null;
			queryable: boolean;
			dimensions: Array<{
				name: string;
				extent: string;
				units: string | null;
				default: string | null;
			}>;
			styles: Array<{
				name: string;
				title: string;
				legendUrl?: string;
			}>;
			bounds: [number, number, number, number] | null; // [west, south, east, north]
			crs: string[] | null; // Supported coordinate reference systems
		}>
	>([]);
	const [fetchingCapabilities, setFetchingCapabilities] = useState(false);
	const [wmsError, setWmsError] = useState<string | null>(null);
	const [wmsLayerFilter, setWmsLayerFilter] = useState("");
	// WMS time dimension state (auto-populated when selecting a temporal layer)
	const [wmsTimeDimension, setWmsTimeDimension] = useState<{
		extent: string;
		default?: string;
	} | null>(null);
	const [legendType, setLegendType] = useState<"gradient" | "categorical">(
		"gradient",
	);
	const [legendItems, setLegendItems] = useState<
		Array<{ label: string; color: string }>
	>([
		{ label: "Low", color: "#3b82f6" },
		{ label: "High", color: "#ef4444" },
	]);
	// WMS legend state
	const [legendSource, setLegendSource] = useState<"manual" | "wms">("manual");
	const [wmsLegendUrl, setWmsLegendUrl] = useState<string | null>(null);
	const [legendImageError, setLegendImageError] = useState(false);
	// WMS queryable state
	const [wmsQueryable, setWmsQueryable] = useState(false);
	// WMS style state
	const [wmsStyle, setWmsStyle] = useState<string>("");
	const [wmsAvailableStyles, setWmsAvailableStyles] = useState<
		Array<{ name: string; title: string; legendUrl?: string }>
	>([]);
	// WMS bounds state
	const [wmsBounds, setWmsBounds] = useState<
		[number, number, number, number] | null
	>(null);
	// WMS service provider (for attribution)
	const [wmsServiceProvider, setWmsServiceProvider] = useState<string | null>(
		null,
	);
	// WMS version and formats (for version-specific parameter handling)
	const [wmsVersion, setWmsVersion] = useState<"1.1.1" | "1.3.0" | null>(null);
	const [wmsGetMapFormats, setWmsGetMapFormats] = useState<string[]>([]);
	const [wmsCRS, setWmsCRS] = useState<string[]>([]);
	// CQL filter for GeoServer/MapServer (vendor extension)
	const [wmsCqlFilter, setWmsCqlFilter] = useState<string>("");
	// Discovered properties for CQL filter suggestions
	const [discoveredProperties, setDiscoveredProperties] = useState<
		Array<{ name: string; sampleValue: string | null; type: string }>
	>([]);
	const [discoveringProperties, setDiscoveringProperties] = useState(false);

	// Get unique categories from existing layers
	const existingCategories = Array.from(
		new Set(
			availableLayers.map((l) => l.category).filter((c): c is string => !!c),
		),
	).sort();

	const resetForm = () => {
		setName("");
		setDescription("");
		setAuthor("");
		setDoi("");
		setCategory("");
		setWmsUrl("");
		setWmsLayerName("");
		setGeotiffUrl("");
		setEditingLayerId(null);
		setLegendItems([
			{ label: "Low", color: "#3b82f6" },
			{ label: "High", color: "#ef4444" },
		]);
		// Reset WMS discovery state
		setAvailableWmsLayers([]);
		setWmsError(null);
		setWmsLayerFilter("");
		setWmsTimeDimension(null);
		// Reset WMS legend state
		setLegendSource("manual");
		setWmsLegendUrl(null);
		setLegendImageError(false);
		setWmsQueryable(false);
		// Reset WMS style state
		setWmsStyle("");
		setWmsAvailableStyles([]);
		// Reset WMS bounds state
		setWmsBounds(null);
		// Reset WMS service provider
		setWmsServiceProvider(null);
		// Reset WMS version and formats
		setWmsVersion(null);
		setWmsGetMapFormats([]);
		setWmsCRS([]);
		// Reset CQL filter
		setWmsCqlFilter("");
		// Reset discovered properties
		setDiscoveredProperties([]);
	};

	// Fetch WMS GetCapabilities and populate layer list
	const handleFetchCapabilities = async () => {
		if (!wmsUrl.trim()) return;

		setFetchingCapabilities(true);
		setWmsError(null);
		setAvailableWmsLayers([]);

		try {
			const capabilities = await layerService.getWMSCapabilities(wmsUrl);
			setAvailableWmsLayers(capabilities.layers);

			// Store WMS version for version-specific parameter handling
			if (capabilities.version === "1.1.1" || capabilities.version === "1.3.0") {
				setWmsVersion(capabilities.version);
			} else {
				// Default to 1.3.0 if unknown version
				setWmsVersion("1.3.0");
			}

			// Store supported GetMap formats
			if (capabilities.getmap_formats) {
				setWmsGetMapFormats(capabilities.getmap_formats);
			}

			// Auto-fill layer name from service title if not already set
			if (capabilities.service_title && !name) {
				setName(capabilities.service_title);
			}

			// Store service provider for attribution and auto-fill author
			if (capabilities.service_provider) {
				setWmsServiceProvider(capabilities.service_provider);
				// Auto-fill author from service provider if not already set
				if (!author) {
					setAuthor(capabilities.service_provider);
				}
			} else {
				setWmsServiceProvider(null);
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to fetch capabilities";
			setWmsError(message);
		} finally {
			setFetchingCapabilities(false);
		}
	};

	// Handle WMS layer selection from dropdown
	const handleSelectWmsLayer = (layerName: string) => {
		setWmsLayerName(layerName);

		// Auto-fill metadata from selected layer
		const selectedLayer = availableWmsLayers.find((l) => l.name === layerName);
		if (selectedLayer) {
			if (!name) {
				setName(selectedLayer.title || selectedLayer.name);
			}
			if (!description && selectedLayer.abstract) {
				setDescription(selectedLayer.abstract);
			}

			// Check for time dimension and auto-configure temporal settings
			const timeDimension = selectedLayer.dimensions.find(
				(d) => d.name.toLowerCase() === "time",
			);
			if (timeDimension) {
				setWmsTimeDimension({
					extent: timeDimension.extent,
					default: timeDimension.default || undefined,
				});
			} else {
				setWmsTimeDimension(null);
			}

			// Construct WMS legend URL
			if (wmsUrl) {
				const baseUrl = wmsUrl.split("?")[0];
				const legendUrl = `${baseUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&LAYER=${encodeURIComponent(layerName)}&FORMAT=image/png`;
				setWmsLegendUrl(legendUrl);
				setLegendImageError(false);
			}

			// Store queryable flag
			setWmsQueryable(selectedLayer.queryable || false);

			// Store available styles and select default
			if (selectedLayer.styles && selectedLayer.styles.length > 0) {
				setWmsAvailableStyles(selectedLayer.styles);
				// Select first style as default
				setWmsStyle(selectedLayer.styles[0].name);
				// If selected style has a legend URL, use it
				if (selectedLayer.styles[0].legendUrl) {
					setWmsLegendUrl(selectedLayer.styles[0].legendUrl);
					setLegendImageError(false);
				}
			} else {
				setWmsAvailableStyles([]);
				setWmsStyle("");
			}

			// Store bounds for zoom-to-layer functionality
			if (selectedLayer.bounds) {
				setWmsBounds(selectedLayer.bounds);
			} else {
				setWmsBounds(null);
			}

			// Store layer-specific CRS (if available)
			if (selectedLayer.crs && selectedLayer.crs.length > 0) {
				setWmsCRS(selectedLayer.crs);
			} else {
				setWmsCRS([]);
			}

			// Reset discovered properties when changing layer
			setDiscoveredProperties([]);
		}
	};

	// Discover available properties for CQL filtering
	const handleDiscoverProperties = async () => {
		if (!wmsUrl || !wmsLayerName) return;

		setDiscoveringProperties(true);
		try {
			const boundsStr = wmsBounds
				? `${wmsBounds[0]},${wmsBounds[1]},${wmsBounds[2]},${wmsBounds[3]}`
				: undefined;

			const result = await layerService.discoverWMSLayerProperties({
				wmsUrl,
				layer: wmsLayerName,
				bounds: boundsStr,
				version: wmsVersion || "1.3.0",
			});

			setDiscoveredProperties(result.properties || []);

			if (result.properties.length === 0) {
				// Show message if no properties found
				console.log("Property discovery:", result.message);
			}
		} catch (error) {
			console.error("Failed to discover properties:", error);
			setDiscoveredProperties([]);
		} finally {
			setDiscoveringProperties(false);
		}
	};

	const loadLayerToForm = (layer: Layer) => {
		setName(layer.name);
		setDescription(layer.description || "");
		setAuthor(layer.author || "");
		setDoi(layer.doi || "");
		setCategory(layer.category || "");
		setWmsUrl(layer.wmsUrl || "");
		setWmsLayerName(layer.wmsLayerName || "");
		setGeotiffUrl(layer.geotiffUrl || "");
		setLegendType(layer.legend?.type || "gradient");
		setLegendItems(
			layer.legend?.items || [
				{ label: "Low", color: "#3b82f6" },
				{ label: "High", color: "#ef4444" },
			],
		);

		// Determine layer source
		if (layer.wmsUrl) {
			setLayerSource("wms");
			// Load WMS style settings
			setWmsStyle(layer.wmsStyle || "");
			setWmsAvailableStyles(layer.wmsAvailableStyles || []);
			// Load WMS bounds
			setWmsBounds(layer.wmsBounds || null);
			// Load WMS attribution
			setWmsServiceProvider(layer.wmsAttribution || null);
			// Load WMS version and CRS
			setWmsVersion(layer.wmsVersion || null);
			setWmsCRS(layer.wmsCRS || []);
			// Load CQL filter
			setWmsCqlFilter(layer.wmsCqlFilter || "");
		} else if (layer.geotiffUrl) {
			setLayerSource("geotiff");
		} else {
			setLayerSource("vector");
		}
	};

	const handleEdit = (layer: Layer) => {
		loadLayerToForm(layer);
		setEditingLayerId(layer.id);
		setShowAddForm(true);
	};

	const handleAddLegendItem = () => {
		setLegendItems([...legendItems, { label: "", color: "#6b7280" }]);
	};

	const handleUpdateLegendItem = (
		index: number,
		field: "label" | "color",
		value: string,
	) => {
		const updated = [...legendItems];
		updated[index][field] = value;
		setLegendItems(updated);
	};

	const handleRemoveLegendItem = (index: number) => {
		setLegendItems(legendItems.filter((_, i) => i !== index));
	};

	const handleSubmit = async () => {
		if (!name) {
			alert("Please enter a layer name");
			return;
		}

		setIsSaving(true);

		try {
			// Build layer data (without id for updates - keep existing id)
			const layerData = {
				name,
				type:
					layerSource === "wms" || layerSource === "geotiff"
						? "raster"
						: ("vector" as const),
				visible: true,
				opacity: 1,
				description,
				author,
				doi,
				category,
				// Include manual legend only if not using WMS legend
				...(!(layerSource === "wms" && legendSource === "wms") && {
					legend: {
						type: legendType,
						items: legendItems.filter((item) => item.label && item.color),
					},
				}),
				// Source-specific properties
				...(layerSource === "wms" && {
					wmsUrl,
					wmsLayerName,
					wmsQueryable,
					// Include WMS version for version-specific parameters
					...(wmsVersion && { wmsVersion }),
					// Include supported CRS list
					...(wmsCRS.length > 0 && { wmsCRS }),
					// Include CQL filter if specified
					...(wmsCqlFilter.trim() && { wmsCqlFilter: wmsCqlFilter.trim() }),
					// Include WMS style if selected
					...(wmsStyle && { wmsStyle }),
					// Include available styles for future selection
					...(wmsAvailableStyles.length > 0 && { wmsAvailableStyles }),
					// Include WMS bounds for zoom-to-layer functionality
					...(wmsBounds && { wmsBounds }),
					// Include WMS attribution from service provider
					...(wmsServiceProvider && { wmsAttribution: wmsServiceProvider }),
					// Include WMS legend URL if using WMS legend source
					...(legendSource === "wms" &&
						wmsLegendUrl &&
						!legendImageError && {
							wmsLegendUrl,
						}),
					// Include time dimension if present
					...(wmsTimeDimension && {
						wmsTimeDimension,
						temporal: true,
						// Parse extent to set timeRange (format: "start/end/period" or "start/end")
						timeRange: (() => {
							const parts = wmsTimeDimension.extent.split("/");
							if (parts.length >= 2) {
								return {
									start: new Date(parts[0]),
									end: new Date(parts[1]),
								};
							}
							return undefined;
						})(),
					}),
				}),
				...(layerSource === "geotiff" && { geotiffUrl }),
			};

			if (editingLayerId) {
				// Update existing layer - don't include new id, keep the original
				await onUpdateLayer(editingLayerId, layerData);
			} else {
				// Create new layer - generate id
				const newLayer: Layer = {
					id: crypto.randomUUID(),
					...layerData,
				};
				await onAddLayer(newLayer);
			}

			resetForm();
			setShowAddForm(false);
		} catch (error) {
			console.error("Failed to save layer:", error);
		} finally {
			setIsSaving(false);
		}
	};

	// Start adding a new layer (reset form to ensure clean state)
	const handleStartAddLayer = () => {
		resetForm(); // Ensure editingLayerId is null and form is clean
		setShowAddForm(true);
	};

	return (
		<div className="absolute left-0 top-0 bottom-0 w-96 bg-white border-r border-slate-200 flex flex-col shadow-lg z-50">
			<div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-teal-50">
				<div>
					<h2 className="text-slate-900">Admin Panel</h2>
					<p className="text-xs text-slate-600">Manage layer library</p>
				</div>
				<Button variant="ghost" size="sm" onClick={onClose}>
					<X className="w-4 h-4" />
				</Button>
			</div>

			{!showAddForm ? (
				<>
					<div className="px-4 py-3 border-b border-slate-200">
						<Button onClick={handleStartAddLayer} className="w-full" size="sm">
							<Plus className="w-4 h-4 mr-2" />
							Add Layer to Library
						</Button>
					</div>

					<div className="flex-1 overflow-y-auto p-4 space-y-2">
						<h3 className="text-sm text-slate-700 mb-2">
							Library Layers ({availableLayers.length})
						</h3>
						{availableLayers.length === 0 ? (
							<p className="text-slate-500 text-sm text-center py-8">
								No layers in library
							</p>
						) : (
							availableLayers.map((layer) => (
								<div
									key={layer.id}
									className="bg-slate-50 border border-slate-200 rounded-lg p-3"
								>
									<div className="flex items-start gap-2 mb-2">
										<div className="flex-1 min-w-0">
											<h3 className="text-slate-900 text-sm">{layer.name}</h3>
											<p className="text-slate-500 text-xs capitalize">
												{layer.type}
											</p>
											{layer.wmsUrl && (
												<Badge variant="outline" className="mt-1 text-xs">
													WMS
												</Badge>
											)}
											{layer.geotiffUrl && (
												<Badge variant="outline" className="mt-1 text-xs">
													GeoTIFF
												</Badge>
											)}
											{layer.features && (
												<Badge variant="outline" className="mt-1 text-xs">
													Custom Vector
												</Badge>
											)}
										</div>
										{/* Hide edit/delete for hardcoded GFW layer */}
									{!layer.gfw4WingsDataset && (
										<div className="flex gap-1">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => handleEdit(layer)}
											>
												<Edit className="w-4 h-4 text-teal-600" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => setLayerToDelete(layer)}
											>
												<Trash2 className="w-4 h-4 text-red-500" />
											</Button>
										</div>
									)}
									</div>
									{layer.description && (
										<p className="text-xs text-slate-600 mt-2">
											{layer.description}
										</p>
									)}
								</div>
							))
						)}
					</div>
				</>
			) : (
				<>
					<div className="px-4 py-3 border-b border-slate-200">
						<Button
							variant="outline"
							onClick={() => {
								setShowAddForm(false);
								resetForm();
							}}
							size="sm"
						>
							← Back to Library
						</Button>
					</div>

					<div className="flex-1 overflow-y-auto p-4 space-y-4">
						<div className="space-y-2">
							<Label htmlFor="layerSource">Layer Source</Label>
							<Select
								value={layerSource}
								onValueChange={(v) => setLayerSource(v as LayerSource)}
							>
								<SelectTrigger id="layerSource">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="wms">WMS (Web Map Service)</SelectItem>
									<SelectItem value="geotiff">GeoTIFF / COG</SelectItem>
									<SelectItem value="vector">Vector (GeoJSON)</SelectItem>
								</SelectContent>
							</Select>
							<p className="text-xs text-slate-500 mt-1">
								{layerSource === "wms" && "Connect to an external WMS service"}
								{layerSource === "geotiff" &&
									"Load a GeoTIFF or Cloud Optimized GeoTIFF"}
								{layerSource === "vector" && "Import vector data from GeoJSON"}
							</p>
						</div>

						{layerSource === "wms" && (
							<>
								<div className="space-y-2">
									<Label htmlFor="wmsUrl">WMS Service URL</Label>
									<div className="flex gap-2">
										<Input
											id="wmsUrl"
											value={wmsUrl}
											onChange={(e) => {
												setWmsUrl(e.target.value);
												// Clear discovered layers when URL changes
												setAvailableWmsLayers([]);
												setWmsError(null);
												setWmsLayerFilter("");
											}}
											placeholder="https://example.com/wms"
											className="flex-1"
										/>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={handleFetchCapabilities}
											disabled={!wmsUrl.trim() || fetchingCapabilities}
										>
											{fetchingCapabilities ? (
												<Loader2 className="w-4 h-4 animate-spin" />
											) : (
												<Search className="w-4 h-4" />
											)}
										</Button>
									</div>
									<p className="text-xs text-slate-500">
										Enter URL and click search to discover available layers
									</p>
								</div>

								{/* Error message */}
								{wmsError && (
									<div className="text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">
										{wmsError}
									</div>
								)}

								{/* Layer selection with filter */}
								{availableWmsLayers.length > 0 && (
									<div className="space-y-2">
										<Label>
											Available Layers ({availableWmsLayers.length})
										</Label>
										{/* Filter input */}
										<div className="relative">
											<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
											<Input
												value={wmsLayerFilter}
												onChange={(e) => setWmsLayerFilter(e.target.value)}
												placeholder="Filter layers..."
												className="pl-8"
											/>
											{wmsLayerFilter && (
												<Button
													variant="ghost"
													size="sm"
													className="absolute right-1 top-1 h-6 w-6 p-0"
													onClick={() => setWmsLayerFilter("")}
												>
													<X className="h-3 w-3" />
												</Button>
											)}
										</div>
										{/* Filtered layer list */}
										<div className="max-h-48 overflow-y-auto border border-slate-200 rounded-md">
											{availableWmsLayers
												.filter((layer) => {
													if (!wmsLayerFilter.trim()) return true;
													const filter = wmsLayerFilter.toLowerCase();
													return (
														layer.name.toLowerCase().includes(filter) ||
														layer.title.toLowerCase().includes(filter) ||
														(layer.abstract?.toLowerCase().includes(filter) ??
															false)
													);
												})
												.map((layer) => {
													const hasTimeDimension = layer.dimensions.some(
														(d) => d.name.toLowerCase() === "time",
													);
													return (
														<button
															key={layer.name}
															type="button"
															onClick={() => handleSelectWmsLayer(layer.name)}
															className={`w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 ${
																wmsLayerName === layer.name ? "bg-teal-50" : ""
															}`}
														>
															<div className="flex items-center gap-2">
																<span className="font-medium text-sm">
																	{layer.title || layer.name}
																</span>
																{hasTimeDimension && (
																	<Badge
																		variant="outline"
																		className="text-xs bg-blue-50 text-blue-700 border-blue-200"
																	>
																		Temporal
																	</Badge>
																)}
															</div>
															{layer.title !== layer.name && (
																<div className="text-xs text-slate-500">
																	{layer.name}
																</div>
															)}
															{layer.abstract && (
																<div className="text-xs text-slate-400 mt-1 line-clamp-2">
																	{layer.abstract}
																</div>
															)}
														</button>
													);
												})}
											{availableWmsLayers.filter((layer) => {
												if (!wmsLayerFilter.trim()) return true;
												const filter = wmsLayerFilter.toLowerCase();
												return (
													layer.name.toLowerCase().includes(filter) ||
													layer.title.toLowerCase().includes(filter) ||
													(layer.abstract?.toLowerCase().includes(filter) ??
														false)
												);
											}).length === 0 && (
												<div className="px-3 py-4 text-sm text-slate-500 text-center">
													No layers match "{wmsLayerFilter}"
												</div>
											)}
										</div>
									</div>
								)}

								{/* Manual layer name input (always available) */}
								<div className="space-y-2">
									<Label htmlFor="wmsLayerName">
										Layer Name{" "}
										{availableWmsLayers.length > 0 && "(or enter manually)"}
									</Label>
									<Input
										id="wmsLayerName"
										value={wmsLayerName}
										onChange={(e) => setWmsLayerName(e.target.value)}
										placeholder="layer_name"
									/>
								</div>

								{/* Style selection dropdown */}
								{wmsAvailableStyles.length > 1 && (
									<div className="space-y-2">
										<Label htmlFor="wmsStyle">Style</Label>
										<Select
											value={wmsStyle}
											onValueChange={(value) => {
												setWmsStyle(value);
												// Update legend URL if style has one
												const selectedStyle = wmsAvailableStyles.find(
													(s) => s.name === value,
												);
												if (selectedStyle?.legendUrl) {
													setWmsLegendUrl(selectedStyle.legendUrl);
													setLegendImageError(false);
												} else if (wmsUrl && wmsLayerName) {
													// Generate default legend URL with style parameter
													const baseUrl = wmsUrl.split("?")[0];
													const legendUrl = `${baseUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetLegendGraphic&LAYER=${encodeURIComponent(wmsLayerName)}&STYLE=${encodeURIComponent(value)}&FORMAT=image/png`;
													setWmsLegendUrl(legendUrl);
													setLegendImageError(false);
												}
											}}
										>
											<SelectTrigger id="wmsStyle">
												<SelectValue placeholder="Select style" />
											</SelectTrigger>
											<SelectContent>
												{wmsAvailableStyles.map((style) => (
													<SelectItem key={style.name} value={style.name}>
														{style.title || style.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}

								{/* WMS Service Info */}
								{wmsVersion && wmsLayerName && (
									<div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
										<div className="flex items-center gap-2 mb-2">
											<span className="font-medium text-slate-700">
												WMS Version:
											</span>
											<Badge variant="outline" className="text-xs">
												{wmsVersion}
											</Badge>
										</div>
										{wmsCRS.length > 0 && (
											<div className="text-xs text-slate-500">
												<span className="font-medium">Supported CRS:</span>{" "}
												{wmsCRS.slice(0, 3).join(", ")}
												{wmsCRS.length > 3 && ` +${wmsCRS.length - 3} more`}
											</div>
										)}
										{wmsGetMapFormats.length > 0 && (
											<div className="text-xs text-slate-500 mt-1">
												<span className="font-medium">Formats:</span>{" "}
												{wmsGetMapFormats
													.filter((f) => f.includes("image/"))
													.slice(0, 3)
													.map((f) => f.replace("image/", ""))
													.join(", ")}
											</div>
										)}
									</div>
								)}

								{/* Temporal dimension info */}
								{wmsTimeDimension && (
									<div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
										<div className="flex items-center gap-2 text-sm font-medium text-blue-800">
											<svg
												className="w-4 h-4"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
												/>
											</svg>
											Temporal Layer Detected
										</div>
										<p className="text-xs text-blue-700 mt-1">
											Time range: {wmsTimeDimension.extent}
										</p>
										<p className="text-xs text-blue-600 mt-1">
											This layer supports time-based filtering. The TimeSlider
											will appear when added to a map.
										</p>
									</div>
								)}

								{/* CQL Filter (vendor extension for GeoServer/MapServer) */}
								{wmsLayerName && (
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<Label htmlFor="wmsCqlFilter">
												CQL Filter (optional)
											</Label>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={handleDiscoverProperties}
												disabled={discoveringProperties}
												className="text-xs h-7"
											>
												{discoveringProperties ? (
													<>
														<svg
															className="animate-spin -ml-1 mr-1 h-3 w-3"
															fill="none"
															viewBox="0 0 24 24"
														>
															<circle
																className="opacity-25"
																cx="12"
																cy="12"
																r="10"
																stroke="currentColor"
																strokeWidth="4"
															/>
															<path
																className="opacity-75"
																fill="currentColor"
																d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
															/>
														</svg>
														Discovering...
													</>
												) : (
													<>
														<svg
															className="w-3 h-3 mr-1"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={2}
																d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
															/>
														</svg>
														Discover Properties
													</>
												)}
											</Button>
										</div>
										<Textarea
											id="wmsCqlFilter"
											value={wmsCqlFilter}
											onChange={(e) => setWmsCqlFilter(e.target.value)}
											placeholder="e.g. category_column='All' AND category='All'"
											rows={2}
											className="font-mono text-xs"
										/>

										{/* Discovered properties */}
										{discoveredProperties.length > 0 && (
											<div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
												<p className="text-xs font-medium text-slate-700 mb-2">
													Available Properties (click to add):
												</p>
												<div className="flex flex-wrap gap-1">
													{discoveredProperties.map((prop) => (
														<button
															key={prop.name}
															type="button"
															onClick={() => {
																// Add property to filter
																const filterPart =
																	prop.sampleValue !== null
																		? `${prop.name}='${prop.sampleValue}'`
																		: `${prop.name}=''`;
																setWmsCqlFilter((prev) =>
																	prev
																		? `${prev} AND ${filterPart}`
																		: filterPart,
																);
															}}
															className="inline-flex items-center px-2 py-1 bg-white border border-slate-300 rounded text-xs hover:bg-blue-50 hover:border-blue-300 transition-colors"
															title={`Sample value: ${prop.sampleValue ?? "null"}`}
														>
															<span className="font-mono text-slate-700">
																{prop.name}
															</span>
															{prop.sampleValue && (
																<span className="ml-1 text-slate-400">
																	= "{prop.sampleValue}"
																</span>
															)}
														</button>
													))}
												</div>
												<p className="text-xs text-slate-400 mt-2">
													Sample values shown. Modify as needed.
												</p>
											</div>
										)}

										<p className="text-xs text-slate-500">
											Server-side filter expression (GeoServer CQL).
											Click "Discover Properties" to find available filter fields.
										</p>
									</div>
								)}
							</>
						)}

						{layerSource === "geotiff" && (
							<div className="space-y-2">
								<Label htmlFor="geotiffUrl">GeoTIFF URL</Label>
								<Input
									id="geotiffUrl"
									value={geotiffUrl}
									onChange={(e) => setGeotiffUrl(e.target.value)}
									placeholder="https://example.com/data.tif"
								/>
								<p className="text-xs text-slate-500 mt-1">
									Must be a publicly accessible URL to a GeoTIFF or COG file
								</p>
							</div>
						)}

						{layerSource === "vector" && (
							<div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-slate-700">
								Vector layers can be created by users through the "Create Layer"
								feature. Use this option to import pre-existing GeoJSON data.
							</div>
						)}

						<div className="border-t border-slate-200 pt-4">
							<h3 className="text-sm text-slate-700 mb-3">Layer Metadata</h3>

							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="name">Layer Name *</Label>
									<Input
										id="name"
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder="My Layer"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="description">Description</Label>
									<Textarea
										id="description"
										value={description}
										onChange={(e) => setDescription(e.target.value)}
										placeholder="Describe this layer..."
										rows={3}
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="author">Author / Source</Label>
									<Input
										id="author"
										value={author}
										onChange={(e) => setAuthor(e.target.value)}
										placeholder="Organization or author name"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="doi">DOI (optional)</Label>
									<Input
										id="doi"
										value={doi}
										onChange={(e) => setDoi(e.target.value)}
										placeholder="10.1234/example"
									/>
								</div>

								<CategorySelector
									value={category}
									onChange={setCategory}
									existingCategories={existingCategories}
								/>
							</div>
						</div>

						<div className="border-t border-slate-200 pt-4">
							<h3 className="text-sm text-slate-700 mb-3">Legend</h3>

							<div className="space-y-4">
								{/* Legend source toggle for WMS layers */}
								{layerSource === "wms" && wmsLegendUrl && (
									<div className="space-y-2">
										<Label>Legend Source</Label>
										<div className="flex gap-4">
											<label className="flex items-center gap-2 text-sm cursor-pointer">
												<input
													type="radio"
													name="legendSource"
													checked={legendSource === "wms"}
													onChange={() => setLegendSource("wms")}
													className="text-teal-600"
												/>
												Fetch from WMS
											</label>
											<label className="flex items-center gap-2 text-sm cursor-pointer">
												<input
													type="radio"
													name="legendSource"
													checked={legendSource === "manual"}
													onChange={() => setLegendSource("manual")}
													className="text-teal-600"
												/>
												Define manually
											</label>
										</div>
									</div>
								)}

								{/* WMS Legend Preview */}
								{layerSource === "wms" &&
									legendSource === "wms" &&
									wmsLegendUrl && (
										<div className="space-y-2">
											<Label>Legend Preview</Label>
											<div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
												{legendImageError ? (
													<div className="text-sm text-amber-600">
														Could not load legend from WMS server. Try "Define
														manually" instead.
													</div>
												) : (
													<img
														src={wmsLegendUrl}
														alt="WMS Legend"
														className="max-w-full"
														onError={() => setLegendImageError(true)}
													/>
												)}
											</div>
										</div>
									)}

								{/* Manual legend configuration */}
								{(layerSource !== "wms" || legendSource === "manual") && (
									<>
										<div className="space-y-2">
											<Label htmlFor="legendType">Legend Type</Label>
											<Select
												value={legendType}
												onValueChange={(v) =>
													setLegendType(v as "gradient" | "categorical")
												}
											>
												<SelectTrigger id="legendType">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="gradient">
														Gradient (continuous)
													</SelectItem>
													<SelectItem value="categorical">
														Categorical (discrete)
													</SelectItem>
												</SelectContent>
											</Select>
										</div>

										<div className="space-y-2">
											<Label>Legend Items</Label>
											<div className="space-y-2 mt-2">
												{legendItems.map((item, index) => (
													<div
														key={`legend-item-${item.label}-${index}`}
														className="flex items-center gap-2"
													>
														<Input
															value={item.label}
															onChange={(e) =>
																handleUpdateLegendItem(
																	index,
																	"label",
																	e.target.value,
																)
															}
															placeholder="Label"
															className="flex-1"
														/>
														<Input
															type="color"
															value={item.color}
															onChange={(e) =>
																handleUpdateLegendItem(
																	index,
																	"color",
																	e.target.value,
																)
															}
															className="w-16"
														/>
														{legendItems.length > 2 && (
															<Button
																variant="ghost"
																size="sm"
																onClick={() => handleRemoveLegendItem(index)}
															>
																<Trash2 className="w-4 h-4 text-red-500" />
															</Button>
														)}
													</div>
												))}
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={handleAddLegendItem}
												className="w-full mt-2"
											>
												<Plus className="w-4 h-4 mr-2" />
												Add Item
											</Button>
										</div>
									</>
								)}
							</div>
						</div>
					</div>

					<div className="p-4 border-t border-slate-200">
						<Button
							onClick={handleSubmit}
							className="w-full"
							disabled={!name.trim() || isSaving}
						>
							{isSaving ? (
								<Loader2 className="w-4 h-4 mr-2 animate-spin" />
							) : (
								<Save className="w-4 h-4 mr-2" />
							)}
							{editingLayerId ? "Update Layer" : "Add to Library"}
						</Button>
					</div>
				</>
			)}

			{/* Delete Confirmation Dialog */}
			<AlertDialog
				open={!!layerToDelete}
				onOpenChange={() => setLayerToDelete(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>
							{layerToDelete && (
								<>
									This will permanently delete the layer "{layerToDelete.name}"
									from the library. This action cannot be undone.
								</>
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (layerToDelete) {
									onRemoveLayer(layerToDelete.id);
									setLayerToDelete(null);
								}
							}}
							className="bg-red-600 hover:bg-red-700"
						>
							Delete Layer
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
