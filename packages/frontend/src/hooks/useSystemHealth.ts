import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api.ts';

export interface HealthResponse {
  status: string;
  pollerLastSuccess: string | null;
  timestamp: string;
}

export type SystemHealthStatus = 'live' | 'stale' | 'offline';

export interface UseSystemHealthResult {
  status: SystemHealthStatus;
  isDegraded: boolean;
  pollerAgeSeconds: number | null;
  isOnline: boolean;
}

const POLL_INTERVAL_MS = 30_000;
const STALENESS_THRESHOLD_SECONDS = 90;

export function useSystemHealth(): UseSystemHealthResult {
  const [status, setStatus] = useState<SystemHealthStatus>('live');
  const [isDegraded, setIsDegraded] = useState(false);
  const [pollerAgeSeconds, setPollerAgeSeconds] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  const checkHealth = useCallback(async () => {
    try {
      const res = await apiGet<HealthResponse>('/health');
      setIsOnline(true);

      if (!res.pollerLastSuccess) {
        setStatus('stale');
        setIsDegraded(true);
        setPollerAgeSeconds(null);
        return;
      }

      const age = Math.round((Date.now() - new Date(res.pollerLastSuccess).getTime()) / 1000);
      setPollerAgeSeconds(age);

      if (age > STALENESS_THRESHOLD_SECONDS) {
        setStatus('stale');
        setIsDegraded(true);
      } else {
        setStatus('live');
        setIsDegraded(false);
      }
    } catch {
      setIsOnline(false);
      setStatus('offline');
      setIsDegraded(true);
    }
  }, []);

  useEffect(() => {
    void checkHealth();
    const id = setInterval(() => void checkHealth(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [checkHealth]);

  return { status, isDegraded, pollerAgeSeconds, isOnline };
}
