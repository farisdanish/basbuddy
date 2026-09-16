import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api.ts';
import type {
  HealthResponse,
  UpstreamHealthInfo,
  StaticScheduleHealthInfo,
} from '@basbuddy/shared';

export type SystemHealthStatus = 'live' | 'stale' | 'offline';

export interface UseSystemHealthResult {
  status: SystemHealthStatus;
  isDegraded: boolean;
  pollerAgeSeconds: number | null;
  isOnline: boolean;
  upstream?: UpstreamHealthInfo;
  schedule?: StaticScheduleHealthInfo;
  lastChecked: Date | null;
  isRefreshing: boolean;
  refreshHealth: () => Promise<void>;
}

const POLL_INTERVAL_MS = 30_000;
const STALENESS_THRESHOLD_SECONDS = 90;

export function useSystemHealth(): UseSystemHealthResult {
  const [status, setStatus] = useState<SystemHealthStatus>('live');
  const [isDegraded, setIsDegraded] = useState(false);
  const [pollerAgeSeconds, setPollerAgeSeconds] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [upstream, setUpstream] = useState<UpstreamHealthInfo | undefined>(undefined);
  const [schedule, setSchedule] = useState<StaticScheduleHealthInfo | undefined>(undefined);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkHealth = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await apiGet<HealthResponse>('/api/health');
      setIsOnline(true);
      setLastChecked(new Date());
      setUpstream(res.upstream);
      setSchedule(res.schedule);

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
      setLastChecked(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void checkHealth();
    const id = setInterval(() => void checkHealth(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [checkHealth]);

  return {
    status,
    isDegraded,
    pollerAgeSeconds,
    isOnline,
    upstream,
    schedule,
    lastChecked,
    isRefreshing,
    refreshHealth: checkHealth,
  };
}

