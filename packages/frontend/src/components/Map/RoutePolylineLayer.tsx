import { useEffect } from 'react';
import { useMap, Polyline, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import type { RouteDetailsResponse } from '@basbuddy/shared';

interface RoutePolylineLayerProps {
  routeData: RouteDetailsResponse | null;
  onSelectStop: (stopId: string) => void;
}

export function RoutePolylineLayer({
  routeData,
  onSelectStop,
}: RoutePolylineLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!routeData || !routeData.shapes || routeData.shapes.length === 0) return;

    try {
      const bounds = L.latLngBounds(routeData.shapes);
      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [80, 80],
          maxZoom: 15,
          animate: true,
          duration: 1.2,
        });
      }
    } catch {
      // Ignore if coordinates are invalid
    }
  }, [routeData, map]);

  if (!routeData || !routeData.shapes || routeData.shapes.length === 0) return null;

  const routeColor = routeData.routeColor
    ? `#${routeData.routeColor.replace('#', '')}`
    : '#1F7A6C';

  return (
    <>
      {/* Outer contrast outline */}
      <Polyline
        positions={routeData.shapes}
        pathOptions={{
          color: '#101B2D',
          weight: 7,
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />

      {/* Main glowing route polyline */}
      <Polyline
        positions={routeData.shapes}
        pathOptions={{
          color: routeColor,
          weight: 4,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />

      {/* Stop markers along the route */}
      {(routeData.stops ?? []).map((stop) => (
        <CircleMarker
          key={stop.stopId}
          center={[stop.lat, stop.lon]}
          radius={5}
          pathOptions={{
            color: '#101B2D',
            fillColor: '#FFF8EE',
            fillOpacity: 1,
            weight: 2,
          }}
          eventHandlers={{
            click: () => onSelectStop(stop.stopId),
          }}
        >
          <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
            <span className="font-sans font-semibold text-xs text-[#101B2D]">
              {stop.stopName}
            </span>
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}
