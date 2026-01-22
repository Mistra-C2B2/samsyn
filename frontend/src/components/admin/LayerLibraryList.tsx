import {
	ArrowUpDown,
	Edit,
	Search,
	SlidersHorizontal,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import type { Layer } from "../../App";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";

// ============================================================================
// Types
// ============================================================================

interface LayerLibraryListProps {
	layers: Layer[];
	layerToDelete: Layer | null;
	onEdit: (layer: Layer) => void;
	onDeleteRequest: (layer: Layer) => void;
	onDeleteConfirm: () => void;
	onDeleteCancel: () => void;
	title?: string;
	subtitle?: string;
	emptyMessage?: string;
}

// ============================================================================
// Component
// ============================================================================

export function LayerLibraryList({
	layers,
	layerToDelete,
	onEdit,
	onDeleteRequest,
	onDeleteConfirm,
	onDeleteCancel,
	title = "Library Layers",
	subtitle = "Library layer",
	emptyMessage = "No layers in library",
}: LayerLibraryListProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState<"name" | "category">("name");
	const [filterCategory, setFilterCategory] = useState<string>("all");

	// Get unique categories for filters
	const uniqueCategories = Array.from(
		new Set(layers.map((l) => l.category).filter((c): c is string => !!c)),
	);

	// Filter and sort layers
	const getFilteredAndSortedLayers = () => {
		let filtered = layers;

		// Apply search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(layer) =>
					layer.name.toLowerCase().includes(query) ||
					layer.description?.toLowerCase().includes(query),
			);
		}

		// Apply category filter
		if (filterCategory !== "all") {
			filtered = filtered.filter((layer) => layer.category === filterCategory);
		}

		// Apply sorting
		filtered = [...filtered].sort((a, b) => {
			if (sortBy === "name") {
				return a.name.localeCompare(b.name);
			} else if (sortBy === "category") {
				return (a.category || "").localeCompare(b.category || "");
			}
			return 0;
		});

		return filtered;
	};

	const filteredLayers = getFilteredAndSortedLayers();

	return (
		<>
			<div className="flex-1 overflow-y-auto p-4 space-y-2">
				<h3 className="text-sm text-slate-700 mb-2">
					{title} ({layers.length})
				</h3>

				{/* Search Box */}
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
					<Input
						type="text"
						placeholder="Search layers..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-9"
					/>
				</div>

				{/* Sort Control */}
				<Select
					value={sortBy}
					onValueChange={(v) => setSortBy(v as "name" | "category")}
				>
					<SelectTrigger className="w-full">
						<div className="flex items-center gap-2">
							<ArrowUpDown className="w-3 h-3" />
							<span className="text-xs">Sort by: {sortBy}</span>
						</div>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="name">Name</SelectItem>
						<SelectItem value="category">Category</SelectItem>
					</SelectContent>
				</Select>

				{uniqueCategories.length > 0 && (
					<Select value={filterCategory} onValueChange={setFilterCategory}>
						<SelectTrigger className="w-full">
							<div className="flex items-center gap-2">
								<SlidersHorizontal className="w-3 h-3" />
								<span className="text-xs">
									Category: {filterCategory === "all" ? "All" : filterCategory}
								</span>
							</div>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Categories</SelectItem>
							{uniqueCategories.map((category) => (
								<SelectItem key={category} value={category}>
									{category}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}

				{layers.length === 0 ? (
					<p className="text-slate-500 text-sm text-center py-8">
						{emptyMessage}
					</p>
				) : filteredLayers.length === 0 ? (
					<p className="text-slate-500 text-sm text-center py-8">
						No layers match your search
					</p>
				) : (
					filteredLayers.map((layer) => (
						<div
							key={layer.id}
							className="bg-slate-50 border border-slate-200 rounded-lg p-3"
						>
							<div className="flex items-start gap-2 mb-2">
								<div className="flex-1 min-w-0">
									<h3 className="text-slate-900 text-sm">{layer.name}</h3>
									<p className="text-slate-500 text-xs">{subtitle}</p>
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
											onClick={() => onEdit(layer)}
										>
											<Edit className="w-4 h-4 text-teal-600" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => onDeleteRequest(layer)}
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

			{/* Delete Confirmation Dialog */}
			<AlertDialog
				open={!!layerToDelete}
				onOpenChange={(open) => !open && onDeleteCancel()}
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
							onClick={onDeleteConfirm}
							className="bg-red-600 hover:bg-red-700"
						>
							Delete Layer
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
