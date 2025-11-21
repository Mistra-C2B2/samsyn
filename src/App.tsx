import { useState, useRef } from 'react';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { MapView, MapViewRef } from './components/MapView';
import { LayerManager } from './components/LayerManager';
import { MapSelector } from './components/MapSelector';
import { CommentSection } from './components/CommentSection';
import { LayerCreator } from './components/LayerCreator';
import { AdminPanel } from './components/AdminPanel';
import { Button } from './components/ui/button';
import { Layers, Map, MessageSquare, Shield } from 'lucide-react';

export interface Layer {
  id: string;
  name: string;
  type: 'geojson' | 'heatmap' | 'markers' | 'raster' | 'vector';
  visible: boolean;
  opacity: number;
  data?: any;
  color?: string;
  description?: string;
  author?: string;
  doi?: string;
  category?: string;
  // WMS properties
  wmsUrl?: string;
  wmsLayerName?: string;
  // GeoTIFF properties
  geotiffUrl?: string;
  // Vector properties
  features?: any[];
  legend?: {
    type: 'gradient' | 'categories';
    items: Array<{ color: string; label: string; value?: number }>;
  };
}

export interface UserMap {
  id: string;
  name: string;
  description: string;
  layers: Layer[];
  center: [number, number];
  zoom: number;
}

// Mock data for demonstration
const mockLayers: Layer[] = [
  {
    id: 'fish-stocks',
    name: 'Fish Stocks Density',
    type: 'heatmap',
    visible: true,
    opacity: 0.6,
    category: 'Marine Biology',
    description: 'Spatial distribution of commercial fish stock density in the Baltic Sea, derived from acoustic surveys and catch data from 2023.',
    author: 'Baltic Marine Research Institute',
    doi: '10.1234/fishstocks.2023.v1',
    data: [
      { lat: 59.3293, lng: 18.0686, intensity: 0.8 },
      { lat: 59.5, lng: 19.0, intensity: 0.6 },
      { lat: 58.5, lng: 17.5, intensity: 0.9 },
      { lat: 60.0, lng: 19.5, intensity: 0.7 },
    ],
    legend: {
      type: 'gradient',
      items: [
        { color: '#fee5d9', label: 'Low', value: 0 },
        { color: '#fcae91', label: 'Medium', value: 0.5 },
        { color: '#fb6a4a', label: 'High', value: 1 },
      ],
    },
  },
  {
    id: 'fishing-intensity',
    name: 'Fishing Intensity',
    type: 'geojson',
    visible: true,
    opacity: 0.5,
    color: '#3388ff',
    category: 'Fisheries',
    description: 'Commercial fishing activity intensity zones based on vessel monitoring system (VMS) data and reported fishing effort from 2022-2023.',
    author: 'Nordic Fisheries Management Council',
    doi: '10.1234/fishing.intensity.2023',
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'High Activity Zone', intensity: 'high' },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [18.5, 59.8],
              [19.5, 59.8],
              [19.5, 60.5],
              [18.5, 60.5],
              [18.5, 59.8],
            ]],
          },
        },
        {
          type: 'Feature',
          properties: { name: 'Medium Activity Zone', intensity: 'medium' },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [17.0, 58.5],
              [18.0, 58.5],
              [18.0, 59.2],
              [17.0, 59.2],
              [17.0, 58.5],
            ]],
          },
        },
      ],
    },
    legend: {
      type: 'categories',
      items: [
        { color: '#d73027', label: 'High Intensity' },
        { color: '#fee08b', label: 'Medium Intensity' },
        { color: '#1a9850', label: 'Low Intensity' },
      ],
    },
  },
];

const mockMaps: UserMap[] = [
  {
    id: 'baltic-fishing',
    name: 'Baltic Sea Fishing',
    description: 'Fishing activity and fish stocks in the Baltic Sea region',
    layers: mockLayers,
    center: [59.3293, 18.0686],
    zoom: 7,
  },
  {
    id: 'marine-protected',
    name: 'Marine Protected Areas',
    description: 'Protected zones and conservation areas',
    layers: [],
    center: [59.0, 18.5],
    zoom: 6,
  },
];

export default function App() {
  const [currentMap, setCurrentMap] = useState<UserMap>(mockMaps[0]);
  const [maps, setMaps] = useState<UserMap[]>(mockMaps);
  const [showLayerManager, setShowLayerManager] = useState(true);
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showLayerCreator, setShowLayerCreator] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [availableLayers, setAvailableLayers] = useState<Layer[]>(mockLayers);
  const [drawingMode, setDrawingMode] = useState<'Point' | 'LineString' | 'Polygon' | null>(null);
  const [drawCallback, setDrawCallback] = useState<((feature: any) => void) | null>(null);
  const [selectedLayerIdForComments, setSelectedLayerIdForComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Array<{
    id: string;
    author: string;
    content: string;
    timestamp: Date;
    targetType: 'map' | 'layer';
    targetId: string;
  }>>([
    {
      id: '1',
      author: 'Marine Biologist',
      content: 'The fishing intensity data in the northern region seems to correlate well with the recent stock assessments.',
      timestamp: new Date('2024-11-17T10:30:00'),
      targetType: 'map',
      targetId: 'baltic-fishing',
    },
    {
      id: '2',
      author: 'Fisheries Manager',
      content: 'Should we add a layer for protected breeding zones? This would help stakeholders understand the restrictions.',
      timestamp: new Date('2024-11-17T14:15:00'),
      targetType: 'map',
      targetId: 'baltic-fishing',
    },
    {
      id: '3',
      author: 'Data Scientist',
      content: 'The heatmap shows interesting patterns. Could we get higher resolution data for the coastal areas?',
      timestamp: new Date('2024-11-18T09:00:00'),
      targetType: 'layer',
      targetId: 'fish-stocks',
    },
    {
      id: '4',
      author: 'Policy Advisor',
      content: 'This layer is crucial for our upcoming stakeholder meeting. Thanks for including it!',
      timestamp: new Date('2024-11-19T11:20:00'),
      targetType: 'layer',
      targetId: 'fishing-intensity',
    },
  ]);
  const mapViewRef = useRef<MapViewRef>(null);

  // Get comment count for a specific layer
  const getLayerCommentCount = (layerId: string) => {
    return comments.filter(c => c.targetId === layerId).length;
  };

  // Open comments for a specific layer
  const handleOpenCommentsForLayer = (layerId: string) => {
    setSelectedLayerIdForComments(layerId);
    setShowComments(true);
    setShowLayerManager(false);
    setShowMapSelector(false);
    setShowLayerCreator(false);
  };

  // Add a new comment
  const handleAddComment = (comment: Omit<typeof comments[0], 'id' | 'timestamp'>) => {
    setComments(prev => [
      ...prev,
      {
        ...comment,
        id: Date.now().toString(),
        timestamp: new Date(),
      },
    ]);
  };

  const updateLayer = (layerId: string, updates: Partial<Layer>) => {
    setCurrentMap(prev => ({
      ...prev,
      layers: prev.layers.map(layer =>
        layer.id === layerId ? { ...layer, ...updates } : layer
      ),
    }));
  };

  const reorderLayers = (startIndex: number, endIndex: number) => {
    setCurrentMap(prev => {
      const newLayers = Array.from(prev.layers);
      const [removed] = newLayers.splice(startIndex, 1);
      newLayers.splice(endIndex, 0, removed);
      return { ...prev, layers: newLayers };
    });
  };

  const createNewMap = (name: string, description: string) => {
    const newMap: UserMap = {
      id: `map-${Date.now()}`,
      name,
      description,
      layers: [],
      center: [59.3293, 18.0686],
      zoom: 7,
    };
    setMaps(prev => [...prev, newMap]);
    setCurrentMap(newMap);
  };

  const addLayerToMap = (layer: Layer) => {
    // Check if layer already exists in the current map
    const layerExists = currentMap.layers.some(l => l.id === layer.id);
    if (layerExists) return;
    
    setCurrentMap(prev => ({
      ...prev,
      layers: [...prev.layers, { ...layer, visible: true }],
    }));
    
    // Add to available layers if it's a new custom layer
    const existsInAvailable = availableLayers.some(l => l.id === layer.id);
    if (!existsInAvailable) {
      setAvailableLayers(prev => [...prev, layer]);
    }
  };

  const removeLayerFromMap = (layerId: string) => {
    setCurrentMap(prev => ({
      ...prev,
      layers: prev.layers.filter(layer => layer.id !== layerId),
    }));
  };

  const handleStartDrawing = (type: 'Point' | 'LineString' | 'Polygon', callback: (feature: any) => void) => {
    setDrawingMode(type);
    setDrawCallback(() => callback);
    mapViewRef.current?.startDrawing(type);
  };

  const handleDrawComplete = (feature: any) => {
    if (drawCallback) {
      drawCallback(feature);
    }
    setDrawingMode(null);
    setDrawCallback(null);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Map className="w-5 h-5 text-slate-700" />
          <h1 className="text-slate-900">{currentMap.name}</h1>
          <p className="text-slate-500 text-sm">{currentMap.description}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={showMapSelector ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setShowMapSelector(!showMapSelector);
              if (!showMapSelector) {
                setShowLayerManager(false);
                setShowComments(false);
                setShowLayerCreator(false);
              }
            }}
          >
            <Map className="w-4 h-4" />
            Maps
          </Button>
          <Button
            variant={showLayerManager ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setShowLayerManager(!showLayerManager);
              if (!showLayerManager) {
                setShowMapSelector(false);
                setShowComments(false);
                setShowLayerCreator(false);
              }
            }}
          >
            <Layers className="w-4 h-4" />
            Layers
          </Button>
          <Button
            variant={showComments ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setShowComments(!showComments);
              if (!showComments) {
                setShowMapSelector(false);
                setShowLayerManager(false);
                setShowLayerCreator(false);
              }
            }}
          >
            <MessageSquare className="w-4 h-4" />
            Comments
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowLayerManager(false);
              setShowMapSelector(false);
              setShowComments(false);
              setShowLayerCreator(false);
              // Open the admin panel
              setShowAdminPanel(true);
            }}
          >
            <Shield className="w-4 h-4" />
            Admin
          </Button>

          <div className="h-6 w-px bg-slate-300 mx-2" />

          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="outline" size="sm">Sign In</Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm">Sign Up</Button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex relative">
        {/* Map */}
        <div className="flex-1">
          <MapView
            ref={mapViewRef}
            center={currentMap.center}
            zoom={currentMap.zoom}
            layers={currentMap.layers}
            onDrawComplete={handleDrawComplete}
            drawingMode={drawingMode}
          />
        </div>

        {/* Side Panels */}
        {showMapSelector && (
          <MapSelector
            maps={maps}
            currentMapId={currentMap.id}
            onSelectMap={(mapId) => {
              const map = maps.find(m => m.id === mapId);
              if (map) setCurrentMap(map);
            }}
            onCreateMap={createNewMap}
            onClose={() => setShowMapSelector(false)}
            onOpenLayerManager={() => {
              setShowMapSelector(false);
              setShowLayerManager(true);
            }}
          />
        )}

        {showLayerManager && (
          <LayerManager
            layers={currentMap.layers}
            availableLayers={availableLayers}
            onUpdateLayer={updateLayer}
            onReorderLayers={reorderLayers}
            onAddLayer={addLayerToMap}
            onRemoveLayer={removeLayerFromMap}
            onClose={() => setShowLayerManager(false)}
            onOpenLayerCreator={() => {
              setShowLayerManager(false);
              setShowLayerCreator(true);
            }}
            onOpenComments={handleOpenCommentsForLayer}
            getLayerCommentCount={getLayerCommentCount}
          />
        )}

        {showLayerCreator && (
          <LayerCreator
            onCreateLayer={(layer) => {
              addLayerToMap(layer);
              setShowLayerCreator(false);
            }}
            onClose={() => setShowLayerCreator(false)}
            onStartDrawing={handleStartDrawing}
            availableLayers={availableLayers}
          />
        )}

        {showComments && (
          <CommentSection
            mapId={currentMap.id}
            mapName={currentMap.name}
            layers={currentMap.layers}
            initialLayerId={selectedLayerIdForComments}
            comments={comments}
            onAddComment={handleAddComment}
            onClose={() => {
              setShowComments(false);
              setSelectedLayerIdForComments(null);
            }}
          />
        )}

        {showAdminPanel && (
          <AdminPanel
            availableLayers={availableLayers}
            onAddLayer={(layer) => {
              setAvailableLayers(prev => [...prev, layer]);
            }}
            onRemoveLayer={(layerId) => {
              setAvailableLayers(prev => prev.filter(l => l.id !== layerId));
              // Also remove from current map if it's there
              removeLayerFromMap(layerId);
            }}
            onClose={() => setShowAdminPanel(false)}
          />
        )}
      </div>
    </div>
  );
}