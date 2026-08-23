import { useState, useEffect, useCallback } from 'react';
import type { StopTimetableResponse } from '@basbuddy/shared';
import { apiGet } from '../lib/api.ts';

export interface UseStopTimetableResult {
  data: StopTimetableResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useStopTimetable(stopId: string | null): UseStopTimetableResult {
  const [data, setData] = useState<StopTimetableResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!stopId) return;
    setLoading(true);
    try {
      const result = await apiGet<StopTimetableResponse>(`/api/stops/${stopId}/timetable`);
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
  }, [stopId, fetch]);

  return { data, loading, error, refetch: fetch };
}
