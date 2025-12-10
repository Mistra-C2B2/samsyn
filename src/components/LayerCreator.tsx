import { useUser } from "@clerk/clerk-react";
import {
	AlertTriangle,
	Anchor,
	Circle,
	Loader2,
	MapPin,
	Milestone,
	Plus,
	Ship,
	Square,
	Trash2,
	X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Layer } from "../App";
import { DrawingProvider } from "../contexts/DrawingContext";
import { useDebouncedCallback } from "../hooks/useDebounce";
import {
	type Feature,
	type GeometryType,
	type IconType,
	type LineStyle,
	useLayerEditor,
} from "../hooks/useLayerEditor";
import { LayerCreatorErrorBoundary } from "./LayerCreatorErrorBoundary";
import { DrawingModePanel } from "./layer-creator/DrawingModePanel";
import { LayerMetadataForm } from "./layer-creator/LayerMetadataForm";
import { PermissionsSelector } from "./layer-creator/PermissionsSelector";
import type { TerraDrawFeature } from "./MapView";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
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
	// Get current user from Clerk auth
	const { user } = useUser();

	// Use the layer editor hook for state management
	const editor = useLayerEditor({
		editingLayer,
		terraDrawSnapshot,
		currentUserId: user?.id,
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

		// Initialize pending features in TerraDraw when editing
		if (
			!initializedFeaturesRef.current &&
			editor.isEditMode &&
			editor.pendingFeatures.length > 0 &&
			onAddFeaturesToMap
		) {
			const featuresToAdd = editor.pendingFeatures.map((f) => ({
				id: f.id,
				type: f.type,
				coordinates: f.coordinates,
			}));

			const addedIds = onAddFeaturesToMap(featuresToAdd, editor.layerColor);

			// Update features with new TerraDraw IDs
			if (addedIds.length > 0) {
				const idMappings: Array<{ oldId: string; newId: string }> = [];
				editor.pendingFeatures.forEach((feature, index) => {
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
	}, [
		editingLayer?.id,
		editor.isEditMode,
		editor.pendingFeatures,
		editor.layerColor,
		editor.remapFeatureIds,
		onAddFeaturesToMap,
	]);

	// Track features added via GeoJSON import to prevent duplicate adds
	const importedFeaturesRef = useRef<Set<string>>(new Set());

	// Add pending features from GeoJSON import to TerraDraw (for create mode)
	useEffect(() => {
		if (
			!editor.isEditMode &&
			editor.pendingFeatures.length > 0 &&
			onAddFeaturesToMap
		) {
			// Filter out features we've already added
			const newFeatures = editor.pendingFeatures.filter(
				(f) => !importedFeaturesRef.current.has(f.id),
			);

			if (newFeatures.length > 0) {
				const featuresToAdd = newFeatures.map((f) => ({
					id: f.id,
					type: f.type,
					coordinates: f.coordinates,
				}));

				const addedIds = onAddFeaturesToMap(featuresToAdd, editor.layerColor);

				// Update features with new TerraDraw IDs
				if (addedIds.length > 0) {
					const idMappings: Array<{ oldId: string; newId: string }> = [];
					newFeatures.forEach((feature, index) => {
						if (addedIds[index]) {
							idMappings.push({ oldId: feature.id, newId: addedIds[index] });
							// Track this feature as added
							importedFeaturesRef.current.add(feature.id);
						}
					});

					if (idMappings.length > 0) {
						editor.remapFeatureIds(idMappings);
					}
				}
			}
		}
	}, [
		editor.isEditMode,
		editor.pendingFeatures,
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
			importedFeaturesRef.current.clear();
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

				if (feature.id) {
					editor.addFeature(feature.id, {
						name: "",
						description: "",
						icon: type === "Point" ? "default" : undefined,
						lineStyle: type === "LineString" ? "solid" : undefined,
					});
				}
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
		const validation = editor.validate(editor.features);
		if (!validation.valid) {
			editor.setError(validation.error || "Validation failed");
			return;
		}

		// Show warning if there is one but proceed
		if (validation.warning) {
			setSaveWarning(validation.warning);
		}

		const layer = editor.buildLayer(editor.features, editingLayer);
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
			// Only update metadata fields (name, description, icon, lineStyle)
			if (
				field === "name" ||
				field === "description" ||
				field === "icon" ||
				field === "lineStyle"
			) {
				editor.updateFeature(featureId, { [field]: value });
			}
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
		<DrawingProvider
			value={{
				drawingMode,
				onStartDrawing,
				onSetDrawMode,
				onAddFeaturesToMap,
			}}
		>
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
					{/* Layer Metadata Form */}
					<LayerMetadataForm
						layerName={editor.layerName}
						setLayerName={editor.setLayerName}
						category={editor.category}
						setCategory={editor.setCategory}
						description={editor.description}
						setDescription={editor.setDescription}
						layerColor={editor.layerColor}
						setLayerColor={editor.setLayerColor}
						existingCategories={existingCategories}
					/>

					{/* Drawing Mode Panel */}
					<DrawingModePanel
						onStartDrawing={handleAddFeatureByDrawing}
						geoJsonInput={geoJsonInput}
						setGeoJsonInput={setGeoJsonInput}
						geoJsonError={geoJsonError}
						geoJsonImporting={geoJsonImporting}
						onGeoJsonImport={handleGeoJsonImport}
					/>

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

					{/* Permissions Selector */}
					<PermissionsSelector
						editableBy={editor.editableBy}
						setEditableBy={editor.setEditableBy}
					/>
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
		</DrawingProvider>
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
