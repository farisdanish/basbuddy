import { useMemo } from 'react';
import { Marker, Circle } from 'react-leaflet';
import L from 'leaflet';
import type { GeoPosition } from '../../hooks/useGeolocation.ts';

interface UserLocationMarkerProps {
  position: GeoPosition | null;
}

export function UserLocationMarker({ position }: UserLocationMarkerProps) {
  const icon = useMemo(() => {
    return L.divIcon({
      className: 'user-location-marker',
      html: `
        <div class="relative flex items-center justify-center w-6 h-6">
          <div class="absolute w-6 h-6 bg-blue-500 rounded-full opacity-40 animate-ping"></div>
          <div class="relative w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full shadow-md"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }, []);

  if (!position) return null;

  return (
    <>
      <Circle
        center={[position.lat, position.lon]}
        radius={Math.min(Math.max(position.accuracy, 20), 200)}
        pathOptions={{
          color: '#3B82F6',
          fillColor: '#3B82F6',
          fillOpacity: 0.12,
          weight: 1,
        }}
      />
      <Marker position={[position.lat, position.lon]} icon={icon} />
    </>
  );
}
