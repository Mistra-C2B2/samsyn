import { Edit, Trash2 } from "lucide-react";
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
}: LayerLibraryListProps) {
	return (
		<>
			<div className="flex-1 overflow-y-auto p-4 space-y-2">
				<h3 className="text-sm text-slate-700 mb-2">
					Library Layers ({layers.length})
				</h3>
				{layers.length === 0 ? (
					<p className="text-slate-500 text-sm text-center py-8">
						No layers in library
					</p>
				) : (
					layers.map((layer) => (
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
