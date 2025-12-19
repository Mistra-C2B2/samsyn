import { Loader2, Plus, Save, X } from "lucide-react";
import { useState } from "react";
import type { Layer } from "../App";
import { useAdminLayerForm } from "../hooks/admin-layer-form";
import {
	GeoTiffLayerForm,
	LayerLibraryList,
	LayerMetadataFields,
	LayerSourceSelector,
	LegendConfigSection,
	VectorLayerForm,
	WmsLayerForm,
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
}: AdminPanelProps) {
	// View state
	const [showAddForm, setShowAddForm] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [layerToDelete, setLayerToDelete] = useState<Layer | null>(null);

	// Form state via composed hooks
	const form = useAdminLayerForm();

	// Get unique categories from existing layers
	const existingCategories = Array.from(
		new Set(
			availableLayers.map((l) => l.category).filter((c): c is string => !!c),
		),
	).sort();

	// Handlers
	const handleStartAddLayer = () => {
		form.resetForm();
		setShowAddForm(true);
	};

	const handleEdit = (layer: Layer) => {
		form.loadLayerForEdit(layer);
		setShowAddForm(true);
	};

	const handleCancel = () => {
		setShowAddForm(false);
		form.resetForm();
	};

	const handleSubmit = async () => {
		const layerData = form.buildLayer();
		if (!layerData) {
			alert("Please enter a layer name");
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
			setShowAddForm(false);
		} catch (error) {
			console.error("Failed to save layer:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleDeleteConfirm = () => {
		if (layerToDelete) {
			onRemoveLayer(layerToDelete.id);
			setLayerToDelete(null);
		}
	};

	return (
		<div className="absolute left-0 top-0 bottom-0 w-96 bg-white border-r border-slate-200 flex flex-col shadow-lg z-50">
			{/* Header */}
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
					{/* Add Layer Button */}
					<div className="px-4 py-3 border-b border-slate-200">
						<Button onClick={handleStartAddLayer} className="w-full" size="sm">
							<Plus className="w-4 h-4 mr-2" />
							Add Layer to Library
						</Button>
					</div>

					{/* Layer List */}
					<LayerLibraryList
						layers={availableLayers}
						layerToDelete={layerToDelete}
						onEdit={handleEdit}
						onDeleteRequest={setLayerToDelete}
						onDeleteConfirm={handleDeleteConfirm}
						onDeleteCancel={() => setLayerToDelete(null)}
					/>
				</>
			) : (
				<>
					{/* Back Button */}
					<div className="px-4 py-3 border-b border-slate-200">
						<Button variant="outline" onClick={handleCancel} size="sm">
							← Back to Library
						</Button>
					</div>

					{/* Form Content */}
					<div className="flex-1 overflow-y-auto p-4 space-y-4">
						{/* Layer Source Selection */}
						<LayerSourceSelector
							value={form.layerSource}
							onChange={form.setLayerSource}
						/>

						{/* Source-specific Forms */}
						{form.layerSource === "wms" && (
							<WmsLayerForm
								url={form.wms.url}
								layerName={form.wms.layerName}
								onUrlChange={form.wms.setUrl}
								onLayerNameChange={form.wms.setLayerName}
								availableLayers={form.wms.availableLayers}
								fetchingCapabilities={form.wms.fetchingCapabilities}
								error={form.wms.error}
								layerFilter={form.wms.layerFilter}
								onLayerFilterChange={form.wms.setLayerFilter}
								onFetchCapabilities={form.wms.fetchCapabilities}
								onSelectLayer={form.handleWmsLayerSelect}
								style={form.wms.style}
								availableStyles={form.wms.availableStyles}
								onStyleChange={form.handleWmsStyleChange}
								version={form.wms.version}
								crs={form.wms.crs}
								getMapFormats={form.wms.getMapFormats}
								timeDimension={form.wms.timeDimension}
								cqlFilter={form.wms.cqlFilter}
								onCqlFilterChange={form.wms.setCqlFilter}
								discoveredProperties={form.wms.discoveredProperties}
								discoveringProperties={form.wms.discoveringProperties}
								onDiscoverProperties={form.wms.discoverProperties}
								onAddPropertyToFilter={form.wms.addPropertyToFilter}
							/>
						)}

						{form.layerSource === "geotiff" && (
							<GeoTiffLayerForm
								url={form.geotiff.url}
								onUrlChange={form.geotiff.setUrl}
							/>
						)}

						{form.layerSource === "vector" && <VectorLayerForm />}

						{/* Metadata Fields */}
						<LayerMetadataFields
							name={form.metadata.name}
							description={form.metadata.description}
							author={form.metadata.author}
							doi={form.metadata.doi}
							category={form.metadata.category}
							existingCategories={existingCategories}
							onNameChange={form.metadata.setName}
							onDescriptionChange={form.metadata.setDescription}
							onAuthorChange={form.metadata.setAuthor}
							onDoiChange={form.metadata.setDoi}
							onCategoryChange={form.metadata.setCategory}
						/>

						{/* Legend Configuration */}
						<LegendConfigSection
							legendType={form.legend.legendType}
							legendItems={form.legend.legendItems}
							legendSource={form.legend.legendSource}
							wmsLegendUrl={form.legend.wmsLegendUrl}
							legendImageError={form.legend.legendImageError}
							showWmsOption={form.layerSource === "wms"}
							onLegendTypeChange={form.legend.setLegendType}
							onLegendSourceChange={form.legend.setLegendSource}
							onLegendImageError={() => form.legend.setLegendImageError(true)}
							onAddItem={form.legend.addItem}
							onUpdateItem={form.legend.updateItem}
							onRemoveItem={form.legend.removeItem}
						/>
					</div>

					{/* Submit Button */}
					<div className="p-4 border-t border-slate-200">
						<Button
							onClick={handleSubmit}
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
			)}
		</div>
	);
}
