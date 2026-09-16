import { useEffect, useRef, useState } from 'react';
import { Polyline } from 'react-leaflet';
import type { LiveVehicle } from '@basbuddy/shared';

interface VehicleTrailsLayerProps {
  routeId: string | null;
  vehicles?: LiveVehicle[];
}

const MAX_TRAIL_POINTS = 8;

export function VehicleTrailsLayer({
  routeId,
  vehicles = [],
}: VehicleTrailsLayerProps) {
  // Map of tripId -> Array<[lat, lon]>
  const trailsRef = useRef<Map<string, Array<[number, number]>>>(new Map());
  const [, setRevision] = useState(0);

  // Clear trails on route switch
  useEffect(() => {
    trailsRef.current.clear();
    setRevision((r) => r + 1);
  }, [routeId]);

  // Update trails when vehicles update
  useEffect(() => {
    if (!routeId || vehicles.length === 0) return;

    const currentMap = trailsRef.current;
    const activeTripIds = new Set(vehicles.map((v) => v.tripId));

    // Prune disappeared vehicles
    for (const tripId of currentMap.keys()) {
      if (!activeTripIds.has(tripId)) {
        currentMap.delete(tripId);
      }
    }

    let hasChange = false;

    for (const v of vehicles) {
      if (!v.tripId) continue;
      const trail = currentMap.get(v.tripId) ?? [];
      const lastPoint = trail[trail.length - 1];

      // Only append if position has moved (> ~5 meters, ~0.00005 deg)
      if (!lastPoint || Math.abs(lastPoint[0] - v.lat) > 0.00005 || Math.abs(lastPoint[1] - v.lon) > 0.00005) {
        const updated = [...trail, [v.lat, v.lon] as [number, number]];
        if (updated.length > MAX_TRAIL_POINTS) {
          updated.shift();
        }
        currentMap.set(v.tripId, updated);
        hasChange = true;
      }
    }

    if (hasChange) {
      setRevision((r) => r + 1);
    }
  }, [routeId, vehicles]);

  if (!routeId) return null;

  const entries = Array.from(trailsRef.current.entries());

  return (
    <>
      {entries.map(([tripId, points]) => {
        if (points.length < 2) return null;
        return (
          <Polyline
            key={`trail-${tripId}`}
            positions={points}
            pathOptions={{
              color: '#F4A100',
              weight: 3,
              opacity: 0.5,
              dashArray: '3, 6',
            }}
          />
        );
      })}
    </>
  );
}
