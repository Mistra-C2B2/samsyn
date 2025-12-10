import { CategorySelector } from "../CategorySelector";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

// ============================================================================
// Types
// ============================================================================

interface LayerMetadataFormProps {
	layerName: string;
	setLayerName: (value: string) => void;
	category: string;
	setCategory: (value: string) => void;
	description: string;
	setDescription: (value: string) => void;
	layerColor: string;
	setLayerColor: (value: string) => void;
	existingCategories: string[];
}

// ============================================================================
// Component
// ============================================================================

export function LayerMetadataForm({
	layerName,
	setLayerName,
	category,
	setCategory,
	description,
	setDescription,
	layerColor,
	setLayerColor,
	existingCategories,
}: LayerMetadataFormProps) {
	return (
		<>
			{/* Layer Name */}
			<div className="space-y-2">
				<Label htmlFor="layer-name">Layer Name</Label>
				<Input
					id="layer-name"
					placeholder="e.g., Fishing Zones"
					value={layerName}
					onChange={(e) => setLayerName(e.target.value)}
				/>
			</div>

			{/* Category */}
			<CategorySelector
				value={category}
				onChange={setCategory}
				existingCategories={existingCategories}
			/>

			{/* Description */}
			<div className="space-y-2">
				<Label htmlFor="layer-description">Layer Description (optional)</Label>
				<Textarea
					id="layer-description"
					placeholder="Describe this layer..."
					value={description}
					onChange={(e) => setDescription(e.target.value)}
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
		</>
	);
}
