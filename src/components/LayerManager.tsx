import { Layer } from "../App";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import {
  Eye,
  EyeOff,
  GripVertical,
  X,
  Plus,
  Trash2,
  Library,
  Pencil,
  Info,
  MessageSquare,
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Badge } from "./ui/badge";

interface LayerManagerProps {
  layers: Layer[];
  availableLayers: Layer[];
  onUpdateLayer: (
    layerId: string,
    updates: Partial<Layer>,
  ) => void;
  onReorderLayers: (
    startIndex: number,
    endIndex: number,
  ) => void;
  onAddLayer: (layer: Layer) => void;
  onRemoveLayer: (layerId: string) => void;
  onClose: () => void;
  onOpenLayerCreator: () => void;
  onOpenComments?: (layerId: string) => void;
  getLayerCommentCount?: (layerId: string) => number;
}

export function LayerManager({
  layers,
  availableLayers,
  onUpdateLayer,
  onReorderLayers,
  onAddLayer,
  onRemoveLayer,
  onClose,
  onOpenLayerCreator,
  onOpenComments,
  getLayerCommentCount,
}: LayerManagerProps) {
  const [draggedIndex, setDraggedIndex] = useState<
    number | null
  >(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedLayerInfo, setSelectedLayerInfo] =
    useState<Layer | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (
    e: React.DragEvent,
    index: number,
  ) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    onReorderLayers(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Get layers that are not yet added to the current map
  const layersNotInMap = availableLayers.filter(
    (availableLayer) =>
      !layers.some((layer) => layer.id === availableLayer.id),
  );

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l border-slate-200 flex flex-col shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="text-slate-900">Map Layers</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {showLibrary ? (
        // Layer Library View
        <>
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm text-slate-700">
              Available Layers
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLibrary(false)}
            >
              Back
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {layersNotInMap.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">
                All available layers are already added to this
                map
              </p>
            ) : (
              layersNotInMap.map((layer) => (
                <div
                  key={layer.id}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-slate-900 text-sm truncate"
                        title={layer.name}
                      >
                        {layer.name}
                      </h3>
                      <p className="text-slate-500 text-xs capitalize">
                        {layer.type}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onAddLayer(layer);
                        setShowLibrary(false);
                      }}
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </Button>
                  </div>
                  {layer.legend && (
                    <div className="text-xs text-slate-500">
                      {layer.legend.type === "gradient"
                        ? "Gradient layer"
                        : `${layer.legend.items.length} categories`}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        // Current Layers View
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {layers.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-slate-500 text-sm">
                  No layers added yet
                </p>
                <div className="flex flex-col gap-2 max-w-xs mx-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLibrary(true)}
                  >
                    <Library className="w-3 h-3" />
                    Add from Library
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenLayerCreator}
                  >
                    <Pencil className="w-3 h-3" />
                    Create Layer
                  </Button>
                </div>
              </div>
            ) : (
              layers.map((layer, index) => (
                <div
                  key={layer.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3 cursor-move hover:border-slate-300 transition-colors ${
                    draggedIndex === index ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-slate-900 text-sm">
                        {layer.name}
                      </h3>
                      <p className="text-slate-500 text-xs capitalize">
                        {layer.type}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateLayer(layer.id, {
                            visible: !layer.visible,
                          });
                        }}
                        className="flex-shrink-0"
                      >
                        {layer.visible ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-slate-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLayerInfo(layer);
                        }}
                        className="flex-shrink-0"
                      >
                        <Info className="w-4 h-4 text-slate-600" />
                      </Button>
                      {onOpenComments && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenComments(layer.id);
                          }}
                          className="flex-shrink-0 relative"
                        >
                          <MessageSquare className="w-4 h-4 text-slate-600" />
                          {getLayerCommentCount &&
                            getLayerCommentCount(layer.id) >
                              0 && (
                              <Badge
                                variant="destructive"
                                className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                              >
                                {getLayerCommentCount(layer.id)}
                              </Badge>
                            )}
                        </Button>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveLayer(layer.id);
                      }}
                      className="flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-slate-600">
                        Opacity
                      </label>
                      <span className="text-xs text-slate-500">
                        {Math.round(layer.opacity * 100)}%
                      </span>
                    </div>
                    <Slider
                      value={[layer.opacity * 100]}
                      onValueChange={(values) =>
                        onUpdateLayer(layer.id, {
                          opacity: values[0] / 100,
                        })
                      }
                      max={100}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {layers.length > 0 && (
            <div className="p-4 border-t border-slate-200 space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLibrary(true)}
                className="w-full"
              >
                <Library className="w-3 h-3" />
                Add from Library
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenLayerCreator}
                className="w-full"
              >
                <Pencil className="w-3 h-3" />
                Create Layer
              </Button>
            </div>
          )}
        </>
      )}

      {/* Layer Info Dialog */}
      <Dialog
        open={!!selectedLayerInfo}
        onOpenChange={() => setSelectedLayerInfo(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedLayerInfo?.name}</DialogTitle>
            <DialogDescription className="capitalize">
              {selectedLayerInfo?.type} Layer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedLayerInfo?.description && (
              <div>
                <h4 className="text-sm text-slate-700 mb-1">
                  Description
                </h4>
                <p className="text-sm text-slate-600">
                  {selectedLayerInfo.description}
                </p>
              </div>
            )}

            {selectedLayerInfo?.author && (
              <div>
                <h4 className="text-sm text-slate-700 mb-1">
                  Author
                </h4>
                <p className="text-sm text-slate-600">
                  {selectedLayerInfo.author}
                </p>
              </div>
            )}

            {selectedLayerInfo?.doi && (
              <div>
                <h4 className="text-sm text-slate-700 mb-1">
                  DOI
                </h4>
                <a
                  href={`https://doi.org/${selectedLayerInfo.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-teal-600 hover:text-teal-700 hover:underline"
                >
                  {selectedLayerInfo.doi}
                </a>
              </div>
            )}

            {selectedLayerInfo?.legend && (
              <div>
                <h4 className="text-sm text-slate-700 mb-2">
                  Legend
                </h4>
                {selectedLayerInfo.legend.type ===
                "gradient" ? (
                  <div className="space-y-2">
                    <div
                      className="h-4 rounded"
                      style={{
                        background: `linear-gradient(to right, ${selectedLayerInfo.legend.items.map((item) => item.color).join(", ")})`,
                      }}
                    />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>
                        {
                          selectedLayerInfo.legend.items[0]
                            ?.label
                        }
                      </span>
                      <span>
                        {
                          selectedLayerInfo.legend.items[
                            selectedLayerInfo.legend.items
                              .length - 1
                          ]?.label
                        }
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedLayerInfo.legend.items.map(
                      (item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2"
                        >
                          <div
                            className="w-4 h-4 rounded border border-slate-300"
                            style={{
                              backgroundColor: item.color,
                            }}
                          />
                          <span className="text-sm text-slate-600">
                            {item.label}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedLayerInfo?.features &&
              selectedLayerInfo.features.length > 0 && (
                <div>
                  <h4 className="text-sm text-slate-700 mb-1">
                    Features
                  </h4>
                  <p className="text-sm text-slate-600">
                    {selectedLayerInfo.features.length}{" "}
                    feature(s)
                  </p>
                </div>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}