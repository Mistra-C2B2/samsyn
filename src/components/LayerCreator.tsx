import { useUser } from "@clerk/clerk-react";
import { X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { Layer } from "../App";
import { DrawingProvider } from "../contexts/DrawingContext";
import {
	type DrawingStyles,
	type MarkerIconType,
	useTerraDrawSync,
} from "../hooks/layer-editor/useTerraDrawSync";
import {
	type Feature,
	type GeometryType,
	useLayerEditor,
} from "../hooks/useLayerEditor";
import { LayerCreatorErrorBoundary } from "./LayerCreatorErrorBoundary";
import {
	DrawingModePanel,
	FeaturesList,
	LayerCreatorFooter,
	LayerMetadataForm,
	PermissionsSelector,
	StyleSettingsPanel,
} from "./layer-creator";
import type { TerraDrawFeature } from "./MapView";
import { Button } from "./ui/button";

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
	onRemoveFeatureFromMap?: (id: string) => void;
	onUpdateDrawingStyles?: (styles: DrawingStyles) => void;
	onPanToFeature?: (coordinates: unknown, geometryType: string) => void;
	onSelectFeature?: (featureId: string) => void;
	availableLayers?: Layer[];
	editingLayer?: Layer | null;
	drawingMode?: GeometryType | "select" | "delete" | null;
	terraDrawSnapshot?: TerraDrawFeature[];
	onMarkerIconChange?: (icon: MarkerIconType) => void;
	onMarkerColorChange?: (color: string) => void;
}

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

	// Custom hook for TerraDraw synchronization
	useTerraDrawSync({
		editor,
		editingLayer,
		onAddFeaturesToMap,
		onUpdateDrawingStyles,
		onMarkerIconChange,
		onMarkerColorChange,
	});

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
						featureType: type,
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

	const handleFeatureSelect = useCallback(
		(featureId: string) => {
			onSelectFeature?.(featureId);
		},
		[onSelectFeature],
	);

	const handlePanToFeature = useCallback(
		(_featureId: string, coordinates: unknown, geometryType: string) => {
			onPanToFeature?.(coordinates, geometryType);
		},
		[onPanToFeature],
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
					<LayerMetadataForm
						layerName={editor.layerName}
						setLayerName={editor.setLayerName}
						category={editor.category}
						setCategory={editor.setCategory}
						description={editor.description}
						setDescription={editor.setDescription}
						existingCategories={existingCategories}
					/>

					<DrawingModePanel onStartDrawing={handleAddFeatureByDrawing} />

					<StyleSettingsPanel
						layerColor={editor.layerColor}
						setLayerColor={editor.setLayerColor}
						lineWidth={editor.lineWidth}
						setLineWidth={editor.setLineWidth}
						fillPolygons={editor.fillPolygons}
						setFillPolygons={editor.setFillPolygons}
					/>

					<FeaturesList
						features={editor.features}
						selectedFeatureIds={selectedFeatureIds}
						onUpdateFeature={handleFeatureUpdate}
						onRemoveFeature={handleFeatureRemove}
						onSelectFeature={handleFeatureSelect}
						onPanToFeature={handlePanToFeature}
						onClearAll={editor.clearFeatures}
					/>

					<PermissionsSelector
						editableBy={editor.editableBy}
						setEditableBy={editor.setEditableBy}
					/>
				</div>

				{/* Footer */}
				<LayerCreatorFooter
					saveWarning={saveWarning}
					error={editor.error}
					saving={editor.saving}
					canSave={canSave}
					isEditMode={editor.isEditMode}
					onCancel={onClose}
					onCreate={handleCreate}
				/>
			</div>
		</DrawingProvider>
	);
}

// ============================================================================
// Export with Error Boundary
// ============================================================================

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
