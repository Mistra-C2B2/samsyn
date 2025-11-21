import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { MapPin, Layers, ArrowRight, Check } from 'lucide-react';

interface MapCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
  onOpenLayerManager: () => void;
}

type Step = 'create' | 'success';

export function MapCreationWizard({
  isOpen,
  onClose,
  onCreate,
  onOpenLayerManager,
}: MapCreationWizardProps) {
  const [step, setStep] = useState<Step>('create');
  const [mapName, setMapName] = useState('');
  const [mapDescription, setMapDescription] = useState('');

  const handleCreate = () => {
    if (mapName.trim()) {
      onCreate(mapName, mapDescription);
      setStep('success');
    }
  };

  const handleClose = () => {
    setStep('create');
    setMapName('');
    setMapDescription('');
    onClose();
  };

  const handleAddLayers = () => {
    handleClose();
    onOpenLayerManager();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        {step === 'create' ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <DialogTitle>Create a New Map</DialogTitle>
                  <DialogDescription>
                    Give your map a name and description to get started
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="map-name">Map Name *</Label>
                <Input
                  id="map-name"
                  placeholder="e.g., Baltic Sea Fishing Activity"
                  value={mapName}
                  onChange={(e) => setMapName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && mapName.trim()) {
                      handleCreate();
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="map-description">Description</Label>
                <Textarea
                  id="map-description"
                  placeholder="Describe the purpose of this map and what information it will contain..."
                  value={mapDescription}
                  onChange={(e) => setMapDescription(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!mapName.trim()}>
                Create Map
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex flex-col items-center gap-4 mb-2">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-center">
                  <DialogTitle className="text-2xl mb-2">Map Created Successfully!</DialogTitle>
                  <DialogDescription className="text-base">
                    Your map "{mapName}" has been created
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="bg-slate-50 rounded-lg p-6 my-4 border border-slate-200">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-slate-900 mb-1">Next Step: Add Layers</h3>
                  <p className="text-sm text-slate-600">
                    Your map is empty right now. Add data layers to visualize information like fish stocks, fishing zones, or protected areas.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleClose} className="sm:flex-1">
                I'll Do It Later
              </Button>
              <Button onClick={handleAddLayers} className="sm:flex-1">
                <Layers className="w-4 h-4 mr-2" />
                Add Layers Now
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
