import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Layer } from '../App';
import { Legend } from './Legend';

interface MapViewProps {
  center: [number, number];
  zoom: number;
  layers: Layer[];
  basemap: string;
  onDrawComplete?: (feature: any) => void;
  drawingMode?: 'Point' | 'LineString' | 'Polygon' | null;
}

export interface MapViewRef {
  startDrawing: (type: 'Point' | 'LineString' | 'Polygon') => void;
  cancelDrawing: () => void;
}

export const MapView = forwardRef<MapViewRef, MapViewProps>(
  ({ center, zoom, layers, basemap, onDrawComplete, drawingMode }, ref) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const drawRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useImperativeHandle(ref, () => ({
    startDrawing: (type: 'Point' | 'LineString' | 'Polygon') => {
      if (!drawRef.current) return;
      
      // Clear any existing drawings
      drawRef.current.deleteAll();
      
      // Start drawing based on type
      if (type === 'Point') {
        drawRef.current.changeMode('draw_point');
      } else if (type === 'LineString') {
        drawRef.current.changeMode('draw_line_string');
      } else if (type === 'Polygon') {
        drawRef.current.changeMode('draw_polygon');
      }
    },
    cancelDrawing: () => {
      if (drawRef.current) {
        drawRef.current.changeMode('simple_select');
        drawRef.current.deleteAll();
      }
    },
  }));

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // @ts-ignore
    if (typeof window !== 'undefined' && window.mapboxgl) {
      // @ts-ignore
      const mapboxgl = window.mapboxgl;
      // @ts-ignore
      const MapboxDraw = window.MapboxDraw;
      
      mapboxgl.accessToken = 'pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbGV4YW1wbGUifQ.example'; // Placeholder

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: `mapbox://styles/mapbox/${basemap}`,
        center: [center[1], center[0]], // mapbox uses [lng, lat]
        zoom: zoom - 1,
      });

      // Initialize draw control
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {},
        styles: [
          // Polygon fill
          {
            'id': 'gl-draw-polygon-fill',
            'type': 'fill',
            'paint': {
              'fill-color': '#3b82f6',
              'fill-opacity': 0.3
            }
          },
          // Polygon outline
          {
            'id': 'gl-draw-polygon-stroke-active',
            'type': 'line',
            'paint': {
              'line-color': '#3b82f6',
              'line-width': 2
            }
          },
          // Line
          {
            'id': 'gl-draw-line',
            'type': 'line',
            'paint': {
              'line-color': '#3b82f6',
              'line-width': 2
            }
          },
          // Point
          {
            'id': 'gl-draw-point',
            'type': 'circle',
            'paint': {
              'circle-radius': 6,
              'circle-color': '#3b82f6'
            }
          },
          // Vertex points
          {
            'id': 'gl-draw-polygon-and-line-vertex-active',
            'type': 'circle',
            'paint': {
              'circle-radius': 5,
              'circle-color': '#ffffff',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#3b82f6'
            }
          }
        ]
      });

      map.addControl(draw);
      drawRef.current = draw;

      // Handle draw create event
      map.on('draw.create', (e: any) => {
        if (onDrawComplete && e.features && e.features[0]) {
          onDrawComplete(e.features[0]);
          // Clear the drawing after completion
          draw.deleteAll();
        }
      });

      map.on('load', () => {
        setMapLoaded(true);
      });

      mapRef.current = map;

      return () => {
        map.remove();
        mapRef.current = null;
        drawRef.current = null;
      };
    }
  }, []);

  // Handle basemap changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    const map = mapRef.current;
    map.setStyle(`mapbox://styles/mapbox/${basemap}`);
    
    // Wait for style to load before re-adding layers
    map.once('style.load', () => {
      setMapLoaded(true);
    });
  }, [basemap]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const map = mapRef.current;
    
    // Remove all existing layers and sources
    layers.forEach(layer => {
      if (map.getLayer(`${layer.id}-fill`)) {
        map.removeLayer(`${layer.id}-fill`);
      }
      if (map.getLayer(`${layer.id}-line`)) {
        map.removeLayer(`${layer.id}-line`);
      }
      if (map.getLayer(`${layer.id}-circle`)) {
        map.removeLayer(`${layer.id}-circle`);
      }
      if (map.getLayer(`${layer.id}-symbol`)) {
        map.removeLayer(`${layer.id}-symbol`);
      }
      if (map.getSource(layer.id)) {
        map.removeSource(layer.id);
      }
    });

    // Add visible layers
    layers.forEach(layer => {
      if (!layer.visible) return;

      if (layer.type === 'geojson' && layer.data) {
        map.addSource(layer.id, {
          type: 'geojson',
          data: layer.data,
        });

        // Determine fill color based on intensity or use layer color
        const firstFeature = layer.data.features?.[0];
        const intensity = firstFeature?.properties?.intensity;
        let fillColor = layer.color || '#3388ff';
        
        if (intensity === 'high') fillColor = '#d73027';
        else if (intensity === 'medium') fillColor = '#fee08b';
        else if (intensity === 'low') fillColor = '#1a9850';

        // Add polygon fills
        map.addLayer({
          id: `${layer.id}-fill`,
          type: 'fill',
          source: layer.id,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: {
            'fill-color': fillColor,
            'fill-opacity': layer.opacity * 0.5,
          },
        });

        // Add lines with different styles
        const features = layer.data.features || [];
        const hasLineStyles = features.some((f: any) => f.properties?.lineStyle);

        if (hasLineStyles) {
          // Create separate layers for each line style
          ['solid', 'dashed', 'dotted'].forEach(style => {
            map.addLayer({
              id: `${layer.id}-line-${style}`,
              type: 'line',
              source: layer.id,
              filter: [
                'all',
                ['in', ['geometry-type'], ['literal', ['Polygon', 'LineString']]],
                ['==', ['get', 'lineStyle'], style]
              ],
              paint: {
                'line-color': fillColor,
                'line-width': 2,
                'line-opacity': layer.opacity,
                'line-dasharray': style === 'dashed' ? [2, 2] : style === 'dotted' ? [0.5, 1.5] : undefined,
              },
            });
          });
          
          // Default line for features without lineStyle
          map.addLayer({
            id: `${layer.id}-line`,
            type: 'line',
            source: layer.id,
            filter: [
              'all',
              ['in', ['geometry-type'], ['literal', ['Polygon', 'LineString']]],
              ['!', ['has', 'lineStyle']]
            ],
            paint: {
              'line-color': fillColor,
              'line-width': 2,
              'line-opacity': layer.opacity,
            },
          });
        } else {
          // Standard line layer
          map.addLayer({
            id: `${layer.id}-line`,
            type: 'line',
            source: layer.id,
            filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'LineString']]],
            paint: {
              'line-color': fillColor,
              'line-width': 2,
              'line-opacity': layer.opacity,
            },
          });
        }

        // Add point markers with icon support
        map.addLayer({
          id: `${layer.id}-circle`,
          type: 'circle',
          source: layer.id,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': 8,
            'circle-color': fillColor,
            'circle-opacity': layer.opacity,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        // Add popups on click
        map.on('click', `${layer.id}-fill`, (e: any) => {
          if (e.features && e.features[0]) {
            const feature = e.features[0];
            const name = feature.properties.name || 'Unnamed';
            const description = feature.properties.description || '';
            new (window as any).mapboxgl.Popup()
              .setLngLat(e.lngLat)
              .setHTML(`<strong>${name}</strong>${description ? `<br/>${description}` : ''}`)
              .addTo(map);
          }
        });

        map.on('click', `${layer.id}-circle`, (e: any) => {
          if (e.features && e.features[0]) {
            const feature = e.features[0];
            const name = feature.properties.name || 'Unnamed';
            const description = feature.properties.description || '';
            new (window as any).mapboxgl.Popup()
              .setLngLat(e.lngLat)
              .setHTML(`<strong>${name}</strong>${description ? `<br/>${description}` : ''}`)
              .addTo(map);
          }
        });

        // Change cursor on hover
        map.on('mouseenter', `${layer.id}-fill`, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', `${layer.id}-fill`, () => {
          map.getCanvas().style.cursor = '';
        });
        map.on('mouseenter', `${layer.id}-circle`, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', `${layer.id}-circle`, () => {
          map.getCanvas().style.cursor = '';
        });
      } else if (layer.type === 'heatmap' && layer.data) {
        const features = layer.data.map((point: any) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [point.lng, point.lat],
          },
          properties: {
            intensity: point.intensity,
          },
        }));

        map.addSource(layer.id, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features,
          },
        });

        map.addLayer({
          id: `${layer.id}-circle`,
          type: 'circle',
          source: layer.id,
          paint: {
            'circle-radius': 30,
            'circle-color': [
              'interpolate',
              ['linear'],
              ['get', 'intensity'],
              0, '#fee5d9',
              0.5, '#fcae91',
              1, '#fb6a4a'
            ],
            'circle-opacity': layer.opacity * 0.6,
          },
        });
      }
    });
  }, [layers, mapLoaded]);

  const visibleLayers = layers.filter(layer => layer.visible);
  const activeLegend = visibleLayers.find(layer => layer.legend);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
          <p className="text-slate-600">Loading map...</p>
        </div>
      )}
      {drawingMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <p className="text-sm">
            {drawingMode === 'Point' && 'Click on the map to place a point'}
            {drawingMode === 'LineString' && 'Click to add points. Double-click to finish the line'}
            {drawingMode === 'Polygon' && 'Click to add vertices. Double-click to close the polygon'}
          </p>
        </div>
      )}
      {activeLegend && <Legend layer={activeLegend} />}
    </div>
  );
});

MapView.displayName = 'MapView';