import { useState } from "react";
import { UserMap } from "../App";
import { Button } from "./ui/button";
import { X, Plus, Map, Pencil, Trash2 } from "lucide-react";
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

interface MapSelectorProps {
  maps: UserMap[];
  currentMapId: string;
  onSelectMap: (mapId: string) => void;
  onCreateMap: (name: string, description: string, permissions: { editAccess: 'private' | 'collaborators' | 'public'; collaborators: string[]; visibility: 'private' | 'public' }) => void;
  onEditMap: (mapId: string, name: string, description: string, permissions: { editAccess: 'private' | 'collaborators' | 'public'; collaborators: string[]; visibility: 'private' | 'public' }) => void;
  onDeleteMap: (mapId: string) => void;
  onClose: () => void;
  onOpenLayerManager: () => void;
}

export function MapSelector({
  maps,
  currentMapId,
  onSelectMap,
  onCreateMap,
  onEditMap,
  onDeleteMap,
  onClose,
  onOpenLayerManager,
}: MapSelectorProps) {
  const [showCreateWizard, setShowCreateWizard] =
    useState(false);
  const [editingMap, setEditingMap] = useState<UserMap | null>(null);
  const [deletingMap, setDeletingMap] = useState<UserMap | null>(null);

  const handleCreate = (name: string, description: string, permissions: { editAccess: 'private' | 'collaborators' | 'public'; collaborators: string[]; visibility: 'private' | 'public' }) => {
    onCreateMap(name, description, permissions);
  };

  const handleEdit = (name: string, description: string, permissions: { editAccess: 'private' | 'collaborators' | 'public'; collaborators: string[]; visibility: 'private' | 'public' }) => {
    if (editingMap) {
      onEditMap(editingMap.id, name, description, permissions);
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

  const handleDelete = () => {
    if (deletingMap) {
      onDeleteMap(deletingMap.id);
      setDeletingMap(null);
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
          {maps.map((map) => (
            <div
              key={map.id}
              className={`w-full text-left p-3 rounded-lg border-2 transition-all cursor-pointer ${
                map.id === currentMapId
                  ? "bg-teal-50 border-teal-600"
                  : "border-slate-200 hover:border-teal-400"
              }`}
            >
              <div className="flex items-start gap-3">
                <div 
                  className="flex-1 flex items-start gap-3"
                  onClick={() => {
                    onSelectMap(map.id);
                    onOpenLayerManager(); {/* Open layer manager after selecting map */}
                  }}
                >
                  <div className={`p-2 rounded ${map.id === currentMapId ? "bg-teal-100" : "bg-slate-100"}`}>
                    <Map className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-slate-900 truncate">
                      {map.name}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                      {map.description}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {map.layers.length} layer
                      {map.layers.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleEditClick(e, map)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDeleteClick(e, map)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-200">
          <Button
            onClick={() => setShowCreateWizard(true)}
            className="w-full"
          >
            <Plus className="w-4 h-4" />
            Create New Map
          </Button>
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

      <AlertDialog open={!!deletingMap} onOpenChange={() => setDeletingMap(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the map and remove all of its data.
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
    </>
  );
}