import { useState } from 'react';
import { Layer } from '../App';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { CategorySelector } from './CategorySelector';
import { X, Trash2, MapPin, Milestone, Square, Anchor, Ship, AlertTriangle, Circle } from 'lucide-react';

interface LayerCreatorProps {
  onCreateLayer: (layer: Layer) => void;
  onClose: () => void;
  onStartDrawing?: (type: 'Point' | 'LineString' | 'Polygon', callback: (feature: any) => void) => void;
  availableLayers?: Layer[];
}

type GeometryType = 'Point' | 'LineString' | 'Polygon';
type IconType = 'default' | 'anchor' | 'ship' | 'warning' | 'circle';
type LineStyle = 'solid' | 'dashed' | 'dotted';

interface Feature {
  type: GeometryType;
  name: string;
  description: string;
  coordinates: any;
  icon?: IconType;
  lineStyle?: LineStyle;
}

export function LayerCreator({ onCreateLayer, onClose, onStartDrawing, availableLayers }: LayerCreatorProps) {
  const [layerName, setLayerName] = useState('');
  const [layerColor, setLayerColor] = useState('#3b82f6');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [features, setFeatures] = useState<Feature[]>([]);

  // Get unique categories from existing layers
  const existingCategories = availableLayers 
    ? Array.from(new Set(availableLayers.map(l => l.category).filter((c): c is string => !!c))).sort()
    : [];

  const addFeatureByDrawing = (type: GeometryType) => {
    if (!onStartDrawing) return;

    onStartDrawing(type, (drawnFeature) => {
      const newFeature: Feature = {
        type,
        name: '',
        description: '',
        coordinates: drawnFeature.geometry.coordinates,
        icon: type === 'Point' ? 'default' : undefined,
        lineStyle: type === 'LineString' ? 'solid' : undefined,
      };
      setFeatures([...features, newFeature]);
    });
  };

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  const updateFeature = (index: number, field: keyof Feature, value: any) => {
    setFeatures(
      features.map((f, i) =>
        i === index ? { ...f, [field]: value } : f
      )
    );
  };

  const handleCreate = () => {
    if (!layerName.trim() || features.length === 0) return;

    const geoJsonFeatures = features
      .filter(f => f.name.trim())
      .map((feature) => ({
        type: 'Feature' as const,
        properties: { 
          name: feature.name,
          description: feature.description,
          featureType: feature.type,
          icon: feature.icon,
          lineStyle: feature.lineStyle,
        },
        geometry: {
          type: feature.type,
          coordinates: feature.coordinates,
        },
      }));

    if (geoJsonFeatures.length === 0) return;

    const newLayer: Layer = {
      id: `layer-${Date.now()}`,
      name: layerName,
      type: 'geojson',
      visible: true,
      opacity: 0.7,
      color: layerColor,
      data: {
        type: 'FeatureCollection',
        features: geoJsonFeatures,
      },
      legend: {
        type: 'categories',
        items: [
          { color: layerColor, label: layerName }
        ],
      },
      category: category || undefined,
      description: description || undefined,
    };

    onCreateLayer(newLayer);
  };

  const getIcon = (type: GeometryType) => {
    switch (type) {
      case 'Point':
        return <MapPin className="w-4 h-4" />;
      case 'LineString':
        return <Milestone className="w-4 h-4" />;
      case 'Polygon':
        return <Square className="w-4 h-4" />;
    }
  };

  const getIconComponent = (iconType: IconType) => {
    const iconClass = "w-4 h-4";
    switch (iconType) {
      case 'anchor':
        return <Anchor className={iconClass} />;
      case 'ship':
        return <Ship className={iconClass} />;
      case 'warning':
        return <AlertTriangle className={iconClass} />;
      case 'circle':
        return <Circle className={iconClass} />;
      default:
        return <MapPin className={iconClass} />;
    }
  };

  const getCoordinatesSummary = (feature: Feature) => {
    if (feature.type === 'Point') {
      const [lng, lat] = feature.coordinates;
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } else if (feature.type === 'LineString') {
      return `${feature.coordinates.length} points`;
    } else if (feature.type === 'Polygon') {
      return `${feature.coordinates[0].length - 1} vertices`;
    }
    return '';
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-white border-l border-slate-200 flex flex-col shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="text-slate-900">Create Layer</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="layer-name">Layer Name</Label>
          <Input
            id="layer-name"
            placeholder="e.g., Fishing Zones"
            value={layerName}
            onChange={(e) => setLayerName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="layer-color">Layer Color</Label>
          <div className="flex gap-2">
            <input
              id="layer-color"
              type="color"
              value={layerColor}
              onChange={(e) => setLayerColor(e.target.value)}
              className="w-12 h-10 rounded border border-slate-200 cursor-pointer"
            />
            <Input
              value={layerColor}
              onChange={(e) => setLayerColor(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        <CategorySelector
          value={category}
          onChange={setCategory}
          existingCategories={existingCategories}
        />

        <div className="space-y-2">
          <Label htmlFor="layer-description">Description (optional)</Label>
          <Textarea
            id="layer-description"
            placeholder="Describe this layer..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-3">
          <Label>Draw Features on Map</Label>
          <div className="grid grid-cols-3 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => addFeatureByDrawing('Point')}
              className="flex flex-col h-auto py-3"
            >
              <MapPin className="w-5 h-5 mb-1" />
              <span className="text-xs">Add Point</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => addFeatureByDrawing('LineString')}
              className="flex flex-col h-auto py-3"
            >
              <Milestone className="w-5 h-5 mb-1" />
              <span className="text-xs">Add Line</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => addFeatureByDrawing('Polygon')}
              className="flex flex-col h-auto py-3"
            >
              <Square className="w-5 h-5 mb-1" />
              <span className="text-xs">Add Polygon</span>
            </Button>
          </div>
        </div>

        {features.length > 0 && (
          <div className="space-y-3">
            <Label>Features ({features.length})</Label>
            {features.map((feature, index) => (
              <div key={index} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getIcon(feature.type)}
                    <span className="text-xs text-slate-600">{feature.type}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFeature(index)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>

                <Input
                  placeholder="Feature name (required)"
                  value={feature.name}
                  onChange={(e) => updateFeature(index, 'name', e.target.value)}
                />

                <Textarea
                  placeholder="Description (optional)"
                  value={feature.description}
                  onChange={(e) => updateFeature(index, 'description', e.target.value)}
                  rows={2}
                />

                {feature.type === 'Point' && (
                  <div className="space-y-2">
                    <Label className="text-xs">Icon Style</Label>
                    <div className="grid grid-cols-5 gap-1">
                      {(['default', 'anchor', 'ship', 'warning', 'circle'] as IconType[]).map((iconType) => (
                        <button
                          key={iconType}
                          onClick={() => updateFeature(index, 'icon', iconType)}
                          className={`p-2 rounded border transition-colors ${
                            feature.icon === iconType
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {getIconComponent(iconType)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {feature.type === 'LineString' && (
                  <div className="space-y-2">
                    <Label className="text-xs">Line Style</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['solid', 'dashed', 'dotted'] as LineStyle[]).map((style) => (
                        <button
                          key={style}
                          onClick={() => updateFeature(index, 'lineStyle', style)}
                          className={`p-2 rounded border text-xs capitalize transition-colors ${
                            feature.lineStyle === style
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-slate-500">
                  {getCoordinatesSummary(feature)}
                </div>
              </div>
            ))}
          </div>
        )}

        {features.length === 0 && (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <p className="text-sm text-slate-600">
              Click a button above to start drawing features on the map
            </p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200">
        <Button 
          onClick={handleCreate} 
          className="w-full"
          disabled={!layerName.trim() || features.length === 0}
        >
          Create Layer
        </Button>
      </div>
    </div>
  );
}