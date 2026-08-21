import { useState, useEffect, useCallback } from 'react';
import type { RouteVehiclesResponse } from '@basbuddy/shared';
import { apiGet } from '../lib/api.ts';

const POLL_INTERVAL_MS = 30_000;

export interface UseVehiclePositionsResult {
  data: RouteVehiclesResponse | null;
  loading: boolean;
  error: string | null;
}

export function useVehiclePositions(routeId: string | null): UseVehiclePositionsResult {
  const [data, setData] = useState<RouteVehiclesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!routeId) return;
    setLoading(true);
    try {
      const result = await apiGet<RouteVehiclesResponse>(`/api/routes/${routeId}/vehicles`);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    if (!routeId) { setData(null); return; }
    void fetch();
    const id = setInterval(() => void fetch(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [routeId, fetch]);

  return { data, loading, error };
}
