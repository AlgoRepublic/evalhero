// src/v2/MapLeaflet.tsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ensure marker assets load from CDN (avoids bundler image issues)
if (typeof window !== 'undefined') {
  try {
    // remove previous if present
    const proto = L.Icon.Default.prototype as { _getIconUrl?: (() => string) | undefined };
    delete proto._getIconUrl;
  } catch (e) {
    // Ignore errors
  }
  
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

function LocationMarker({
  initial,
  onSelect,
}: {
  initial?: [number, number] | null;
  onSelect?: (p: { lat: number; lng: number }) => void;
}) {
  const [position, setPosition] = useState<[number, number] | null>(
    initial ?? null
  );

  useEffect(() => {
    if (initial) {
      setPosition(initial);
    }
  }, [initial]);

  useMapEvents({
    click(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      const newPosition: [number, number] = [lat, lng];
      setPosition(newPosition);
      onSelect && onSelect({ lat, lng });
    },
  });

  if (!position) return null;
  return <Marker position={position as L.LatLngExpression} />;
}

function MapController({ disabled }: { disabled: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (disabled) {
      map.dragging.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
      map.touchZoom.disable();
    } else {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoom.enable();
    }
  }, [map, disabled]);

  return null;
}

export default function MapLeaflet({
  initialLat,
  initialLng,
  onSelect,
  disabled = false,
}: {
  initialLat?: number | null;
  initialLng?: number | null;
  onSelect?: (p: { lat: number; lng: number }) => void;
  disabled?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Ensure DOM is ready and container has dimensions before rendering map
    if (containerRef.current) {
      const checkDimensions = () => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          setMounted(true);
        } else {
          setTimeout(checkDimensions, 50);
        }
      };
      checkDimensions();
    }
  }, []);

  if (typeof window === 'undefined') {
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12, color: '#666' }}>Map not available</div>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div 
        ref={containerRef}
        style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div style={{ fontSize: 12, color: '#666' }}>Loading map…</div>
      </div>
    );
  }

  const center: [number, number] =
    initialLat != null && initialLng != null
      ? [initialLat, initialLng]
      : [51.505, -0.09];

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={initialLat != null && initialLng != null ? 13 : 4}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        scrollWheelZoom={!disabled}
        key={`map-${initialLat}-${initialLng}`}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <MapController disabled={disabled} />
        <LocationMarker
          initial={initialLat != null && initialLng != null ? [initialLat, initialLng] : null}
          onSelect={onSelect}
        />
      </MapContainer>
    </div>
  );
}
