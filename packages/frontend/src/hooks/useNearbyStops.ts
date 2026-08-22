import { useState, useEffect, useCallback, useRef } from 'react';
import type { NearbyStop, NearbyStopsResponse } from '@basbuddy/shared';
import { apiGet } from '../lib/api.ts';

export interface UseNearbyStopsResult {
  stops: NearbyStop[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useNearbyStops(
  lat: number | null,
  lon: number | null,
  radiusMeters = 2000,
  limit = 40,
): UseNearbyStopsResult {
  const [stops, setStops] = useState<NearbyStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastCoordsRef = useRef<{ lat: number; lon: number } | null>(null);

  const fetchStops = useCallback(async () => {
    if (lat === null || lon === null) return;
    setLoading(true);
    try {
      const res = await apiGet<NearbyStopsResponse>(
        `/api/stops?near=${lat},${lon}&radiusMeters=${radiusMeters}&limit=${limit}`,
      );
      setStops(res.stops ?? []);
      setError(null);
      lastCoordsRef.current = { lat, lon };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch nearby stops');
    } finally {
      setLoading(false);
    }
  }, [lat, lon, radiusMeters, limit]);

  useEffect(() => {
    if (lat === null || lon === null) return;

    // Check if coordinates shifted significantly (> 100m)
    if (lastCoordsRef.current) {
      const dLat = Math.abs(lastCoordsRef.current.lat - lat);
      const dLon = Math.abs(lastCoordsRef.current.lon - lon);
      // ~0.001 deg is ~110m
      if (dLat < 0.001 && dLon < 0.001 && stops.length > 0) {
        return;
      }
    }

    void fetchStops();
  }, [lat, lon, fetchStops, stops.length]);

  return { stops, loading, error, refetch: fetchStops };
}
