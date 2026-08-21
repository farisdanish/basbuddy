import { useState, useEffect, useCallback } from 'react';
import type { StopEtasResponse } from '@basbuddy/shared';
import { apiGet } from '../lib/api.ts';

// ─── useStopEtas ──────────────────────────────────────────────────────────────
// Polls /api/stops/:stopId/etas every 30s (matching the backend cache TTL).
// Returns the full StopEtasResponse so components can read arrivals + generatedAt.

const POLL_INTERVAL_MS = 30_000;

export interface UseStopEtasResult {
  data: StopEtasResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useStopEtas(stopId: string | null): UseStopEtasResult {
  const [data, setData] = useState<StopEtasResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!stopId) return;
    setLoading(true);
    try {
      const result = await apiGet<StopEtasResponse>(`/api/stops/${stopId}/etas`);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [stopId]);

  useEffect(() => {
    if (!stopId) {
      setData(null);
      return;
    }
    void fetch();
    const id = setInterval(() => void fetch(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [stopId, fetch]);

  return { data, loading, error, refetch: fetch };
}
