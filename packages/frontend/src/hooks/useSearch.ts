import { useState, useEffect, useMemo } from 'react';
import type { StopListItem, AllStopsResponse, RouteListItem, RoutesResponse } from '@basbuddy/shared';
import { apiGet } from '../lib/api.ts';

export type SearchCategory = 'all' | 'stops' | 'routes';

export interface SearchStopItem extends StopListItem {
  distanceMeters?: number;
}

export interface UseSearchResult {
  stops: SearchStopItem[];
  routes: RouteListItem[];
  loading: boolean;
  error: string | null;
  isNearby: boolean;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

let cachedStops: StopListItem[] | null = null;
let cachedRoutes: RouteListItem[] | null = null;

export type UserLocationProp = { lat: number; lon: number } | [number, number] | null | undefined;

export function useSearch(
  query: string,
  category: SearchCategory = 'all',
  userLocation?: UserLocationProp,
): UseSearchResult {
  const [allStops, setAllStops] = useState<StopListItem[]>(() => cachedStops ?? []);
  const [allRoutes, setAllRoutes] = useState<RouteListItem[]>(() => cachedRoutes ?? []);
  const [nearbyRoutes, setNearbyRoutes] = useState<RouteListItem[]>([]);
  const [loading, setLoading] = useState(!cachedStops || !cachedRoutes);
  const [error, setError] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  const locLat = userLocation ? (Array.isArray(userLocation) ? userLocation[0] : userLocation.lat) : null;
  const locLon = userLocation ? (Array.isArray(userLocation) ? userLocation[1] : userLocation.lon) : null;

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

  // Fetch nearby routes when user location is available
  useEffect(() => {
    if (locLat === null || locLon === null || isNaN(locLat) || isNaN(locLon)) {
      setNearbyRoutes([]);
      return;
    }

    let mounted = true;

    const loadNearbyRoutes = async () => {
      try {
        const res = await apiGet<RoutesResponse>(
          `/api/routes?near=${locLat},${locLon}&radiusMeters=25000&limit=25`,
        );
        if (mounted && res.routes) {
          setNearbyRoutes(res.routes);
        }
      } catch (err) {
        console.warn('[useSearch] Failed to fetch nearby routes:', err);
      }
    };

    void loadNearbyRoutes();
    return () => {
      mounted = false;
    };
  }, [locLat, locLon]);

  const { stops, routes, isNearby } = useMemo(() => {
    const hasLocation = locLat !== null && locLon !== null && !isNaN(locLat) && !isNaN(locLon);
    const uLat = locLat ?? 0;
    const uLon = locLon ?? 0;

    if (!debouncedQuery) {
      // Empty query default view
      if (hasLocation && nearbyRoutes.length > 0) {
        // Compute stop distances & sort
        const stopsWithDistance: SearchStopItem[] = allStops
          .map((s) => ({
            ...s,
            distanceMeters: Math.round(haversineMeters(uLat, uLon, s.lat, s.lon)),
          }))
          .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));

        // Filter stops within ~3km, limit 10
        const nearbyStops = stopsWithDistance.filter((s) => (s.distanceMeters ?? 0) <= 3000).slice(0, 10);

        return {
          stops: category === 'routes' ? [] : (nearbyStops.length > 0 ? nearbyStops : stopsWithDistance.slice(0, 10)),
          routes: category === 'stops' ? [] : nearbyRoutes.slice(0, 15),
          isNearby: true,
        };
      }

      // Fallback when location is undisclosed or no nearby routes: prioritize active live buses
      const activeFirstRoutes = [...allRoutes].sort((a, b) => {
        const liveA = a.liveBusCount ?? 0;
        const liveB = b.liveBusCount ?? 0;
        if (liveB !== liveA) return liveB - liveA;
        return a.routeShortName.localeCompare(b.routeShortName, undefined, { numeric: true });
      });

      return {
        stops: category === 'routes' ? [] : allStops.slice(0, 10),
        routes: category === 'stops' ? [] : activeFirstRoutes.slice(0, 15),
        isNearby: false,
      };
    }

    // Active search filtering
    const q = debouncedQuery.toLowerCase();

    let matchingStops: SearchStopItem[] = allStops.filter(
      (s) => s.stopName.toLowerCase().includes(q) || s.stopId.toLowerCase().includes(q),
    );

    if (hasLocation) {
      matchingStops = matchingStops
        .map((s) => ({
          ...s,
          distanceMeters: Math.round(haversineMeters(uLat, uLon, s.lat, s.lon)),
        }))
        .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    }

    const matchingRoutes = allRoutes
      .filter(
        (r) =>
          r.routeShortName.toLowerCase().includes(q) ||
          r.routeLongName.toLowerCase().includes(q) ||
          r.routeId.toLowerCase().includes(q),
      )
      .slice(0, 20);

    return {
      stops: category === 'routes' ? [] : matchingStops.slice(0, 20),
      routes: category === 'stops' ? [] : matchingRoutes,
      isNearby: false,
    };
  }, [debouncedQuery, category, allStops, allRoutes, nearbyRoutes, locLat, locLon]);

  return { stops, routes, loading, error, isNearby };
}
