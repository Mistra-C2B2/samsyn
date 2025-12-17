import { useUser } from "@clerk/clerk-react";
import {
	Loader2,
	MapPin,
	Milestone,
	Plus,
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
	useLayerEditor,
} from "../hooks/useLayerEditor";
import { LayerCreatorErrorBoundary } from "./LayerCreatorErrorBoundary";
import { DrawingModePanel } from "./layer-creator/DrawingModePanel";
import { LayerMetadataForm } from "./layer-creator/LayerMetadataForm";
import { PermissionsSelector } from "./layer-creator/PermissionsSelector";
import { StyleSettingsPanel } from "./layer-creator/StyleSettingsPanel";
import type { TerraDrawFeature } from "./MapView";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

// ============================================================================
// Types
// ============================================================================

interface DrawingStyles {
	color: string;
	lineWidth: number;
	fillPolygons: boolean;
}

type MarkerIconType = "default" | "anchor" | "ship" | "warning" | "circle";

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
	onRemoveFeatureFromMap?: (id: string) => void;
	onUpdateDrawingStyles?: (styles: DrawingStyles) => void;
	onPanToFeature?: (coordinates: unknown, geometryType: string) => void;
	onSelectFeature?: (featureId: string) => void;
	availableLayers?: Layer[];
	editingLayer?: Layer | null;
	drawingMode?: GeometryType | "select" | "delete" | null;
	terraDrawSnapshot?: TerraDrawFeature[];
	// For marker icon overlay
	onMarkerIconChange?: (icon: MarkerIconType) => void;
	onMarkerColorChange?: (color: string) => void;
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
	onSelect?: () => void;
	isSelected?: boolean;
}

const FeatureCard = memo(function FeatureCard({
	feature,
	onUpdate,
	onRemove,
	onSelect,
	isSelected,
}: FeatureCardProps) {
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
		<div
			className={`rounded-lg border transition-all flex overflow-hidden cursor-pointer hover:border-teal-300 ${
				isSelected
					? "ring-2 ring-teal-300 shadow-md border-teal-400"
					: "border-slate-200"
			}`}
			onClick={onSelect}
			onKeyDown={(e) => {
				// Only handle keyboard selection if not typing in an input/textarea
				const target = e.target as HTMLElement;
				const isInput =
					target.tagName === "INPUT" || target.tagName === "TEXTAREA";
				if ((e.key === "Enter" || e.key === " ") && !isInput) {
					e.preventDefault();
					onSelect?.();
				}
			}}
			tabIndex={0}
			role="button"
			aria-pressed={isSelected}
		>
			{/* Left accent bar for selected feature */}
			{isSelected && <div className="w-2 bg-teal-500 flex-shrink-0" />}
			<div
				className={`p-3 space-y-2 flex-1 ${isSelected ? "bg-teal-100" : "bg-slate-50"}`}
			>
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
					placeholder="Feature name (optional)"
					value={feature.name}
					onChange={(e) => onUpdate("name", e.target.value)}
				/>

				<Textarea
					placeholder="Description (optional)"
					value={localDescription}
					onChange={(e) => handleDescriptionChange(e.target.value)}
					rows={2}
				/>

				<div className="text-xs text-slate-500">
					{getCoordinatesSummary(feature)}
				</div>
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
	onRemoveFeatureFromMap,
	onUpdateDrawingStyles,
	onPanToFeature,
	onSelectFeature,
	availableLayers,
	editingLayer,
	drawingMode,
	terraDrawSnapshot,
	onMarkerIconChange,
	onMarkerColorChange,
}: LayerCreatorProps) {
	// Get current user from Clerk auth
	const { user } = useUser();

	// Use the layer editor hook for state management
	const editor = useLayerEditor({
		editingLayer,
		terraDrawSnapshot,
		currentUserId: user?.id,
		onRemoveFeatureFromTerraDraw: onRemoveFeatureFromMap,
	});

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

	// Get selected feature IDs from TerraDraw snapshot
	const selectedFeatureIds = useMemo(() => {
		if (!terraDrawSnapshot) return new Set<string>();
		return new Set(
			terraDrawSnapshot
				.filter((f) => f.properties?.selected === true)
				.map((f) => String(f.id)),
		);
	}, [terraDrawSnapshot]);

	// Initialize existing features in TerraDraw when editing, and reset on layer change
	useEffect(() => {
		const editingLayerId = editingLayer?.id;

		// Reset initialization flag when editingLayer changes
		if (prevEditingLayerIdRef.current !== editingLayerId) {
			initializedFeaturesRef.current = false;
			prevEditingLayerIdRef.current = editingLayerId;
		}

		// Debug logging
		console.log("[LayerCreator] Edit mode check:", {
			initialized: initializedFeaturesRef.current,
			isEditMode: editor.isEditMode,
			pendingFeaturesCount: editor.pendingFeatures.length,
			hasOnAddFeaturesToMap: !!onAddFeaturesToMap,
			editingLayerId,
		});

		// Initialize pending features in TerraDraw when editing
		if (
			!initializedFeaturesRef.current &&
			editor.isEditMode &&
			editor.pendingFeatures.length > 0 &&
			onAddFeaturesToMap
		) {
			console.log(
				"[LayerCreator] Adding features to TerraDraw:",
				editor.pendingFeatures,
			);
			const featuresToAdd = editor.pendingFeatures.map((f) => ({
				id: f.id,
				type: f.type,
				coordinates: f.coordinates,
			}));

			const addedIds = onAddFeaturesToMap(featuresToAdd, editor.layerColor);
			console.log("[LayerCreator] Added feature IDs:", addedIds);

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

	// Debounced style update to avoid excessive TerraDraw calls
	const debouncedUpdateStyles = useDebouncedCallback(
		(styles: DrawingStyles) => {
			if (onUpdateDrawingStyles) {
				onUpdateDrawingStyles(styles);
			}
		},
		100, // 100ms debounce for responsive feel without overwhelming TerraDraw
	);

	// Update drawing styles when they change
	useEffect(() => {
		debouncedUpdateStyles({
			color: editor.layerColor,
			lineWidth: editor.lineWidth,
			fillPolygons: editor.fillPolygons,
		});
	}, [
		editor.layerColor,
		editor.lineWidth,
		editor.fillPolygons,
		debouncedUpdateStyles,
	]);

	// Notify parent that marker icon is always "default" (location marker)
	useEffect(() => {
		if (onMarkerIconChange) {
			onMarkerIconChange("default");
		}
	}, [onMarkerIconChange]);

	// Notify parent of color changes for marker overlay rendering
	useEffect(() => {
		if (onMarkerColorChange) {
			onMarkerColorChange(editor.layerColor);
		}
	}, [editor.layerColor, onMarkerColorChange]);

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
						featureType: type, // Store actual type (Marker vs Point, etc.)
					});
				}
			},
			editor.layerColor,
		);
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
			// Only update metadata fields (name, description, icon)
			if (field === "name" || field === "description" || field === "icon") {
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
						existingCategories={existingCategories}
					/>

					{/* Drawing Mode Panel */}
					<DrawingModePanel onStartDrawing={handleAddFeatureByDrawing} />

					{/* Style Settings Panel */}
					<StyleSettingsPanel
						layerColor={editor.layerColor}
						setLayerColor={editor.setLayerColor}
						lineWidth={editor.lineWidth}
						setLineWidth={editor.setLineWidth}
						fillPolygons={editor.fillPolygons}
						setFillPolygons={editor.setFillPolygons}
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
									onSelect={() => {
										onSelectFeature?.(feature.id);
										onPanToFeature?.(feature.coordinates, feature.type);
									}}
									isSelected={selectedFeatureIds.has(feature.id)}
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
					<Button
						variant="outline"
						onClick={onClose}
						className="w-full"
						disabled={editor.saving}
					>
						Cancel
					</Button>
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
