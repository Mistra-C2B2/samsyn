import {
	AlertTriangle,
	Anchor,
	Circle,
	Code,
	Loader2,
	Lock,
	MapPin,
	Milestone,
	MousePointer2,
	Plus,
	Ship,
	Square,
	Trash2,
	Users,
	X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Layer } from "../App";
import {
	type Feature,
	type GeometryType,
	type IconType,
	type LineStyle,
	useLayerEditor,
} from "../hooks/useLayerEditor";
import { useDebouncedCallback } from "../hooks/useDebounce";
import { CategorySelector } from "./CategorySelector";
import { LayerCreatorErrorBoundary } from "./LayerCreatorErrorBoundary";
import type { TerraDrawFeature } from "./MapView";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Textarea } from "./ui/textarea";

// ============================================================================
// Types
// ============================================================================

interface LayerCreatorProps {
	onCreateLayer: (layer: Layer) => void | Promise<void>;
	onClose: () => void;
	onStartDrawing?: (
		type: GeometryType,
		callback: (feature: unknown) => void,
		color?: string,
	) => void;
	onSetDrawMode?: (mode: "select" | "delete") => void;
	onAddFeaturesToMap?: (
		features: Array<{ id: string; type: GeometryType; coordinates: unknown }>,
		color?: string,
	) => string[];
	availableLayers?: Layer[];
	editingLayer?: Layer | null;
	drawingMode?: GeometryType | "select" | "delete" | null;
	terraDrawSnapshot?: TerraDrawFeature[];
}

// ============================================================================
// Helper Components
// ============================================================================

function GeometryIcon({ type }: { type: GeometryType }) {
	switch (type) {
		case "Point":
			return <MapPin className="w-4 h-4" />;
		case "LineString":
			return <Milestone className="w-4 h-4" />;
		case "Polygon":
			return <Square className="w-4 h-4" />;
	}
}

function FeatureIcon({ iconType }: { iconType: IconType }) {
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
}

function getCoordinatesSummary(feature: Feature): string {
	const coords = feature.coordinates as number[] | number[][] | number[][][];
	if (!coords) return "";

	if (feature.type === "Point") {
		const [lng, lat] = coords as number[];
		if (typeof lng === "number" && typeof lat === "number") {
			return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
		}
		return "";
	}
	if (feature.type === "LineString") {
		return `${(coords as number[][]).length} points`;
	}
	if (feature.type === "Polygon") {
		const rings = coords as number[][][];
		return `${rings[0]?.length ? rings[0].length - 1 : 0} vertices`;
	}
	return "";
}

// ============================================================================
// Drawing Mode Button Component
// ============================================================================

interface DrawModeButtonProps {
	isActive: boolean;
	onClick: () => void;
	icon: React.ReactNode;
	label: string;
}

const DrawModeButton = memo(function DrawModeButton({
	isActive,
	onClick,
	icon,
	label,
}: DrawModeButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
				isActive
					? "border-teal-600 bg-teal-50 text-teal-700"
					: "border-slate-200 hover:border-teal-400"
			}`}
		>
			{icon}
			<span className="text-xs">{label}</span>
		</button>
	);
});

// ============================================================================
// Feature Card Component
// ============================================================================

interface FeatureCardProps {
	feature: Feature;
	onUpdate: (field: keyof Feature, value: unknown) => void;
	onRemove: () => void;
}

const FeatureCard = memo(function FeatureCard({
	feature,
	onUpdate,
	onRemove,
}: FeatureCardProps) {
	const iconTypes: IconType[] = [
		"default",
		"anchor",
		"ship",
		"warning",
		"circle",
	];
	const lineStyles: LineStyle[] = ["solid", "dashed", "dotted"];

	// Local state for immediate UI updates
	const [localDescription, setLocalDescription] = useState(feature.description);

	// Update local state when feature prop changes
	useEffect(() => {
		setLocalDescription(feature.description);
	}, [feature.description]);

	// Debounced callback for description updates (300ms delay)
	const debouncedDescriptionUpdate = useDebouncedCallback(
		(value: string) => onUpdate("description", value),
		300,
	);

	const handleDescriptionChange = (value: string) => {
		setLocalDescription(value);
		debouncedDescriptionUpdate(value);
	};

	return (
		<div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<GeometryIcon type={feature.type} />
					<span className="text-xs text-slate-600">{feature.type}</span>
				</div>
				<Button variant="ghost" size="sm" onClick={onRemove}>
					<Trash2 className="w-3 h-3" />
				</Button>
			</div>

			<Input
				placeholder="Feature name (required)"
				value={feature.name}
				onChange={(e) => onUpdate("name", e.target.value)}
			/>

			<Textarea
				placeholder="Description (optional)"
				value={localDescription}
				onChange={(e) => handleDescriptionChange(e.target.value)}
				rows={2}
			/>

			{feature.type === "Point" && (
				<div className="space-y-2">
					<Label className="text-xs">Icon Style</Label>
					<div className="grid grid-cols-5 gap-1">
						{iconTypes.map((iconType) => (
							<button
								type="button"
								key={iconType}
								onClick={() => onUpdate("icon", iconType)}
								className={`p-2 rounded border transition-colors flex items-center justify-center ${
									feature.icon === iconType
										? "border-teal-600 bg-teal-50"
										: "border-slate-200 hover:border-teal-400"
								}`}
							>
								<FeatureIcon iconType={iconType} />
							</button>
						))}
					</div>
				</div>
			)}

			{feature.type === "LineString" && (
				<div className="space-y-2">
					<Label className="text-xs">Line Style</Label>
					<div className="grid grid-cols-3 gap-2">
						{lineStyles.map((style) => (
							<button
								type="button"
								key={style}
								onClick={() => onUpdate("lineStyle", style)}
								className={`p-2 rounded border text-xs capitalize transition-colors ${
									feature.lineStyle === style
										? "border-teal-600 bg-teal-50"
										: "border-slate-200 hover:border-teal-400"
								}`}
							>
								{style}
							</button>
						))}
					</div>
				</div>
			)}

			<div className="text-xs text-slate-500">
				{getCoordinatesSummary(feature)}
			</div>
		</div>
	);
});

// ============================================================================
// Main Component
// ============================================================================

export function LayerCreator({
	onCreateLayer,
	onClose,
	onStartDrawing,
	onSetDrawMode,
	onAddFeaturesToMap,
	availableLayers,
	editingLayer,
	drawingMode,
	terraDrawSnapshot,
}: LayerCreatorProps) {
	// Use the layer editor hook for state management
	const editor = useLayerEditor({
		editingLayer,
		terraDrawSnapshot,
	});

	// Local state for GeoJSON import
	const [geoJsonInput, setGeoJsonInput] = useState("");
	const [geoJsonError, setGeoJsonError] = useState("");
	const [geoJsonImporting, setGeoJsonImporting] = useState(false);
	const [saveWarning, setSaveWarning] = useState<string | null>(null);

	// Track if we've initialized existing features in TerraDraw
	const initializedFeaturesRef = useRef(false);
	const prevEditingLayerIdRef = useRef(editingLayer?.id);

	// Get unique categories from existing layers
	const existingCategories = useMemo(
		() =>
			availableLayers
				? Array.from(
						new Set(
							availableLayers
								.map((l) => l.category)
								.filter((c): c is string => !!c),
						),
					).sort()
				: [],
		[availableLayers],
	);

	// Initialize existing features in TerraDraw when editing, and reset on layer change
	useEffect(() => {
		const editingLayerId = editingLayer?.id;

		// Reset initialization flag when editingLayer changes
		if (prevEditingLayerIdRef.current !== editingLayerId) {
			initializedFeaturesRef.current = false;
			prevEditingLayerIdRef.current = editingLayerId;
		}

		// Initialize existing features in TerraDraw when editing
		if (
			!initializedFeaturesRef.current &&
			editor.isEditMode &&
			editor.features.length > 0 &&
			onAddFeaturesToMap
		) {
			const unsyncedFeatures = editor.features.filter(
				(f) => !f.syncedToTerraDraw,
			);
			if (unsyncedFeatures.length > 0) {
				const featuresToAdd = unsyncedFeatures.map((f) => ({
					id: f.id,
					type: f.type,
					coordinates: f.coordinates,
				}));

				const addedIds = onAddFeaturesToMap(featuresToAdd, editor.layerColor);

				// Update features with new TerraDraw IDs
				if (addedIds.length > 0) {
					const idMappings: Array<{ oldId: string; newId: string }> = [];
					unsyncedFeatures.forEach((feature, index) => {
						if (addedIds[index]) {
							idMappings.push({ oldId: feature.id, newId: addedIds[index] });
						}
					});

					if (idMappings.length > 0) {
						editor.remapFeatureIds(idMappings);
					}
				}

				initializedFeaturesRef.current = true;
			}
		}
	}, [
		editingLayer?.id,
		editor.isEditMode,
		editor.features,
		editor.layerColor,
		editor.remapFeatureIds,
		onAddFeaturesToMap,
	]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			// Reset editor state when component unmounts
			editor.reset();
		};
	}, [editor.reset]);

	// Clean up refs on unmount
	useEffect(() => {
		return () => {
			initializedFeaturesRef.current = false;
			prevEditingLayerIdRef.current = undefined;
		};
	}, []);

	// Handle drawing a new feature
	const handleAddFeatureByDrawing = (type: GeometryType) => {
		if (!onStartDrawing) return;

		onStartDrawing(
			type,
			(drawnFeature) => {
				const feature = drawnFeature as {
					id?: string | number;
					geometry?: { coordinates?: unknown };
				};

				editor.addFeature(
					{
						type,
						name: "",
						description: "",
						coordinates: feature.geometry?.coordinates,
						icon: type === "Point" ? "default" : undefined,
						lineStyle: type === "LineString" ? "solid" : undefined,
					},
					feature.id,
				);
			},
			editor.layerColor,
		);
	};

	// Handle GeoJSON import
	const handleGeoJsonImport = async () => {
		setGeoJsonImporting(true);
		setGeoJsonError("");

		// Use setTimeout to allow UI to update before processing large files
		await new Promise((resolve) => setTimeout(resolve, 0));

		try {
			const result = editor.importGeoJson(geoJsonInput);
			if (result.success) {
				setGeoJsonInput("");
				if (result.warning) {
					setGeoJsonError(result.warning);
				}
			} else {
				setGeoJsonError(result.error || "Import failed");
			}
		} finally {
			setGeoJsonImporting(false);
		}
	};

	// Handle save/create
	const handleCreate = async () => {
		const validation = editor.validate();
		if (!validation.valid) {
			editor.setError(validation.error || "Validation failed");
			return;
		}

		// Show warning if there is one but proceed
		if (validation.warning) {
			setSaveWarning(validation.warning);
		}

		const layer = editor.buildLayer(editingLayer);
		if (!layer) return;

		editor.setSaving(true);
		try {
			await onCreateLayer(layer);
		} catch (err) {
			editor.setError(
				err instanceof Error ? err.message : "Failed to save layer",
			);
		} finally {
			editor.setSaving(false);
		}
	};

	// Derived state
	const canSave =
		editor.layerName.trim() && editor.features.length > 0 && !editor.saving;

	// Memoized handlers for feature cards to prevent unnecessary re-renders
	const handleFeatureUpdate = useCallback(
		(featureId: string, field: keyof Feature, value: unknown) => {
			editor.updateFeature(featureId, { [field]: value });
		},
		[editor.updateFeature],
	);

	const handleFeatureRemove = useCallback(
		(featureId: string) => {
			editor.removeFeature(featureId);
		},
		[editor.removeFeature],
	);

	return (
		<div className="absolute right-0 top-0 bottom-0 w-96 bg-white border-l border-slate-200 flex flex-col shadow-lg">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
				<h2 className="text-slate-900">
					{editor.isEditMode ? "Edit Layer" : "Create Layer"}
				</h2>
				<Button variant="ghost" size="sm" onClick={onClose}>
					<X className="w-4 h-4" />
				</Button>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{/* Layer Name */}
				<div className="space-y-2">
					<Label htmlFor="layer-name">Layer Name</Label>
					<Input
						id="layer-name"
						placeholder="e.g., Fishing Zones"
						value={editor.layerName}
						onChange={(e) => editor.setLayerName(e.target.value)}
					/>
				</div>

				{/* Category */}
				<CategorySelector
					value={editor.category}
					onChange={editor.setCategory}
					existingCategories={existingCategories}
				/>

				{/* Description */}
				<div className="space-y-2">
					<Label htmlFor="layer-description">
						Layer Description (optional)
					</Label>
					<Textarea
						id="layer-description"
						placeholder="Describe this layer..."
						value={editor.description}
						onChange={(e) => editor.setDescription(e.target.value)}
						rows={3}
					/>
				</div>

				{/* Color Picker */}
				<div className="space-y-2">
					<Label htmlFor="layer-color">Layer Color</Label>
					<div className="flex items-center gap-2">
						<Input
							id="layer-color"
							type="color"
							value={editor.layerColor}
							onChange={(e) => editor.setLayerColor(e.target.value)}
							className="w-20 h-10 cursor-pointer"
						/>
						<Input
							type="text"
							value={editor.layerColor}
							onChange={(e) => editor.setLayerColor(e.target.value)}
							placeholder="#3b82f6"
							className="flex-1"
						/>
					</div>
				</div>

				{/* Drawing Tabs */}
				<Tabs defaultValue="draw" className="w-full">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="draw">Draw on Map</TabsTrigger>
						<TabsTrigger value="geojson">
							<Code className="w-4 h-4 mr-2" />
							GeoJSON
						</TabsTrigger>
					</TabsList>

					<TabsContent value="draw" className="space-y-3 mt-3">
						{/* Drawing mode buttons */}
						<div className="grid grid-cols-3 gap-2">
							<DrawModeButton
								isActive={drawingMode === "Point"}
								onClick={() => handleAddFeatureByDrawing("Point")}
								icon={<MapPin className="w-5 h-5" />}
								label="Add Point"
							/>
							<DrawModeButton
								isActive={drawingMode === "LineString"}
								onClick={() => handleAddFeatureByDrawing("LineString")}
								icon={<Milestone className="w-5 h-5" />}
								label="Add Line"
							/>
							<DrawModeButton
								isActive={drawingMode === "Polygon"}
								onClick={() => handleAddFeatureByDrawing("Polygon")}
								icon={<Square className="w-5 h-5" />}
								label="Add Polygon"
							/>
						</div>

						{/* Select/Delete mode buttons */}
						<div className="grid grid-cols-2 gap-2">
							<button
								type="button"
								onClick={() => onSetDrawMode?.("select")}
								className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
									drawingMode === "select"
										? "border-teal-600 bg-teal-50 text-teal-700"
										: "border-slate-200 hover:border-teal-400"
								}`}
							>
								<MousePointer2 className="w-5 h-5" />
								<span className="text-xs">Select</span>
							</button>
							<button
								type="button"
								onClick={() => onSetDrawMode?.("delete")}
								className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
									drawingMode === "delete"
										? "border-red-600 bg-red-50 text-red-700"
										: "border-slate-200 hover:border-red-400"
								}`}
							>
								<Trash2 className="w-5 h-5" />
								<span className="text-xs">Delete</span>
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
							disabled={!geoJsonInput.trim() || geoJsonImporting}
						>
							{geoJsonImporting ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									Importing...
								</>
							) : (
								<>
									<Code className="w-4 h-4 mr-2" />
									Import GeoJSON
								</>
							)}
						</Button>
					</TabsContent>
				</Tabs>

				{/* Features List */}
				{editor.features.length > 0 && (
					<div className="space-y-3 border-t border-slate-200 pt-4">
						<div className="flex items-center justify-between">
							<Label>Features ({editor.features.length})</Label>
							<Button
								variant="ghost"
								size="sm"
								onClick={editor.clearFeatures}
								className="text-xs text-slate-500 hover:text-red-600"
							>
								Clear All
							</Button>
						</div>
						{editor.features.map((feature) => (
							<FeatureCard
								key={feature.id}
								feature={feature}
								onUpdate={(field, value) =>
									handleFeatureUpdate(feature.id, field, value)
								}
								onRemove={() => handleFeatureRemove(feature.id)}
							/>
						))}
					</div>
				)}

				{/* Empty State */}
				{editor.features.length === 0 && (
					<div className="p-6 bg-slate-50 border border-slate-200 rounded-lg text-center">
						<p className="text-sm text-slate-600">
							Click a button above to start drawing features on the map
						</p>
					</div>
				)}

				{/* Permissions */}
				<div className="space-y-3 border-t border-slate-200 pt-4">
					<Label>Who Can Edit This Layer?</Label>
					<div className="space-y-2">
						<button
							type="button"
							onClick={() => editor.setEditableBy("creator-only")}
							className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
								editor.editableBy === "creator-only"
									? "border-teal-600 bg-teal-50"
									: "border-slate-200 hover:border-teal-400"
							}`}
						>
							<div className="flex items-start gap-3">
								<div
									className={`p-2 rounded ${
										editor.editableBy === "creator-only"
											? "bg-teal-100"
											: "bg-slate-100"
									}`}
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
							onClick={() => editor.setEditableBy("everyone")}
							className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
								editor.editableBy === "everyone"
									? "border-teal-600 bg-teal-50"
									: "border-slate-200 hover:border-teal-400"
							}`}
						>
							<div className="flex items-start gap-3">
								<div
									className={`p-2 rounded ${
										editor.editableBy === "everyone"
											? "bg-teal-100"
											: "bg-slate-100"
									}`}
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

			{/* Footer */}
			<div className="p-4 border-t border-slate-200 space-y-3">
				{saveWarning && (
					<div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-600">
						{saveWarning}
					</div>
				)}
				{editor.error && (
					<div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
						{editor.error}
					</div>
				)}
				<Button onClick={handleCreate} className="w-full" disabled={!canSave}>
					{editor.saving ? (
						<>
							<Loader2 className="w-4 h-4 mr-2 animate-spin" />
							{editor.isEditMode ? "Saving..." : "Creating..."}
						</>
					) : (
						<>
							<Plus className="w-4 h-4 mr-2" />
							{editor.isEditMode ? "Save Changes" : "Create Layer"}
						</>
					)}
				</Button>
			</div>
		</div>
	);
}

// ============================================================================
// Export with Error Boundary
// ============================================================================

// Export wrapped version with error boundary
export function LayerCreatorWithErrorBoundary(
	props: LayerCreatorProps & { onReset?: () => void },
) {
	const { onReset, ...layerCreatorProps } = props;
	return (
		<LayerCreatorErrorBoundary onReset={onReset}>
			<LayerCreator {...layerCreatorProps} />
		</LayerCreatorErrorBoundary>
	);
}
