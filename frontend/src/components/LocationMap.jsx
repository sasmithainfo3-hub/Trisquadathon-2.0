import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Layers, Locate, Navigation2, Maximize2 } from 'lucide-react';

// Controller to smoothly update camera center
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
      map.flyTo(center, zoom || map.getZoom(), { duration: 1.2, easeLinearity: 0.25 });
    }
  }, [center, zoom, map]);
  return null;
}

// Controller to capture map clicks for location picking
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick({
          latitude: e.latlng.lat,
          longitude: e.latlng.lng
        });
      }
    }
  });
  return null;
}

// Recenter floating control
function RecenterButton({ targetCoords }) {
  const map = useMap();
  const handleRecenter = (e) => {
    e.stopPropagation();
    if (targetCoords && Number.isFinite(targetCoords[0]) && Number.isFinite(targetCoords[1])) {
      map.flyTo(targetCoords, 16, { duration: 1 });
    }
  };

  return (
    <button
      type="button"
      onClick={handleRecenter}
      title="Recenter to my location"
      className="absolute bottom-4 right-4 z-[1000] p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-blue-400 border border-slate-700 shadow-xl backdrop-blur-md transition-all flex items-center justify-center group active:scale-95"
    >
      <Locate className="w-5 h-5 group-hover:rotate-45 transition-transform" />
    </button>
  );
}

// Google Maps-Style Blue Location Marker
function createGoogleLocationIcon(heading = null) {
  return L.divIcon({
    className: 'google-location-dot',
    html: `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
        <!-- Pulsing radar wave -->
        <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: #3b82f6; opacity: 0.35; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <!-- Direction cone if heading available -->
        ${
          heading !== null && heading !== undefined
            ? `<div style="position: absolute; top: -6px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 12px solid #2563eb; transform: rotate(${heading}deg); transform-origin: bottom center;"></div>`
            : ''
        }
        <!-- Core Blue Pin -->
        <div style="position: relative; width: 18px; height: 18px; border-radius: 50%; background: #2563eb; border: 3px solid #ffffff; box-shadow: 0 0 10px rgba(37,99,235,0.8), 0 2px 6px rgba(0,0,0,0.5);"></div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
}

// Pin Icons for Start (A) & Destination (B)
function createTripPinIcon(color, label) {
  return L.divIcon({
    className: 'trip-waypoint-pin',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: grab;">
        <div style="width: 28px; height: 28px; border-radius: 50% 50% 50% 0; background: ${color}; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0,0,0,0.5); border: 2px solid #ffffff;">
          <span style="transform: rotate(45deg); font-weight: 800; font-size: 12px; color: white; line-height: 1;">${label}</span>
        </div>
        <div style="width: 6px; height: 6px; border-radius: 50%; background: rgba(0,0,0,0.4); margin-top: 2px;"></div>
      </div>
    `,
    iconSize: [28, 38],
    iconAnchor: [14, 38]
  });
}

const MAP_LAYERS = {
  roads: {
    name: 'Google Streets',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20
  },
  satellite: {
    name: 'Satellite Hybrid',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    maxZoom: 19
  }
};

export default function LocationMap({
  currentLocation,
  startLocation,
  destination,
  routeCoordinates = [],
  zoom = 15,
  height = '400px',
  interactive = true,
  onMapClick,
  onStartDrag,
  onDestinationDrag
}) {
  const [activeLayer, setActiveLayer] = useState('roads');
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Dynamic center computation
  const defaultCenter = useMemo(() => {
    if (currentLocation?.latitude && currentLocation?.longitude) {
      try {
        localStorage.setItem('safepath_last_coords', JSON.stringify({ latitude: currentLocation.latitude, longitude: currentLocation.longitude }));
      } catch (e) {}
      return [currentLocation.latitude, currentLocation.longitude];
    }
    if (startLocation?.latitude && startLocation?.longitude) {
      try {
        localStorage.setItem('safepath_last_coords', JSON.stringify({ latitude: startLocation.latitude, longitude: startLocation.longitude }));
      } catch (e) {}
      return [startLocation.latitude, startLocation.longitude];
    }
    if (destination?.latitude && destination?.longitude) {
      return [destination.latitude, destination.longitude];
    }
    try {
      const saved = localStorage.getItem('safepath_last_coords');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.latitude && parsed?.longitude) return [parsed.latitude, parsed.longitude];
      }
    } catch (e) {}
    return [9.8743, 77.3747]; // Localized regional fallback
  }, [currentLocation, startLocation, destination]);

  const currentIcon = useMemo(
    () => createGoogleLocationIcon(currentLocation?.heading),
    [currentLocation?.heading]
  );
  const startIcon = useMemo(() => createTripPinIcon('#10b981', 'A'), []);
  const destIcon = useMemo(() => createTripPinIcon('#ef4444', 'B'), []);

  const selectedLayer = MAP_LAYERS[activeLayer] || MAP_LAYERS.roads;

  return (
    <div style={{ height }} className="w-full relative rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl bg-slate-950">
      {/* Layer Switcher Top-Right Overlay */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col items-end">
        <button
          type="button"
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-xl backdrop-blur-md flex items-center gap-1.5 text-xs font-semibold px-3 transition-all"
        >
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>{selectedLayer.name}</span>
        </button>

        {showLayerMenu && (
          <div className="mt-1.5 p-1.5 rounded-xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-md flex flex-col gap-1 min-w-[150px] animate-in fade-in slide-in-from-top-1">
            {Object.entries(MAP_LAYERS).map(([key, layer]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setActiveLayer(key);
                  setShowLayerMenu(false);
                }}
                className={`text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeLayer === key
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {layer.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        touchZoom={interactive}
        doubleClickZoom={interactive}
        zoomControl={interactive}
        attributionControl={false}
        className="w-full h-full z-0"
      >
        <MapController center={defaultCenter} zoom={zoom} />
        {onMapClick && <MapClickHandler onMapClick={onMapClick} />}

        {/* Real-time Map Tiles */}
        <TileLayer
          key={activeLayer}
          url={selectedLayer.url}
          subdomains={selectedLayer.subdomains}
          maxZoom={selectedLayer.maxZoom}
        />

        {/* Start Waypoint Marker (Draggable if callback provided) */}
        {startLocation?.latitude && startLocation?.longitude && (
          <Marker
            position={[startLocation.latitude, startLocation.longitude]}
            icon={startIcon}
            draggable={Boolean(onStartDrag)}
            eventHandlers={{
              dragend: (e) => {
                const latlng = e.target.getLatLng();
                if (onStartDrag) onStartDrag({ latitude: latlng.lat, longitude: latlng.lng });
              }
            }}
          >
            <Popup>
              <div className="text-xs space-y-1">
                <span className="font-bold text-emerald-600 uppercase text-[10px] tracking-wider">Start Point (A)</span>
                <p className="font-medium text-slate-800">{startLocation.address || 'Starting Location'}</p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {startLocation.latitude.toFixed(5)}, {startLocation.longitude.toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination Waypoint Marker (Draggable if callback provided) */}
        {destination?.latitude && destination?.longitude && (
          <Marker
            position={[destination.latitude, destination.longitude]}
            icon={destIcon}
            draggable={Boolean(onDestinationDrag)}
            eventHandlers={{
              dragend: (e) => {
                const latlng = e.target.getLatLng();
                if (onDestinationDrag) onDestinationDrag({ latitude: latlng.lat, longitude: latlng.lng });
              }
            }}
          >
            <Popup>
              <div className="text-xs space-y-1">
                <span className="font-bold text-rose-600 uppercase text-[10px] tracking-wider">Destination (B)</span>
                <p className="font-medium text-slate-800">{destination.address || 'Destination'}</p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {destination.latitude.toFixed(5)}, {destination.longitude.toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Real-Time User GPS Location (Google Maps Pulsing Dot + Halo) */}
        {currentLocation?.latitude && currentLocation?.longitude && (
          <>
            <Marker position={[currentLocation.latitude, currentLocation.longitude]} icon={currentIcon}>
              <Popup>
                <div className="text-xs space-y-1 text-slate-800">
                  <span className="font-bold text-blue-600 flex items-center gap-1 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping inline-block"></span>
                    Live GPS Position
                  </span>
                  <p className="text-[11px]">
                    Accuracy: ±{Math.round(currentLocation.accuracy || 8)}m
                  </p>
                  {currentLocation.speed !== null && currentLocation.speed !== undefined && (
                    <p className="text-[10px] text-slate-500">
                      Speed: {(currentLocation.speed * 3.6).toFixed(1)} km/h
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400">
                    Updated: {new Date(currentLocation.timestamp || Date.now()).toLocaleTimeString()}
                  </p>
                </div>
              </Popup>
            </Marker>

            {/* Google Maps semi-transparent accuracy halo */}
            <Circle
              center={[currentLocation.latitude, currentLocation.longitude]}
              radius={Math.max(12, currentLocation.accuracy || 15)}
              pathOptions={{
                color: '#3b82f6',
                fillColor: '#60a5fa',
                fillOpacity: 0.18,
                weight: 1.5,
                dashArray: '3, 4'
              }}
            />
          </>
        )}

        {/* Real Road Route Polyline (Snapped to Street Network) */}
        {routeCoordinates && routeCoordinates.length > 0 && (
          <>
            {/* Dark casing border */}
            <Polyline
              positions={routeCoordinates}
              pathOptions={{
                color: '#1e3a8a',
                weight: 7,
                opacity: 0.7,
                lineCap: 'round',
                lineJoin: 'round'
              }}
            />
            {/* Vibrant Google Maps Blue route line */}
            <Polyline
              positions={routeCoordinates}
              pathOptions={{
                color: '#3b82f6',
                weight: 5,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round'
              }}
            />
          </>
        )}

        {/* Recenter FAB */}
        <RecenterButton
          targetCoords={
            currentLocation?.latitude && currentLocation?.longitude
              ? [currentLocation.latitude, currentLocation.longitude]
              : defaultCenter
          }
        />
      </MapContainer>
    </div>
  );
}
