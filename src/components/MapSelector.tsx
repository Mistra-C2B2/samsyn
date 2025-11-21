import { useState } from 'react';
import { UserMap } from '../App';
import { Button } from './ui/button';
import { X, Plus, Map } from 'lucide-react';
import { MapCreationWizard } from './MapCreationWizard';

interface MapSelectorProps {
  maps: UserMap[];
  currentMapId: string;
  onSelectMap: (mapId: string) => void;
  onCreateMap: (name: string, description: string) => void;
  onClose: () => void;
  onOpenLayerManager: () => void;
}

export function MapSelector({
  maps,
  currentMapId,
  onSelectMap,
  onCreateMap,
  onClose,
  onOpenLayerManager,
}: MapSelectorProps) {
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const handleCreate = (name: string, description: string) => {
    onCreateMap(name, description);
  };

  return (
    <>
      <div className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l border-slate-200 flex flex-col shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 className="text-slate-900">Your Maps</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {maps.map((map) => (
            <button
              key={map.id}
              onClick={() => {
                onSelectMap(map.id);
                onClose();
              }}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                map.id === currentMapId
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-2">
                <Map className="w-4 h-4 text-slate-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm text-slate-900 truncate">{map.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                    {map.description}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {map.layers.length} layer{map.layers.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-slate-200">
          <Button onClick={() => setShowCreateWizard(true)} className="w-full">
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
    </>
  );
}