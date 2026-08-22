import { useMemo } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { NearbyStop } from '@basbuddy/shared';

interface StopMarkersLayerProps {
  stops: NearbyStop[];
  selectedStopId: string | null;
  onSelectStop: (stopId: string) => void;
}

function createStopIcon(isSelected: boolean) {
  const size = isSelected ? 34 : 26;
  const anchor = size / 2;

  const bgClass = isSelected
    ? 'bg-[#1F7A6C] ring-4 ring-[#F4A100] scale-110 shadow-xl'
    : 'bg-[#1F7A6C] border-2 border-[#FFF8EE] shadow-md hover:scale-110';

  return L.divIcon({
    className: 'stop-marker-icon',
    html: `
      <div class="relative flex items-center justify-center rounded-full transition-transform duration-200 cursor-pointer ${bgClass}" style="width: ${size}px; height: ${size}px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="${isSelected ? 18 : 14}" height="${isSelected ? 18 : 14}" viewBox="0 0 24 24" fill="none" stroke="#FFF8EE" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 6v6"/>
          <path d="M15 6v6"/>
          <path d="M2 12h19.6"/>
          <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-2.8-2.2-5-5-5H7c-2.8 0-5 2.2-5 5 0 .4.1.8.2 1.2.3 1.1.8 2.8.8 2.8h3"/>
          <circle cx="7" cy="18" r="2"/>
          <circle cx="17" cy="18" r="2"/>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
  });
}

export function StopMarkersLayer({
  stops,
  selectedStopId,
  onSelectStop,
}: StopMarkersLayerProps) {
  const standardIcon = useMemo(() => createStopIcon(false), []);
  const selectedIcon = useMemo(() => createStopIcon(true), []);

  return (
    <>
      {stops.map((stop) => {
        const isSelected = selectedStopId === stop.stopId;
        return (
          <Marker
            key={stop.stopId}
            position={[stop.lat, stop.lon]}
            icon={isSelected ? selectedIcon : standardIcon}
            eventHandlers={{
              click: () => onSelectStop(stop.stopId),
            }}
          >
            <Tooltip direction="top" offset={[0, -14]} opacity={0.9}>
              <span className="font-display font-semibold text-xs text-[#101B2D]">
                {stop.stopName}
              </span>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
