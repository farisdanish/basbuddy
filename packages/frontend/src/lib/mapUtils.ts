import type { Map as LeafletMap } from 'leaflet';
import type { GeoPosition } from '../hooks/useGeolocation.ts';

// KL city centre default (KL Sentral)
export const DEFAULT_MAP_CENTER: [number, number] = [3.1390, 101.6869];
export const DEFAULT_MAP_ZOOM = 14;

/**
 * Resolves map center coordinates from GeoPosition or falls back to default center.
 */
export function getTargetCenter(
  position: GeoPosition | null,
  defaultCenter: [number, number] = DEFAULT_MAP_CENTER,
): [number, number] {
  return position ? [position.lat, position.lon] : defaultCenter;
}

/**
 * Shared smooth flyTo helper with standardized duration and animation config.
 * When isManualInteraction is true, it fires a custom event to notify MapAutoCenter.
 */
export function smoothFlyTo(
  map: LeafletMap,
  target: [number, number],
  zoom: number = 15,
  duration: number = 1.2,
  isManualInteraction: boolean = false,
) {
  try {
    if (isManualInteraction) {
      map.fire('basbuddy:manual_recenter');
    }
    map.flyTo(target, zoom, {
      animate: true,
      duration,
    });
  } catch {
    // Gracefully handle unmounted or transitioning map instance
  }
}
