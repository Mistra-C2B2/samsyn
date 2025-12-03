import { useState, useRef, useMemo, useEffect } from 'react';
import { MapView, MapViewRef } from './components/MapView';
import { LayerManager } from './components/LayerManager';
import { MapSelector } from './components/MapSelector';
import { CommentSection } from './components/CommentSection';
import { LayerCreator } from './components/LayerCreator';
import { AdminPanel } from './components/AdminPanel';
import { TimeSlider } from './components/TimeSlider';
import { SettingsDialog } from './components/SettingsDialog';
import { Button } from './components/ui/button';
import { Layers, Map, MessageSquare, Shield, Share2, Settings } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Toaster } from './components/ui/sonner';
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { CommentResponse } from './types/api';
import { useCommentService } from './services/commentService';

// Get Clerk publishable key from environment variables
// Make sure to set VITE_CLERK_PUBLISHABLE_KEY in your .env file
const clerkPubKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLERK_PUBLISHABLE_KEY) || '';

// Check if Clerk is properly configured
const isClerkConfigured = clerkPubKey && clerkPubKey.startsWith('pk_');

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
  // Permission settings
  createdBy?: string; // User ID of the creator
  editable?: 'creator-only' | 'everyone'; // Who can edit this layer
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
  // Temporal properties
  temporal?: boolean;
  timeRange?: {
    start: Date;
    end: Date;
  };
  temporalData?: Array<{
    timestamp: Date;
    data: any;
  }>;
}

export interface UserMap {
  id: string;
  name: string;
  description: string;
  layers: Layer[];
  center: [number, number];
  zoom: number;
  createdBy?: string; // User ID or email of creator
  permissions?: {
    editAccess: 'private' | 'collaborators' | 'public';
    collaborators: string[]; // Array of email addresses
    visibility: 'private' | 'public'; // Who can view the map
  };
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
    temporal: true,
    timeRange: {
      start: new Date('2023-01-01'),
      end: new Date('2023-12-31'),
    },
    temporalData: [
      {
        timestamp: new Date('2023-01-01'),
        data: [
          { lat: 59.3293, lng: 18.0686, intensity: 0.5 },
          { lat: 59.5, lng: 19.0, intensity: 0.4 },
          { lat: 58.5, lng: 17.5, intensity: 0.6 },
        ],
      },
      {
        timestamp: new Date('2023-04-01'),
        data: [
          { lat: 59.3293, lng: 18.0686, intensity: 0.7 },
          { lat: 59.5, lng: 19.0, intensity: 0.6 },
          { lat: 58.5, lng: 17.5, intensity: 0.8 },
        ],
      },
      {
        timestamp: new Date('2023-07-01'),
        data: [
          { lat: 59.3293, lng: 18.0686, intensity: 0.9 },
          { lat: 59.5, lng: 19.0, intensity: 0.7 },
          { lat: 58.5, lng: 17.5, intensity: 0.9 },
          { lat: 60.0, lng: 19.5, intensity: 0.8 },
        ],
      },
      {
        timestamp: new Date('2023-10-01'),
        data: [
          { lat: 59.3293, lng: 18.0686, intensity: 0.6 },
          { lat: 59.5, lng: 19.0, intensity: 0.5 },
          { lat: 58.5, lng: 17.5, intensity: 0.7 },
        ],
      },
      {
        timestamp: new Date('2023-12-31'),
        data: [
          { lat: 59.3293, lng: 18.0686, intensity: 0.4 },
          { lat: 59.5, lng: 19.0, intensity: 0.3 },
          { lat: 58.5, lng: 17.5, intensity: 0.5 },
        ],
      },
    ],
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
  {
    id: 'aquaculture-sites',
    name: 'Aquaculture Sites',
    type: 'geojson',
    visible: true,
    opacity: 0.7,
    color: '#3b82f6',
    category: 'Aquaculture',
    description: 'User-created layer showing proposed aquaculture sites with different features.',
    createdBy: 'user-123',
    editable: 'everyone',
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            name: 'Main Fish Farm',
            description: 'Primary salmon farming location with optimal water conditions',
            featureType: 'Polygon',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [18.2, 59.5],
              [18.4, 59.5],
              [18.4, 59.6],
              [18.2, 59.6],
              [18.2, 59.5],
            ]],
          },
        },
        {
          type: 'Feature',
          properties: {
            name: 'Monitoring Station Alpha',
            description: 'Water quality monitoring point',
            featureType: 'Point',
            icon: 'anchor',
          },
          geometry: {
            type: 'Point',
            coordinates: [18.3, 59.55],
          },
        },
        {
          type: 'Feature',
          properties: {
            name: 'Supply Route',
            description: 'Main supply and transport route from shore to farm',
            featureType: 'LineString',
            lineStyle: 'dashed',
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [18.1, 59.45],
              [18.2, 59.5],
              [18.3, 59.55],
            ],
          },
        },
        {
          type: 'Feature',
          properties: {
            name: 'Secondary Farm',
            description: 'Expansion area for mussel cultivation',
            featureType: 'Polygon',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [18.6, 59.4],
              [18.8, 59.4],
              [18.8, 59.5],
              [18.6, 59.5],
              [18.6, 59.4],
            ]],
          },
        },
        {
          type: 'Feature',
          properties: {
            name: 'Warning Buoy',
            description: 'Safety marker for navigation',
            featureType: 'Point',
            icon: 'warning',
          },
          geometry: {
            type: 'Point',
            coordinates: [18.5, 59.45],
          },
        },
      ],
    },
    legend: {
      type: 'categories',
      items: [
        { color: '#3b82f6', label: 'Aquaculture Sites' },
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

function AppContent() {
  const [currentMap, setCurrentMap] = useState<UserMap>(mockMaps[0]);
  const [maps, setMaps] = useState<UserMap[]>(mockMaps);
  const [showLayerManager, setShowLayerManager] = useState(true);
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showLayerCreator, setShowLayerCreator] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [availableLayers, setAvailableLayers] = useState<Layer[]>(mockLayers);
  const [basemap, setBasemap] = useState<string>('osm');
  const [drawingMode, setDrawingMode] = useState<'Point' | 'LineString' | 'Polygon' | null>(null);
  const [drawCallback, setDrawCallback] = useState<((feature: any) => void) | null>(null);
  const [selectedLayerIdForComments, setSelectedLayerIdForComments] = useState<string | null>(null);
  const [editingLayer, setEditingLayer] = useState<Layer | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [comments, setComments] = useState<CommentResponse[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const mapViewRef = useRef<MapViewRef>(null);

  // Initialize comment service
  const commentService = useCommentService();

  // Load comments when map changes
  useEffect(() => {
    if (currentMap?.id) {
      loadComments(currentMap.id);
    }
  }, [currentMap?.id]);

  // Function to load comments from API
  const loadComments = async (mapId: string) => {
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const data = await commentService.listComments({ map_id: mapId });
      setComments(data);
    } catch (error: any) {
      setCommentsError(error.message);
      toast.error('Failed to load comments');
    } finally {
      setCommentsLoading(false);
    }
  };

  // Temporal state management
  const [currentTimeRange, setCurrentTimeRange] = useState<[Date, Date]>([
    new Date('2023-04-01'),
    new Date('2023-10-01')
  ]);

  // Check if any temporal layers are visible
  const hasTemporalLayers = useMemo(() => {
    return currentMap.layers.some(layer => layer.temporal && layer.visible && layer.timeRange);
  }, [currentMap.layers]);

  // Calculate overall time range from all temporal layers
  const globalTimeRange = useMemo(() => {
    const temporalLayers = currentMap.layers.filter(layer => layer.temporal && layer.visible && layer.timeRange);
    if (temporalLayers.length === 0) return null;

    let minStart = temporalLayers[0].timeRange!.start;
    let maxEnd = temporalLayers[0].timeRange!.end;

    temporalLayers.forEach(layer => {
      if (layer.timeRange!.start < minStart) minStart = layer.timeRange!.start;
      if (layer.timeRange!.end > maxEnd) maxEnd = layer.timeRange!.end;
    });

    return { start: minStart, end: maxEnd };
  }, [currentMap.layers]);

  // Update layers with temporal data based on current time
  const layersWithTemporalData = useMemo(() => {
    return currentMap.layers.map(layer => {
      if (!layer.temporal || !layer.temporalData) return layer;

      // Find the closest temporal data point to current time
      const sortedData = [...layer.temporalData].sort(
        (a, b) => Math.abs(a.timestamp.getTime() - currentTimeRange[0].getTime()) - 
                  Math.abs(b.timestamp.getTime() - currentTimeRange[0].getTime())
      );

      const closestData = sortedData[0];
      return { ...layer, data: closestData.data };
    });
  }, [currentMap.layers, currentTimeRange]);

  // Get comment count for a specific layer
  const getLayerCommentCount = (layerId: string) => {
    return comments.filter(c => c.layer_id === layerId).length;
  };

  // Open comments for a specific layer
  const handleOpenCommentsForLayer = (layerId: string) => {
    setSelectedLayerIdForComments(layerId);
    setShowComments(true);
    setShowLayerManager(false);
    setShowMapSelector(false);
    setShowLayerCreator(false);
  };

  // Transform API comments to component format
  const transformedComments = useMemo(() => {
    return comments.map(comment => ({
      id: comment.id,
      author: comment.author_name || 'Unknown User',
      content: comment.content,
      timestamp: new Date(comment.created_at),
      targetType: (comment.map_id && !comment.layer_id ? 'map' : 'layer') as 'map' | 'layer',
      targetId: comment.layer_id || comment.map_id || '',
      parentId: comment.parent_id || undefined,
    }));
  }, [comments]);

  // Add a new comment - adapter between component and API
  const handleAddComment = async (commentData: {
    author: string;
    content: string;
    targetType: 'map' | 'layer';
    targetId: string;
    parentId?: string;
  }) => {
    try {
      const apiCommentData = {
        content: commentData.content,
        map_id: commentData.targetType === 'map' ? commentData.targetId : currentMap.id,
        layer_id: commentData.targetType === 'layer' ? commentData.targetId : undefined,
        parent_id: commentData.parentId,
      };
      const newComment = await commentService.createComment(apiCommentData);
      setComments([...comments, newComment]);
      toast.success('Comment added');
    } catch (error: any) {
      toast.error('Failed to add comment: ' + error.message);
    }
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

  const createNewMap = (name: string, description: string, permissions: { editAccess: 'private' | 'collaborators' | 'public'; collaborators: string[]; visibility: 'private' | 'public' }) => {
    const newMap: UserMap = {
      id: `map-${Date.now()}`,
      name,
      description,
      layers: [],
      center: [59.3293, 18.0686],
      zoom: 7,
      permissions,
    };
    setMaps(prev => [...prev, newMap]);
    setCurrentMap(newMap);
  };

  const editMap = (mapId: string, name: string, description: string, permissions: { editAccess: 'private' | 'collaborators' | 'public'; collaborators: string[]; visibility: 'private' | 'public' }) => {
    setMaps(prev => prev.map(map => 
      map.id === mapId 
        ? { ...map, name, description, permissions }
        : map
    ));
    // Update current map if it's the one being edited
    setCurrentMap(prev => 
      prev.id === mapId 
        ? { ...prev, name, description, permissions }
        : prev
    );
  };

  const deleteMap = (mapId: string) => {
    // Remove the map from the list
    setMaps(prev => prev.filter(map => map.id !== mapId));
    
    // If the deleted map was the current map, switch to the default map or first available map
    if (currentMap.id === mapId) {
      const remainingMaps = maps.filter(map => map.id !== mapId);
      if (remainingMaps.length > 0) {
        setCurrentMap(remainingMaps[0]);
      } else {
        // Create a new default map if no maps remain
        const defaultMap: UserMap = {
          id: 'default',
          name: 'My Map',
          description: 'A new map for marine spatial planning',
          layers: [],
          center: [59.3293, 18.0686],
          zoom: 7,
          permissions: {
            editAccess: 'private',
            collaborators: [],
            visibility: 'private',
          },
        };
        setMaps([defaultMap]);
        setCurrentMap(defaultMap);
      }
    }
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

  const handleEditLayer = (layer: Layer) => {
    setEditingLayer(layer);
    setShowLayerManager(false);
    setShowLayerCreator(true);
  };

  const handleShareMap = async () => {
    try {
      // Create a shareable URL with the map ID
      const shareUrl = `${window.location.origin}${window.location.pathname}?map=${currentMap.id}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      
      toast.success('Map link copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-teal-500 tracking-tight" style={{ fontWeight: 700 }}>SAMSYN</h1>
          <div className="h-4 w-px bg-slate-300" />
          <p className="text-slate-500 text-sm">{currentMap.name}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={showMapSelector ? 'default' : 'outline'}
            size="sm"
            className={!showMapSelector ? 'hover:border-teal-400 hover:bg-white hover:text-slate-900' : ''}
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
            className={!showLayerManager ? 'hover:border-teal-400 hover:bg-white hover:text-slate-900' : ''}
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
            className={!showComments ? 'hover:border-teal-400 hover:bg-white hover:text-slate-900' : ''}
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
            variant={showAdminPanel ? 'default' : 'outline'}
            size="sm"
            className={!showAdminPanel ? 'hover:border-teal-400 hover:bg-white hover:text-slate-900' : ''}
            onClick={() => {
              setShowLayerManager(false);
              setShowMapSelector(false);
              setShowComments(false);
              setShowLayerCreator(false);
              // Open the admin panel
              setShowAdminPanel(!showAdminPanel);
            }}
          >
            <Shield className="w-4 h-4" />
            Admin
          </Button>
          <div className="h-4 w-px bg-slate-300" />
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-slate-100"
            onClick={handleShareMap}
          >
            <Share2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-slate-100"
            onClick={() => setShowSettings(true)}
          >
            <Settings className="w-4 h-4" />
          </Button>
          <div className="h-4 w-px bg-slate-300" />
          {isClerkConfigured ? (
            <>
              <SignedOut>
                <SignInButton mode="modal">
                  <Button variant="outline" size="sm" className="hover:border-teal-400 hover:bg-white hover:text-slate-900">
                    Sign In
                  </Button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <UserButton 
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8"
                    }
                  }}
                />
              </SignedIn>
            </>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              className="hover:border-teal-400 hover:bg-white hover:text-slate-900"
              onClick={() => {
                toast.info('Clerk authentication is not configured yet. Add VITE_CLERK_PUBLISHABLE_KEY to your .env file.');
              }}
            >
              Sign In
            </Button>
          )}
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
            layers={layersWithTemporalData}
            onDrawComplete={handleDrawComplete}
            drawingMode={drawingMode}
            basemap={basemap}
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
            onEditMap={editMap}
            onDeleteMap={deleteMap}
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
            mapName={currentMap.name}
            basemap={basemap}
            onUpdateLayer={updateLayer}
            onReorderLayers={reorderLayers}
            onAddLayer={addLayerToMap}
            onRemoveLayer={removeLayerFromMap}
            onClose={() => setShowLayerManager(false)}
            onOpenLayerCreator={() => {
              setShowLayerManager(false);
              setShowLayerCreator(true);
            }}
            onChangeBasemap={setBasemap}
            onOpenComments={handleOpenCommentsForLayer}
            getLayerCommentCount={getLayerCommentCount}
            onEditLayer={handleEditLayer}
          />
        )}

        {showLayerCreator && (
          <LayerCreator
            onCreateLayer={(layer) => {
              if (editingLayer) {
                // Update existing layer
                updateLayer(layer.id, layer);
                // Also update in availableLayers
                setAvailableLayers(prev => prev.map(l => 
                  l.id === layer.id ? layer : l
                ));
              } else {
                // Add new layer
                addLayerToMap(layer);
              }
              setShowLayerCreator(false);
              setEditingLayer(null);
            }}
            onClose={() => {
              setShowLayerCreator(false);
              setEditingLayer(null);
            }}
            onStartDrawing={handleStartDrawing}
            availableLayers={availableLayers}
            editingLayer={editingLayer}
          />
        )}

        {showComments && (
          <CommentSection
            mapId={currentMap.id}
            mapName={currentMap.name}
            layers={currentMap.layers}
            initialLayerId={selectedLayerIdForComments}
            comments={transformedComments}
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
            onUpdateLayer={(layerId, updates) => {
              setAvailableLayers(prev => prev.map(l => 
                l.id === layerId ? { ...l, ...updates } : l
              ));
              // Also update in current map if it's there
              const layerInMap = currentMap.layers.find(l => l.id === layerId);
              if (layerInMap) {
                updateLayer(layerId, updates);
              }
            }}
            onClose={() => setShowAdminPanel(false)}
          />
        )}

        {/* Time Slider for temporal layers */}
        {hasTemporalLayers && globalTimeRange && (
          <TimeSlider
            startDate={globalTimeRange.start}
            endDate={globalTimeRange.end}
            currentRange={currentTimeRange}
            onRangeChange={setCurrentTimeRange}
          />
        )}
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        isClerkConfigured={isClerkConfigured}
      />

      <Toaster />
    </div>
  );
}

export default function App() {
  // Only wrap with ClerkProvider if Clerk is properly configured
  if (isClerkConfigured) {
    return (
      <ClerkProvider publishableKey={clerkPubKey}>
        <AppContent />
      </ClerkProvider>
    );
  }
  
  // If Clerk is not configured, render app without authentication
  return <AppContent />;
}