import { Layer } from "../App";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Input } from "./ui/input";
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
  Search,
  SlidersHorizontal,
  ArrowUpDown,
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Badge } from "./ui/badge";

interface LayerManagerProps {
  layers: Layer[];
  availableLayers: Layer[];
  mapName: string;
  basemap: string;
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
  onEditLayer?: (layer: Layer) => void;
  onChangeBasemap: (basemap: string) => void;
  onOpenComments?: (layerId: string) => void;
  getLayerCommentCount?: (layerId: string) => number;
}

export function LayerManager({
  layers,
  availableLayers,
  mapName,
  basemap,
  onUpdateLayer,
  onReorderLayers,
  onAddLayer,
  onRemoveLayer,
  onClose,
  onOpenLayerCreator,
  onEditLayer,
  onChangeBasemap,
  onOpenComments,
  getLayerCommentCount,
}: LayerManagerProps) {
  const [draggedIndex, setDraggedIndex] = useState<
    number | null
  >(null);
  const [dragOverIndex, setDragOverIndex] = useState<
    number | null
  >(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedLayerInfo, setSelectedLayerInfo] =
    useState<Layer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "name" | "type" | "category"
  >("name");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] =
    useState<string>("all");

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
    setDragOverIndex(null);
  };

  const handleDragOver = (
    e: React.DragEvent,
    index: number,
  ) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      onReorderLayers(draggedIndex, dragOverIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Get layers that are not yet added to the current map
  const layersNotInMap = availableLayers.filter(
    (availableLayer) =>
      !layers.some((layer) => layer.id === availableLayer.id),
  );

  // Get unique types and categories for filters
  const uniqueTypes = Array.from(
    new Set(layersNotInMap.map((l) => l.type)),
  );
  const uniqueCategories = Array.from(
    new Set(
      layersNotInMap
        .map((l) => l.category)
        .filter((c): c is string => !!c),
    ),
  );

  // Filter and sort layers
  const getFilteredAndSortedLayers = () => {
    let filtered = layersNotInMap;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (layer) =>
          layer.name
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          layer.description
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()),
      );
    }

    // Apply type filter
    if (filterType !== "all") {
      filtered = filtered.filter(
        (layer) => layer.type === filterType,
      );
    }

    // Apply category filter
    if (filterCategory !== "all") {
      filtered = filtered.filter(
        (layer) => layer.category === filterCategory,
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      } else if (sortBy === "type") {
        return a.type.localeCompare(b.type);
      } else if (sortBy === "category") {
        return (a.category || "").localeCompare(
          b.category || "",
        );
      }
      return 0;
    });

    return filtered;
  };

  const filteredLayers = getFilteredAndSortedLayers();

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l border-slate-200 flex flex-col shadow-lg">
      {!showLibrary && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            <h2 className="text-slate-900">Layers</h2>
            <p className="text-xs text-slate-500 truncate">
              {mapName}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {showLibrary ? (
        // Layer Library View
        <>
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm text-slate-700">
              Add from Library
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

            {/* Sort and Filter Controls */}
            <div className="flex gap-2">
              <Select
                value={sortBy}
                onValueChange={(v) =>
                  setSortBy(v as "name" | "type" | "category")
                }
              >
                <SelectTrigger className="flex-1">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="w-3 h-3" />
                    <span className="text-xs">
                      Sort by: {sortBy}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="category">
                    Category
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filterType}
                onValueChange={setFilterType}
              >
                <SelectTrigger className="flex-1">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-3 h-3" />
                    <span className="text-xs">Type</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTypes.map((type) => (
                    <SelectItem
                      key={type}
                      value={type}
                      className="capitalize"
                    >
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {uniqueCategories.length > 0 && (
              <Select
                value={filterCategory}
                onValueChange={setFilterCategory}
              >
                <SelectTrigger className="w-full">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-3 h-3" />
                    <span className="text-xs">
                      Category:{" "}
                      {filterCategory === "all"
                        ? "All"
                        : filterCategory}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Categories
                  </SelectItem>
                  {uniqueCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Results */}
            <div className="pt-2 space-y-2">
              {filteredLayers.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">
                  {layersNotInMap.length === 0
                    ? "All available layers are already added to this map"
                    : "No layers match your search criteria"}
                </p>
              ) : (
                filteredLayers.map((layer) => (
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
                        <div className="flex items-center gap-2">
                          <p className="text-slate-500 text-xs capitalize">
                            {layer.type}
                          </p>
                          {layer.category && (
                            <Badge
                              variant="outline"
                              className="text-xs"
                            >
                              {layer.category}
                            </Badge>
                          )}
                        </div>
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
          </div>
        </>
      ) : (
        // Current Layers View
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {/* Basemap Selector */}
            <div className="flex items-center gap-2 px-2 py-1.5">
              <label className="text-xs text-slate-600 whitespace-nowrap">
                Basemap:
              </label>
              <Select
                value={basemap}
                onValueChange={onChangeBasemap}
              >
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="osm">
                    OpenStreetMap
                  </SelectItem>
                  <SelectItem value="carto-light">
                    Carto Light
                  </SelectItem>
                  <SelectItem value="carto-dark">
                    Carto Dark
                  </SelectItem>
                  <SelectItem value="voyager">
                    Carto Voyager
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                    size="sm"
                    onClick={onOpenLayerCreator}
                    className="w-full"
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
                  } ${
                    dragOverIndex === index && draggedIndex !== index ? "border-teal-500 border-2" : ""
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
                      {layer.createdBy &&
                        layer.editable === "everyone" &&
                        onEditLayer && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditLayer(layer);
                            }}
                            className="flex-shrink-0"
                            title="Edit layer"
                          >
                            <Pencil className="w-4 h-4" />
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
                      className="w-full [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-thumb]]:size-3"
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
                className="w-full hover:border-teal-400 hover:bg-white hover:text-slate-900"
              >
                <Library className="w-3 h-3" />
                Add from Library
              </Button>
              <Button
                size="sm"
                onClick={onOpenLayerCreator}
                className="w-full"
              >
                <Plus className="w-4 h-4" />
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