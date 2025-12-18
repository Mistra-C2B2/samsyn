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
			dimensions: Array<{
				name: string;
				extent: string;
				units: string | null;
				default: string | null;
			}>;
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

			// Auto-fill layer name from service title if not already set
			if (capabilities.service_title && !name) {
				setName(capabilities.service_title);
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
				legend: {
					type: legendType,
					items: legendItems.filter((item) => item.label && item.color),
				},
				// Source-specific properties
				...(layerSource === "wms" && {
					wmsUrl,
					wmsLayerName,
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
														(layer.abstract?.toLowerCase().includes(filter) ?? false)
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
													(layer.abstract?.toLowerCase().includes(filter) ?? false)
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
