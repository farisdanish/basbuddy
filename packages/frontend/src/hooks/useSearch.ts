import { useState, useEffect, useMemo } from 'react';
import type { StopListItem, AllStopsResponse, RouteListItem, RoutesResponse } from '@basbuddy/shared';
import { apiGet } from '../lib/api.ts';

export type SearchCategory = 'all' | 'stops' | 'routes';

export interface UseSearchResult {
  stops: StopListItem[];
  routes: RouteListItem[];
  loading: boolean;
  error: string | null;
}

let cachedStops: StopListItem[] | null = null;
let cachedRoutes: RouteListItem[] | null = null;

export function useSearch(query: string, category: SearchCategory = 'all'): UseSearchResult {
  const [allStops, setAllStops] = useState<StopListItem[]>(() => cachedStops ?? []);
  const [allRoutes, setAllRoutes] = useState<RouteListItem[]>(() => cachedRoutes ?? []);
  const [loading, setLoading] = useState(!cachedStops || !cachedRoutes);
  const [error, setError] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // 200ms debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 200);
    return () => clearTimeout(handler);
  }, [query]);

  // Load static stops & routes once
  useEffect(() => {
    if (cachedStops && cachedRoutes) return;

    let mounted = true;
    const loadStaticData = async () => {
      setLoading(true);
      try {
        const [stopsRes, routesRes] = await Promise.all([
          apiGet<AllStopsResponse>('/api/stops'),
          apiGet<RoutesResponse>('/api/routes'),
        ]);
        if (mounted) {
          cachedStops = stopsRes.stops ?? [];
          cachedRoutes = routesRes.routes ?? [];
          setAllStops(cachedStops);
          setAllRoutes(cachedRoutes);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load stops/routes');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadStaticData();
    return () => {
      mounted = false;
    };
  }, []);

  const { stops, routes } = useMemo(() => {
    if (!debouncedQuery) {
      return {
        stops: category === 'routes' ? [] : allStops.slice(0, 10),
        routes: category === 'stops' ? [] : allRoutes.slice(0, 10),
      };
    }

    const q = debouncedQuery.toLowerCase();

    const matchingStops = category === 'routes'
      ? []
      : allStops.filter(
          (s) => s.stopName.toLowerCase().includes(q) || s.stopId.toLowerCase().includes(q),
        ).slice(0, 20);

    const matchingRoutes = category === 'stops'
      ? []
      : allRoutes.filter(
          (r) =>
            r.routeShortName.toLowerCase().includes(q) ||
            r.routeLongName.toLowerCase().includes(q) ||
            r.routeId.toLowerCase().includes(q),
        ).slice(0, 20);

    return { stops: matchingStops, routes: matchingRoutes };
  }, [debouncedQuery, category, allStops, allRoutes]);

  return { stops, routes, loading, error };
}
