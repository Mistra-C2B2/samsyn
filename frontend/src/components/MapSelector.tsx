import { useUser } from "@clerk/clerk-react";
import {
	Info,
	Loader2,
	Lock,
	Map as MapIcon,
	Pencil,
	Plus,
	Trash2,
	X,
} from "lucide-react";
import { useState } from "react";
import type { UserMap } from "../App";
import { InfoDialog } from "./InfoDialog";
import { MapCreationWizard } from "./MapCreationWizard";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

interface MapSelectorProps {
	maps: UserMap[];
	currentMapId: string;
	loading?: boolean;
	onSelectMap: (mapId: string) => void;
	onCreateMap: (
		name: string,
		description: string,
		permissions: {
			editAccess: "private" | "collaborators" | "public";
			collaborators: string[];
			visibility: "private" | "public";
		},
	) => Promise<void>;
	onEditMap: (
		mapId: string,
		name: string,
		description: string,
		permissions: {
			editAccess: "private" | "collaborators" | "public";
			collaborators: string[];
			visibility: "private" | "public";
		},
	) => Promise<void>;
	onDeleteMap: (mapId: string) => Promise<void>;
	onClose: () => void;
	onOpenLayerManager: () => void;
}

export function MapSelector({
	maps,
	currentMapId,
	loading = false,
	onSelectMap,
	onCreateMap,
	onEditMap,
	onDeleteMap,
	onClose,
	onOpenLayerManager,
}: MapSelectorProps) {
	const { isSignedIn } = useUser();
	const [showCreateWizard, setShowCreateWizard] = useState(false);
	const [editingMap, setEditingMap] = useState<UserMap | null>(null);
	const [deletingMap, setDeletingMap] = useState<UserMap | null>(null);
	const [infoMap, setInfoMap] = useState<UserMap | null>(null);

	const handleCreate = async (
		name: string,
		description: string,
		permissions: {
			editAccess: "private" | "collaborators" | "public";
			collaborators: string[];
			visibility: "private" | "public";
		},
	) => {
		await onCreateMap(name, description, permissions);
	};

	const handleEdit = async (
		name: string,
		description: string,
		permissions: {
			editAccess: "private" | "collaborators" | "public";
			collaborators: string[];
			visibility: "private" | "public";
		},
	) => {
		if (editingMap) {
			await onEditMap(editingMap.id, name, description, permissions);
			setEditingMap(null);
		}
	};

	const handleEditClick = (e: React.MouseEvent, map: UserMap) => {
		e.stopPropagation(); // Prevent map selection
		setEditingMap(map);
	};

	const handleDeleteClick = (e: React.MouseEvent, map: UserMap) => {
		e.stopPropagation(); // Prevent map selection
		setDeletingMap(map);
	};

	const handleInfoClick = (e: React.MouseEvent, map: UserMap) => {
		e.stopPropagation(); // Prevent map selection
		setInfoMap(map);
	};

	const handleDelete = async () => {
		if (deletingMap) {
			try {
				await onDeleteMap(deletingMap.id);
				setDeletingMap(null);
			} catch {
				// Error is already shown in toast by App.tsx
				// Just close the dialog so user can see the error
				setDeletingMap(null);
			}
		}
	};

	return (
		<>
			<div className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l border-slate-200 flex flex-col shadow-lg">
				<div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
					<h2 className="text-slate-900">Maps</h2>
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X className="w-4 h-4" />
					</Button>
				</div>

				<div className="flex-1 overflow-y-auto p-4 space-y-2">
					{loading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="w-6 h-6 animate-spin text-teal-600" />
						</div>
					) : maps.length === 0 ? (
						<div className="text-center py-8 text-slate-500">
							<p>No maps yet</p>
							<p className="text-sm mt-2">
								Create your first map to get started
							</p>
						</div>
					) : (
						maps.map((map) => {
							// Permission checks based on user_role
							const canEdit =
								map.user_role === "owner" || map.user_role === "editor";
							const canDelete = map.user_role === "owner";
							const isReadOnly = map.user_role === "viewer";

							return (
								<div
									key={map.id}
									className={`w-full rounded-lg border transition-all ${
										map.id === currentMapId
											? "bg-teal-50 border-teal-600"
											: "border-slate-200 hover:border-teal-400 hover:bg-slate-50"
									}`}
								>
									<div className="p-3 space-y-3">
										<button
											type="button"
											className="w-full flex items-start gap-3 bg-transparent border-0 p-0 text-left cursor-pointer"
											onClick={() => {
												onSelectMap(map.id);
												onOpenLayerManager();
											}}
										>
											<div
												className={`p-2 rounded ${
													map.id === currentMapId
														? "bg-teal-100"
														: "bg-slate-100"
												}`}
											>
												<MapIcon className="w-4 h-4" />
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2">
													<h3 className="font-medium text-sm text-slate-900 truncate">
														{map.name}
													</h3>
													{isReadOnly && (
														<div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs flex-shrink-0">
															<Lock className="w-3 h-3" />
															<span>Read-only</span>
														</div>
													)}
												</div>
												<p className="text-xs text-slate-600 line-clamp-2 mt-1 min-w-0 overflow-hidden break-words">
													{map.description}
												</p>
												<p className="text-xs text-slate-500 mt-1">
													{map.layers.length} layer
													{map.layers.length !== 1 ? "s" : ""}
												</p>
											</div>
										</button>

										<div className="flex items-center justify-between">
											<div className="flex items-center gap-1">
												{map.description && (
													<Button
														variant="ghost"
														size="sm"
														onClick={(e) => handleInfoClick(e, map)}
														className="flex-shrink-0"
													>
														<Info className="w-4 h-4 text-slate-600" />
													</Button>
												)}
												{isSignedIn && canEdit && (
													<Button
														variant="ghost"
														size="sm"
														onClick={(e) => handleEditClick(e, map)}
														className="flex-shrink-0"
													>
														<Pencil className="w-4 h-4" />
													</Button>
												)}
											</div>
											{isSignedIn && canDelete && (
												<Button
													variant="ghost"
													size="sm"
													onClick={(e) => handleDeleteClick(e, map)}
													className="flex-shrink-0"
												>
													<Trash2 className="w-4 h-4 text-red-500" />
												</Button>
											)}
										</div>
									</div>
								</div>
							);
						})
					)}
				</div>

				<div className="p-4 border-t border-slate-200">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="w-full inline-block">
									<Button
										onClick={() => setShowCreateWizard(true)}
										className="w-full"
										disabled={!isSignedIn}
									>
										<Plus className="w-4 h-4" />
										Create New Map
									</Button>
								</span>
							</TooltipTrigger>
							{!isSignedIn && (
								<TooltipContent>
									<p>Please sign in to create a new map</p>
								</TooltipContent>
							)}
						</Tooltip>
					</TooltipProvider>
				</div>
			</div>

			<MapCreationWizard
				isOpen={showCreateWizard}
				onClose={() => setShowCreateWizard(false)}
				onCreate={handleCreate}
				onOpenLayerManager={onOpenLayerManager}
			/>

			<MapCreationWizard
				isOpen={!!editingMap}
				onClose={() => setEditingMap(null)}
				onCreate={handleEdit}
				onOpenLayerManager={onOpenLayerManager}
				editMode={true}
				existingMap={editingMap || undefined}
			/>

			<AlertDialog
				open={!!deletingMap}
				onOpenChange={() => setDeletingMap(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the map
							and remove all of its data.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<InfoDialog
				open={!!infoMap}
				onOpenChange={() => setInfoMap(null)}
				title={infoMap?.name || ""}
				subtitle="Map"
				sections={[
					infoMap?.description && {
						title: "Description",
						content: infoMap.description,
					},
					infoMap && {
						title: "Layers",
						content: `${infoMap.layers.length} layer${infoMap.layers.length !== 1 ? "s" : ""}`,
					},
				]}
			/>
		</>
	);
}
