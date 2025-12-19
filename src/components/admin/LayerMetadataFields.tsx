import { CategorySelector } from "../CategorySelector";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

// ============================================================================
// Types
// ============================================================================

interface LayerMetadataFieldsProps {
	name: string;
	description: string;
	author: string;
	doi: string;
	category: string;
	existingCategories: string[];
	onNameChange: (value: string) => void;
	onDescriptionChange: (value: string) => void;
	onAuthorChange: (value: string) => void;
	onDoiChange: (value: string) => void;
	onCategoryChange: (value: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function LayerMetadataFields({
	name,
	description,
	author,
	doi,
	category,
	existingCategories,
	onNameChange,
	onDescriptionChange,
	onAuthorChange,
	onDoiChange,
	onCategoryChange,
}: LayerMetadataFieldsProps) {
	return (
		<div className="border-t border-slate-200 pt-4">
			<h3 className="text-sm text-slate-700 mb-3">Layer Metadata</h3>

			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="name">Layer Name *</Label>
					<Input
						id="name"
						value={name}
						onChange={(e) => onNameChange(e.target.value)}
						placeholder="My Layer"
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="description">Description</Label>
					<Textarea
						id="description"
						value={description}
						onChange={(e) => onDescriptionChange(e.target.value)}
						placeholder="Describe this layer..."
						rows={3}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="author">Author / Source</Label>
					<Input
						id="author"
						value={author}
						onChange={(e) => onAuthorChange(e.target.value)}
						placeholder="Organization or author name"
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="doi">DOI (optional)</Label>
					<Input
						id="doi"
						value={doi}
						onChange={(e) => onDoiChange(e.target.value)}
						placeholder="10.1234/example"
					/>
				</div>

				<CategorySelector
					value={category}
					onChange={onCategoryChange}
					existingCategories={existingCategories}
				/>
			</div>
		</div>
	);
}
