import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import Map, { Source, Layer as MapLayer, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layer } from '../App';
import { Legend } from './Legend';

interface MapViewProps {
  center: [number, number];
  zoom: number;
  layers: Layer[];
  onDrawComplete?: (feature: any) => void;
  drawingMode?: 'Point' | 'LineString' | 'Polygon' | null;
}

export interface MapViewRef {
  startDrawing: (type: 'Point' | 'LineString' | 'Polygon') => void;
  cancelDrawing: () => void;
}

export const MapView = forwardRef<MapViewRef, MapViewProps>(
  ({ center, zoom, layers, onDrawComplete, drawingMode }, ref) => {
  const mapRef = useRef<any>(null);
  const [viewState, setViewState] = useState({
    longitude: center[1],
    latitude: center[0],
    zoom: zoom,
  });
  const [popupInfo, setPopupInfo] = useState<any>(null);

  useImperativeHandle(ref, () => ({
    startDrawing: (type: 'Point' | 'LineString' | 'Polygon') => {
      // Drawing functionality can be implemented later with a drawing library
      console.log('Start drawing:', type);
    },
    cancelDrawing: () => {
      console.log('Cancel drawing');
    },
  }));

  // Update viewState when center or zoom props change
  useEffect(() => {
    setViewState({
      longitude: center[1],
      latitude: center[0],
      zoom: zoom,
    });
  }, [center, zoom]);

  const onClick = useCallback((event: any) => {
    const feature = event.features && event.features[0];
    if (feature) {
      setPopupInfo({
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
        feature: feature,
      });
    }
  }, []);

  const visibleLayers = layers.filter(layer => layer.visible);
  const activeLegend = visibleLayers.find(layer => layer.legend);

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onClick={onClick}
        mapStyle="https://demotiles.maplibre.org/style.json"
        interactiveLayerIds={visibleLayers.map(l => `${l.id}-fill`)}
      >
        {visibleLayers.map((layer) => {
          if (layer.type === 'geojson' && layer.data) {
            // Determine fill color based on intensity or use layer color
            const firstFeature = layer.data.features?.[0];
            const intensity = firstFeature?.properties?.intensity;
            let fillColor = layer.color || '#3388ff';

            if (intensity === 'high') fillColor = '#d73027';
            else if (intensity === 'medium') fillColor = '#fee08b';
            else if (intensity === 'low') fillColor = '#1a9850';

            return (
              <Source
                key={layer.id}
                id={layer.id}
                type="geojson"
                data={layer.data}
              >
                {/* Polygon fill */}
                <MapLayer
                  id={`${layer.id}-fill`}
                  type="fill"
                  filter={['==', ['geometry-type'], 'Polygon']}
                  paint={{
                    'fill-color': fillColor,
                    'fill-opacity': layer.opacity * 0.5,
                  }}
                />
                {/* Polygon and LineString outlines */}
                <MapLayer
                  id={`${layer.id}-line`}
                  type="line"
                  filter={['in', ['geometry-type'], ['literal', ['Polygon', 'LineString']]]}
                  paint={{
                    'line-color': fillColor,
                    'line-width': 2,
                    'line-opacity': layer.opacity,
                  }}
                />
                {/* Points */}
                <MapLayer
                  id={`${layer.id}-circle`}
                  type="circle"
                  filter={['==', ['geometry-type'], 'Point']}
                  paint={{
                    'circle-radius': 8,
                    'circle-color': fillColor,
                    'circle-opacity': layer.opacity,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff',
                  }}
                />
              </Source>
            );
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

            return (
              <Source
                key={layer.id}
                id={layer.id}
                type="geojson"
                data={{
                  type: 'FeatureCollection',
                  features,
                }}
              >
                <MapLayer
                  id={`${layer.id}-circle`}
                  type="circle"
                  paint={{
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
                  }}
                />
              </Source>
            );
          }
          return null;
        })}

        {popupInfo && (
          <Popup
            longitude={popupInfo.longitude}
            latitude={popupInfo.latitude}
            anchor="bottom"
            onClose={() => setPopupInfo(null)}
          >
            <div>
              <strong>{popupInfo.feature.properties.name || 'Unnamed'}</strong>
              {popupInfo.feature.properties.description && (
                <p className="text-sm">{popupInfo.feature.properties.description}</p>
              )}
            </div>
          </Popup>
        )}
      </Map>

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
