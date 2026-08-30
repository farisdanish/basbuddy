import { useEffect, useRef } from 'react';
import { useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import type { RouteDetailsResponse } from '@basbuddy/shared';

interface RoutePolylineLayerProps {
  routeData: RouteDetailsResponse | null;
}

export function RoutePolylineLayer({
  routeData,
}: RoutePolylineLayerProps) {
  const map = useMap();
  const lastFittedRouteId = useRef<string | null>(null);

  useEffect(() => {
    if (!routeData) {
      lastFittedRouteId.current = null;
      return;
    }

    if (!routeData.shapes || routeData.shapes.length === 0) return;

    // Only fitBounds upon initial selection of this route, not on 30s polling re-renders
    if (lastFittedRouteId.current === routeData.routeId) {
      return;
    }

    lastFittedRouteId.current = routeData.routeId;

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
    </>
  );
}
