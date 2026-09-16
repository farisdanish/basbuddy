import { useMemo } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { LiveVehicle } from '@basbuddy/shared';
import { useVehiclePositions } from '../../hooks/useVehiclePositions.ts';
import { getStableVehicleIndex, formatVehicleBadgeLabel } from '../../utils/vehicleStatus.ts';

interface VehicleMarkersLayerProps {
  routeId: string | null;
  vehicles?: LiveVehicle[];
  routeShortName?: string;
  selectedVehicleTripId?: string | null;
  onSelectVehicle?: (tripId: string) => void;
}

function createVehicleIcon(
  routeShortName: string,
  vehicleIndex: number | null,
  bearing: number | null,
  isLive: boolean,
  isSelected: boolean,
) {
  const size = isSelected ? 44 : 38;
  const anchor = size / 2;

  const bearingTransform = bearing !== null ? `transform: rotate(${bearing}deg);` : 'display: none;';
  const livePulse = isLive
    ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-[#E94B8C] rounded-full border-2 border-white animate-pulse"></div>'
    : '';

  const indexBadge = vehicleIndex !== null
    ? `<div class="absolute -top-2 -left-2 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#101B2D] border border-[#F4A100] text-[9px] font-mono font-bold text-[#F4A100] shadow-md z-10">#${vehicleIndex}</div>`
    : '';

  const selectedRing = isSelected
    ? 'ring-4 ring-[#F4A100] shadow-[0_0_15px_rgba(244,161,0,0.8)] scale-110'
    : 'shadow-lg shadow-black/40';

  return L.divIcon({
    className: 'vehicle-marker-icon',
    html: `
      <div class="relative flex items-center justify-center cursor-pointer select-none transition-transform duration-200" style="width: ${size}px; height: ${size}px;">
        <!-- Numbered Vehicle Index Badge -->
        ${indexBadge}

        <!-- Directional heading arrow (rotates according to bearing) -->
        <div class="absolute inset-0 flex items-center justify-center transition-transform duration-300 pointer-events-none" style="${bearingTransform}">
          <div class="w-0 h-0 border-x-4 border-x-transparent border-b-[8px] border-b-[#101B2D] -translate-y-5"></div>
        </div>

        <!-- Central Mango Route Badge -->
        <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-[#F4A100] border-2 border-[#101B2D] ${selectedRing} transition-all">
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
  selectedVehicleTripId,
  onSelectVehicle,
}: VehicleMarkersLayerProps) {
  const { data } = useVehiclePositions(propVehicles ? null : routeId);
  const vehicles = propVehicles ?? data?.vehicles ?? [];

  const markers = useMemo(() => {
    return vehicles.map((v) => {
      const isLive = v.freshness === 'live';
      const isSelected = selectedVehicleTripId === v.tripId;
      const vehicleIndex = getStableVehicleIndex(v.tripId, vehicles);
      const icon = createVehicleIcon(
        routeShortName || v.routeId,
        vehicleIndex,
        v.bearing,
        isLive,
        isSelected,
      );
      return {
        vehicle: v,
        vehicleIndex,
        icon,
      };
    });
  }, [vehicles, routeShortName, selectedVehicleTripId]);

  return (
    <>
      {markers.map(({ vehicle, vehicleIndex, icon }) => (
        <Marker
          key={`${vehicle.tripId}-${vehicle.lat}-${vehicle.lon}`}
          position={[vehicle.lat, vehicle.lon]}
          icon={icon}
          eventHandlers={{
            click: () => {
              if (onSelectVehicle) {
                onSelectVehicle(vehicle.tripId);
              }
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -16]} opacity={0.95}>
            <div className="text-center font-sans text-xs">
              <span className="font-bold text-[#101B2D]">
                {formatVehicleBadgeLabel(vehicleIndex, vehicles.length)} • Route {routeShortName || vehicle.routeId}
              </span>
              {vehicle.bearing !== null && (
                <span className="block text-[10px] text-gray-600">Heading: {Math.round(vehicle.bearing)}°</span>
              )}
              {vehicle.speedKmh !== null && vehicle.speedKmh !== undefined && (
                <span className="block text-[10px] text-gray-600">Speed: {Math.round(vehicle.speedKmh)} km/h</span>
              )}
              <span className="block text-[9px] font-mono text-gray-500 mt-0.5">
                Trip: {vehicle.tripId}
              </span>
            </div>
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}

