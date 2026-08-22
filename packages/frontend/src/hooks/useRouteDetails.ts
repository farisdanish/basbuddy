import { useState, useEffect, useCallback } from 'react';
import type { RouteDetailsResponse } from '@basbuddy/shared';
import { apiGet } from '../lib/api.ts';

const POLL_INTERVAL_MS = 30_000;

export interface UseRouteDetailsResult {
  data: RouteDetailsResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useRouteDetails(routeId: string | null): UseRouteDetailsResult {
  const [data, setData] = useState<RouteDetailsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoute = useCallback(async () => {
    if (!routeId) return;
    setLoading(true);
    try {
      const res = await apiGet<RouteDetailsResponse>(`/api/routes/${routeId}`);
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load route details');
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    if (!routeId) {
      setData(null);
      return;
    }
    void fetchRoute();
    const id = setInterval(() => void fetchRoute(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [routeId, fetchRoute]);

  return { data, loading, error, refetch: fetchRoute };
}
