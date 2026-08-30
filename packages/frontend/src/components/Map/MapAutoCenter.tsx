import { useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import type { GeoPosition } from '../../hooks/useGeolocation.ts';
import { smoothFlyTo } from '../../lib/mapUtils.ts';

interface MapAutoCenterProps {
  position: GeoPosition | null;
}

export function MapAutoCenter({ position }: MapAutoCenterProps) {
  const map = useMap();
  const hasAutoCentered = useRef(false);
  const userInteracted = useRef(false);

  // Unconditionally attach map instance to window for Playwright E2E inspection & debugging
  useEffect(() => {
    window.__leafletMap = map;
    return () => {
      if (window.__leafletMap === map) {
        window.__leafletMap = undefined;
      }
    };
  }, [map]);

  // Listen for user touch/drag/zoom interactions to abort auto-centering
  useMapEvents({
    movestart: (e) => {
      // If triggered by a real user interaction (drag/pinch/keyboard)
      if ('originalEvent' in e && (e as { originalEvent?: unknown }).originalEvent) {
        userInteracted.current = true;
      }
    },
    dragstart: () => {
      userInteracted.current = true;
    },
    zoomstart: (e) => {
      if ('originalEvent' in e && (e as { originalEvent?: unknown }).originalEvent) {
        userInteracted.current = true;
      }
    },
  });

  // Listen for programmatic manual recenter / reset view events
  useEffect(() => {
    const handleManualRecenter = () => {
      userInteracted.current = true;
      hasAutoCentered.current = true;
    };

    map.on('basbuddy:manual_recenter', handleManualRecenter);
    return () => {
      map.off('basbuddy:manual_recenter', handleManualRecenter);
    };
  }, [map]);

  // Startup timeout fallback: if GPS doesn't lock within 3s, gracefully keep current view
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasAutoCentered.current && !userInteracted.current) {
        hasAutoCentered.current = true;
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // When GPS lock is delivered, fly to location if high accuracy (< 500m)
  useEffect(() => {
    if (!position || hasAutoCentered.current || userInteracted.current) {
      return;
    }

    if (position.accuracy <= 500) {
      hasAutoCentered.current = true;
      smoothFlyTo(map, [position.lat, position.lon], 15);
    }
  }, [position, map]);

  return null;
}
