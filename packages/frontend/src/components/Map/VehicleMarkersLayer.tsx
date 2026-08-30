import { useMemo } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { LiveVehicle } from '@basbuddy/shared';
import { useVehiclePositions } from '../../hooks/useVehiclePositions.ts';

interface VehicleMarkersLayerProps {
  routeId: string | null;
  vehicles?: LiveVehicle[];
  routeShortName?: string;
}

function createVehicleIcon(
  routeShortName: string,
  bearing: number | null,
  isLive: boolean,
) {
  const size = 38;
  const anchor = size / 2;

  const bearingTransform = bearing !== null ? `transform: rotate(${bearing}deg);` : 'display: none;';
  const livePulse = isLive
    ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-[#E94B8C] rounded-full border-2 border-white animate-pulse"></div>'
    : '';

  return L.divIcon({
    className: 'vehicle-marker-icon',
    html: `
      <div class="relative flex items-center justify-center cursor-pointer select-none" style="width: ${size}px; height: ${size}px;">
        <!-- Directional heading arrow (rotates according to bearing) -->
        <div class="absolute inset-0 flex items-center justify-center transition-transform duration-300 pointer-events-none" style="${bearingTransform}">
          <div class="w-0 h-0 border-x-4 border-x-transparent border-b-[8px] border-b-[#101B2D] -translate-y-5"></div>
        </div>

        <!-- Central Mango Route Badge -->
        <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#F4A100] border-2 border-[#101B2D] shadow-lg shadow-black/40">
          <span class="font-display font-bold text-xs text-[#101B2D] tracking-tight">
            ${routeShortName || 'BUS'}
          </span>
        </div>

        <!-- Live Signal Pink Pulse Indicator -->
        ${livePulse}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
  });
}

export function VehicleMarkersLayer({
  routeId,
  vehicles: propVehicles,
  routeShortName = '',
}: VehicleMarkersLayerProps) {
  const { data } = useVehiclePositions(propVehicles ? null : routeId);
  const vehicles = propVehicles ?? data?.vehicles ?? [];

  const markers = useMemo(() => {
    return vehicles.map((v) => {
      const isLive = v.freshness === 'live';
      const icon = createVehicleIcon(routeShortName || v.routeId, v.bearing, isLive);
      return {
        vehicle: v,
        icon,
      };
    });
  }, [vehicles, routeShortName]);

  return (
    <>
      {markers.map(({ vehicle, icon }) => (
        <Marker
          key={`${vehicle.tripId}-${vehicle.lat}-${vehicle.lon}`}
          position={[vehicle.lat, vehicle.lon]}
          icon={icon}
        >
          <Tooltip direction="top" offset={[0, -16]} opacity={0.95}>
            <div className="text-center font-sans text-xs">
              <span className="font-bold text-[#101B2D]">Route {routeShortName || vehicle.routeId}</span>
              {vehicle.bearing !== null && (
                <span className="block text-[10px] text-gray-600">Heading: {Math.round(vehicle.bearing)}°</span>
              )}
              {vehicle.speedKmh !== null && vehicle.speedKmh !== undefined && (
                <span className="block text-[10px] text-gray-600">Speed: {Math.round(vehicle.speedKmh)} km/h</span>
              )}
            </div>
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}
