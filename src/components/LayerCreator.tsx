import {
	AlertTriangle,
	Anchor,
	Circle,
	Code,
	Loader2,
	Lock,
	MapPin,
	Milestone,
	Plus,
	Ship,
	Square,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { useState } from "react";
import type { Layer } from "../App";
import { CategorySelector } from "./CategorySelector";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Textarea } from "./ui/textarea";

interface LayerCreatorProps {
	onCreateLayer: (layer: Layer) => void | Promise<void>;
	onClose: () => void;
	onStartDrawing?: (
		type: "Point" | "LineString" | "Polygon",
		callback: (feature: unknown) => void,
	) => void;
	availableLayers?: Layer[];
	editingLayer?: Layer | null;
}

type GeometryType = "Point" | "LineString" | "Polygon";
type IconType = "default" | "anchor" | "ship" | "warning" | "circle";
type LineStyle = "solid" | "dashed" | "dotted";

interface Feature {
	type: GeometryType;
	name: string;
	description: string;
	coordinates: unknown;
	icon?: IconType;
	lineStyle?: LineStyle;
}

export function LayerCreator({
	onCreateLayer,
	onClose,
	onStartDrawing,
	availableLayers,
	editingLayer,
}: LayerCreatorProps) {
	const [layerName, setLayerName] = useState(editingLayer?.name || "");
	const [category, setCategory] = useState(editingLayer?.category || "");
	const [description, setDescription] = useState(
		editingLayer?.description || "",
	);
	const [features, setFeatures] = useState<Feature[]>(() => {
		// If editing, populate features from the layer's GeoJSON data
		const layerData = editingLayer?.data as {
			features?: Array<{
				geometry?: { type?: string; coordinates?: unknown };
				properties?: {
					name?: string;
					description?: string;
					icon?: string;
					lineStyle?: string;
				};
			}>;
		} | undefined;
		if (layerData?.features) {
			return layerData.features.map((feature) => ({
				type: (feature.geometry?.type || "Point") as GeometryType,
				name: feature.properties?.name || "",
				description: feature.properties?.description || "",
				coordinates: feature.geometry?.coordinates,
				icon: (feature.properties?.icon as IconType) || "default",
				lineStyle: (feature.properties?.lineStyle as LineStyle) || "solid",
			}));
		}
		return [];
	});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [geoJsonInput, setGeoJsonInput] = useState("");
	const [geoJsonError, setGeoJsonError] = useState("");
	const [editableBy, setEditableBy] = useState<"creator-only" | "everyone">(
		editingLayer?.editable || "creator-only",
	);
	const [layerColor, setLayerColor] = useState(
		editingLayer?.color || "#3b82f6",
	);

	// Mock current user ID - in a real app, this would come from authentication
	const currentUserId = "user-123";

	// Get unique categories from existing layers
	const existingCategories = availableLayers
		? Array.from(
				new Set(
					availableLayers
						.map((l) => l.category)
						.filter((c): c is string => !!c),
				),
			).sort()
		: [];

	const addFeatureByDrawing = (type: GeometryType) => {
		if (!onStartDrawing) return;

		onStartDrawing(type, (drawnFeature) => {
			const feature = drawnFeature as {
				geometry?: { coordinates?: unknown };
			};
			const newFeature: Feature = {
				type,
				name: "",
				description: "",
				coordinates: feature.geometry?.coordinates,
				icon: type === "Point" ? "default" : undefined,
				lineStyle: type === "LineString" ? "solid" : undefined,
			};
			setFeatures([...features, newFeature]);
		});
	};

	const removeFeature = (index: number) => {
		setFeatures(features.filter((_, i) => i !== index));
	};

	const updateFeature = (
		index: number,
		field: keyof Feature,
		value: unknown,
	) => {
		setFeatures(
			features.map((f, i) => (i === index ? { ...f, [field]: value } : f)),
		);
		// Clear error when user makes changes
		if (error) setError(null);
	};

	const handleCreate = async () => {
		if (!layerName.trim()) {
			setError("Please enter a layer name");
			return;
		}
		if (features.length === 0) {
			setError("Please add at least one feature to the layer");
			return;
		}

		const geoJsonFeatures = features
			.filter((f) => f.name.trim())
			.map((feature) => ({
				type: "Feature" as const,
				properties: {
					name: feature.name,
					description: feature.description,
					featureType: feature.type,
					icon: feature.icon,
					lineStyle: feature.lineStyle,
				},
				geometry: {
					type: feature.type,
					coordinates: feature.coordinates,
				},
			}));

		if (geoJsonFeatures.length === 0) {
			setError("Please give each feature a name");
			return;
		}

		const newLayer: Layer = {
			id: editingLayer?.id || crypto.randomUUID(),
			name: layerName,
			type: "geojson",
			visible: true,
			opacity: editingLayer?.opacity || 0.7,
			color: layerColor,
			data: {
				type: "FeatureCollection",
				features: geoJsonFeatures,
			},
			legend: {
				type: "categories",
				items: [{ color: layerColor, label: layerName }],
			},
			category: category || undefined,
			description: description || undefined,
			editable: editableBy,
			createdBy: editingLayer?.createdBy || currentUserId,
		};

		setSaving(true);
		setError(null);
		try {
			await onCreateLayer(newLayer);
			// Success - error will be null
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save layer");
		} finally {
			setSaving(false);
		}
	};

	const getIcon = (type: GeometryType) => {
		switch (type) {
			case "Point":
				return <MapPin className="w-4 h-4" />;
			case "LineString":
				return <Milestone className="w-4 h-4" />;
			case "Polygon":
				return <Square className="w-4 h-4" />;
		}
	};

	const getIconComponent = (iconType: IconType) => {
		const iconClass = "w-4 h-4";
		switch (iconType) {
			case "anchor":
				return <Anchor className={iconClass} />;
			case "ship":
				return <Ship className={iconClass} />;
			case "warning":
				return <AlertTriangle className={iconClass} />;
			case "circle":
				return <Circle className={iconClass} />;
			default:
				return <MapPin className={iconClass} />;
		}
	};

	const getCoordinatesSummary = (feature: Feature) => {
		const coords = feature.coordinates as number[] | number[][] | number[][][];
		if (feature.type === "Point") {
			const [lng, lat] = coords as number[];
			return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
		} else if (feature.type === "LineString") {
			return `${(coords as number[][]).length} points`;
		} else if (feature.type === "Polygon") {
			return `${(coords as number[][][])[0].length - 1} vertices`;
		}
		return "";
	};

	const handleGeoJsonImport = () => {
		try {
			const geoJsonData = JSON.parse(geoJsonInput);
			if (geoJsonData.type !== "FeatureCollection") {
				throw new Error("Invalid GeoJSON: Must be a FeatureCollection");
			}
			const newFeatures: Feature[] = geoJsonData.features.map(
				(feature: unknown) => {
					const f = feature as {
						geometry?: { type?: string; coordinates?: unknown };
						properties?: {
							name?: string;
							description?: string;
							icon?: string;
							lineStyle?: string;
						};
					};
					return {
						type: (f.geometry?.type || "Point") as GeometryType,
						name: f.properties?.name || "",
						description: f.properties?.description || "",
						coordinates: f.geometry?.coordinates,
						icon: (f.properties?.icon as IconType) || "default",
						lineStyle: (f.properties?.lineStyle as LineStyle) || "solid",
					};
				},
			);
			setFeatures(newFeatures);
			setGeoJsonError("");
		} catch (error: unknown) {
			setGeoJsonError((error as Error).message);
		}
	};

	return (
		<div className="absolute right-0 top-0 bottom-0 w-96 bg-white border-l border-slate-200 flex flex-col shadow-lg">
			<div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
				<h2 className="text-slate-900">
					{editingLayer ? "Edit Layer" : "Create Layer"}
				</h2>
				<Button variant="ghost" size="sm" onClick={onClose}>
					<X className="w-4 h-4" />
				</Button>
			</div>

			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				<div className="space-y-2">
					<Label htmlFor="layer-name">Layer Name</Label>
					<Input
						id="layer-name"
						placeholder="e.g., Fishing Zones"
						value={layerName}
						onChange={(e) => {
							setLayerName(e.target.value);
							if (error) setError(null);
						}}
					/>
				</div>

				<CategorySelector
					value={category}
					onChange={setCategory}
					existingCategories={existingCategories}
				/>

				<div className="space-y-2">
					<Label htmlFor="layer-description">
						Layer Description (optional)
					</Label>
					<Textarea
						id="layer-description"
						placeholder="Describe this layer..."
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						rows={3}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="layer-color">Layer Color</Label>
					<div className="flex items-center gap-2">
						<Input
							id="layer-color"
							type="color"
							value={layerColor}
							onChange={(e) => setLayerColor(e.target.value)}
							className="w-20 h-10 cursor-pointer"
						/>
						<Input
							type="text"
							value={layerColor}
							onChange={(e) => setLayerColor(e.target.value)}
							placeholder="#3b82f6"
							className="flex-1"
						/>
					</div>
				</div>

				{/* Tabs for adding features */}
				<Tabs defaultValue="draw" className="w-full">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="draw">Draw on Map</TabsTrigger>
						<TabsTrigger value="geojson">
							<Code className="w-4 h-4 mr-2" />
							GeoJSON
						</TabsTrigger>
					</TabsList>

					<TabsContent value="draw" className="space-y-3 mt-3">
						<div className="grid grid-cols-3 gap-2">
							<button
								type="button"
								onClick={() => addFeatureByDrawing("Point")}
								className="p-3 rounded-lg border-2 border-slate-200 hover:border-teal-400 transition-all flex flex-col items-center gap-2"
							>
								<MapPin className="w-5 h-5" />
								<span className="text-xs">Add Point</span>
							</button>
							<button
								type="button"
								onClick={() => addFeatureByDrawing("LineString")}
								className="p-3 rounded-lg border-2 border-slate-200 hover:border-teal-400 transition-all flex flex-col items-center gap-2"
							>
								<Milestone className="w-5 h-5" />
								<span className="text-xs">Add Line</span>
							</button>
							<button
								type="button"
								onClick={() => addFeatureByDrawing("Polygon")}
								className="p-3 rounded-lg border-2 border-slate-200 hover:border-teal-400 transition-all flex flex-col items-center gap-2"
							>
								<Square className="w-5 h-5" />
								<span className="text-xs">Add Polygon</span>
							</button>
						</div>
					</TabsContent>

					<TabsContent value="geojson" className="space-y-3 mt-3">
						<div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-slate-700">
							<p>
								Paste a GeoJSON FeatureCollection. Each feature will be imported
								as a separate item that you can name and customize.
							</p>
						</div>
						<Textarea
							placeholder={`{\n  "type": "FeatureCollection",\n  "features": [\n    {\n      "type": "Feature",\n      "properties": {\n        "name": "Feature Name"\n      },\n      "geometry": {...}\n    }\n  ]\n}`}
							value={geoJsonInput}
							onChange={(e) => setGeoJsonInput(e.target.value)}
							rows={8}
							className="font-mono text-xs"
						/>
						{geoJsonError && (
							<div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
								{geoJsonError}
							</div>
						)}
						<Button
							onClick={handleGeoJsonImport}
							variant="outline"
							className="w-full"
							disabled={!geoJsonInput.trim()}
						>
							<Code className="w-4 h-4 mr-2" />
							Import GeoJSON
						</Button>
					</TabsContent>
				</Tabs>

				{features.length > 0 && (
					<div className="space-y-3 border-t border-slate-200 pt-4">
						<div className="flex items-center justify-between">
							<Label>Features ({features.length})</Label>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setFeatures([])}
								className="text-xs text-slate-500 hover:text-red-600"
							>
								Clear All
							</Button>
						</div>
						{features.map((feature, index) => (
							<div
								key={`feature-${feature.type}-${feature.name}-${index}`}
								className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2"
							>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										{getIcon(feature.type)}
										<span className="text-xs text-slate-600">
											{feature.type}
										</span>
									</div>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => removeFeature(index)}
									>
										<Trash2 className="w-3 h-3" />
									</Button>
								</div>

								<Input
									placeholder="Feature name (required)"
									value={feature.name}
									onChange={(e) => updateFeature(index, "name", e.target.value)}
								/>

								<Textarea
									placeholder="Description (optional)"
									value={feature.description}
									onChange={(e) =>
										updateFeature(index, "description", e.target.value)
									}
									rows={2}
								/>

								{feature.type === "Point" && (
									<div className="space-y-2">
										<Label className="text-xs">Icon Style</Label>
										<div className="grid grid-cols-5 gap-1">
											{(
												[
													"default",
													"anchor",
													"ship",
													"warning",
													"circle",
												] as IconType[]
											).map((iconType) => (
												<button
													type="button"
													key={iconType}
													onClick={() => updateFeature(index, "icon", iconType)}
													className={`p-2 rounded border transition-colors flex items-center justify-center ${
														feature.icon === iconType
															? "border-teal-600 bg-teal-50"
															: "border-slate-200 hover:border-teal-400"
													}`}
												>
													{getIconComponent(iconType)}
												</button>
											))}
										</div>
									</div>
								)}

								{feature.type === "LineString" && (
									<div className="space-y-2">
										<Label className="text-xs">Line Style</Label>
										<div className="grid grid-cols-3 gap-2">
											{(["solid", "dashed", "dotted"] as LineStyle[]).map(
												(style) => (
													<button
														type="button"
														key={style}
														onClick={() =>
															updateFeature(index, "lineStyle", style)
														}
														className={`p-2 rounded border text-xs capitalize transition-colors ${
															feature.lineStyle === style
																? "border-teal-600 bg-teal-50"
																: "border-slate-200 hover:border-teal-400"
														}`}
													>
														{style}
													</button>
												),
											)}
										</div>
									</div>
								)}

								<div className="text-xs text-slate-500">
									{getCoordinatesSummary(feature)}
								</div>
							</div>
						))}
					</div>
				)}

				{features.length === 0 && (
					<div className="p-6 bg-slate-50 border border-slate-200 rounded-lg text-center">
						<p className="text-sm text-slate-600">
							Click a button above to start drawing features on the map
						</p>
					</div>
				)}

				<div className="space-y-3 border-t border-slate-200 pt-4">
					<Label>Who Can Edit This Layer?</Label>
					<div className="space-y-2">
						<button
							type="button"
							onClick={() => setEditableBy("creator-only")}
							className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
								editableBy === "creator-only"
									? "border-teal-600 bg-teal-50"
									: "border-slate-200 hover:border-teal-400"
							}`}
						>
							<div className="flex items-start gap-3">
								<div
									className={`p-2 rounded ${editableBy === "creator-only" ? "bg-teal-100" : "bg-slate-100"}`}
								>
									<Lock className="w-4 h-4" />
								</div>
								<div className="flex-1">
									<div className="font-medium text-sm">Only Me</div>
									<p className="text-xs text-slate-600 mt-1">
										Only you can edit or delete this layer
									</p>
								</div>
							</div>
						</button>

						<button
							type="button"
							onClick={() => setEditableBy("everyone")}
							className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
								editableBy === "everyone"
									? "border-teal-600 bg-teal-50"
									: "border-slate-200 hover:border-teal-400"
							}`}
						>
							<div className="flex items-start gap-3">
								<div
									className={`p-2 rounded ${editableBy === "everyone" ? "bg-teal-100" : "bg-slate-100"}`}
								>
									<Users className="w-4 h-4" />
								</div>
								<div className="flex-1">
									<div className="font-medium text-sm">Everyone</div>
									<p className="text-xs text-slate-600 mt-1">
										All users can edit this layer
									</p>
								</div>
							</div>
						</button>
					</div>
					<p className="text-xs text-slate-500">
						You can change this setting later as the layer creator
					</p>
				</div>
			</div>

			<div className="p-4 border-t border-slate-200 space-y-3">
				{error && (
					<div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
						{error}
					</div>
				)}
				<Button
					onClick={handleCreate}
					className="w-full"
					disabled={!layerName.trim() || features.length === 0 || saving}
				>
					{saving ? (
						<>
							<Loader2 className="w-4 h-4 mr-2 animate-spin" />
							{editingLayer ? "Saving..." : "Creating..."}
						</>
					) : (
						<>
							<Plus className="w-4 h-4 mr-2" />
							{editingLayer ? "Save Changes" : "Create Layer"}
						</>
					)}
				</Button>
			</div>
		</div>
	);
}
