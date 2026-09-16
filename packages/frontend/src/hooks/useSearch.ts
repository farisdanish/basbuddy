import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { StopListItem, AllStopsResponse, RouteListItem, RoutesResponse } from '@basbuddy/shared';
import { apiGet } from '../lib/api.ts';

export type SearchCategory = 'all' | 'stops' | 'routes';
export type SearchAnchor = 'gps' | 'map';

export interface SearchStopItem extends StopListItem {
  distanceMeters?: number;
}

export interface SearchMapViewport {
  lat: number;
  lon: number;
  zoom?: number;
  radiusMeters?: number;
}

export interface UseSearchResult {
  stops: SearchStopItem[];
  routes: RouteListItem[];
  loading: boolean;
  error: string | null;
  isNearby: boolean;
  searchAnchor: SearchAnchor;
  isMapDiverged: boolean;
  divergenceDistance: number | null;
  activeRadiusMeters: number;
  refreshMapArea: () => void;
  resetToGps: () => void;
  refresh: () => void;
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
  mapViewport?: SearchMapViewport | null,
): UseSearchResult {
  const [allStops, setAllStops] = useState<StopListItem[]>(() => cachedStops ?? []);
  const [allRoutes, setAllRoutes] = useState<RouteListItem[]>(() => cachedRoutes ?? []);
  const [nearbyRoutes, setNearbyRoutes] = useState<RouteListItem[]>([]);
  const [loading, setLoading] = useState(!cachedStops || !cachedRoutes);
  const [error, setError] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  const locLat = userLocation ? (Array.isArray(userLocation) ? userLocation[0] : userLocation.lat) : null;
  const locLon = userLocation ? (Array.isArray(userLocation) ? userLocation[1] : userLocation.lon) : null;
  const hasGps = locLat !== null && locLon !== null && !isNaN(locLat) && !isNaN(locLon);

  // By default, searchAnchor is 'gps'. It switches to 'map' only when user explicitly refreshes/searches map area.
  const [searchAnchor, setSearchAnchor] = useState<SearchAnchor>('gps');
  const [refreshTick, setRefreshTick] = useState(0);

  // Track if user explicitly clicked "Search Map Area"
  const userSwitchedToMapRef = useRef(false);

  // Compute divergence between GPS and map viewport
  const { isMapDiverged, divergenceDistance } = useMemo(() => {
    if (!mapViewport) {
      return { isMapDiverged: false, divergenceDistance: null };
    }
    if (!hasGps) {
      // When GPS is unavailable, map area search is always available
      return { isMapDiverged: true, divergenceDistance: null };
    }
    const dist = Math.round(haversineMeters(locLat!, locLon!, mapViewport.lat, mapViewport.lon));
    return {
      isMapDiverged: dist > 1000,
      divergenceDistance: dist,
    };
  }, [hasGps, locLat, locLon, mapViewport]);

  // Determine active coordinates and radius
  const { activeLat, activeLon, activeRadiusMeters } = useMemo(() => {
    if (searchAnchor === 'map' && mapViewport) {
      return {
        activeLat: mapViewport.lat,
        activeLon: mapViewport.lon,
        activeRadiusMeters: Math.min(50000, Math.max(1000, mapViewport.radiusMeters ?? 25000)),
      };
    }
    if (hasGps) {
      return {
        activeLat: locLat,
        activeLon: locLon,
        activeRadiusMeters: 25000,
      };
    }
    return {
      activeLat: null,
      activeLon: null,
      activeRadiusMeters: 25000,
    };
  }, [searchAnchor, mapViewport, hasGps, locLat, locLon]);

  // 200ms debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 200);
    return () => clearTimeout(handler);
  }, [query]);

  // Load static stops & routes once on startup
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

  // Fetch nearby routes for active anchor (GPS or Map Viewport) only when coordinates are active
  useEffect(() => {
    if (activeLat === null || activeLon === null || isNaN(activeLat) || isNaN(activeLon)) {
      setNearbyRoutes([]);
      return;
    }

    let mounted = true;

    const loadNearbyRoutes = async () => {
      try {
        const res = await apiGet<RoutesResponse>(
          `/api/routes?near=${activeLat},${activeLon}&radiusMeters=${activeRadiusMeters}&limit=25`,
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
  }, [activeLat, activeLon, activeRadiusMeters, refreshTick]);

  const refreshMapArea = useCallback(() => {
    userSwitchedToMapRef.current = true;
    setSearchAnchor('map');
    setRefreshTick((t) => t + 1);
  }, []);

  const resetToGps = useCallback(() => {
    userSwitchedToMapRef.current = false;
    setSearchAnchor('gps');
    setRefreshTick((t) => t + 1);
  }, []);

  const refresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  const { stops, routes, isNearby } = useMemo(() => {
    const hasActiveCoords = activeLat !== null && activeLon !== null && !isNaN(activeLat) && !isNaN(activeLon);
    const uLat = activeLat ?? 0;
    const uLon = activeLon ?? 0;

    if (!debouncedQuery) {
      // Empty query default view
      if (hasActiveCoords && nearbyRoutes.length > 0) {
        // Compute stop distances & sort relative to active coordinates
        const stopsWithDistance: SearchStopItem[] = allStops
          .map((s) => ({
            ...s,
            distanceMeters: Math.round(haversineMeters(uLat, uLon, s.lat, s.lon)),
          }))
          .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));

        // When in map mode, filter stops within active map radius (min 2000m); when in GPS mode, ~3000m
        const stopRadiusThreshold = searchAnchor === 'map' ? Math.max(activeRadiusMeters, 2000) : 3000;
        const nearbyStops = stopsWithDistance.filter((s) => (s.distanceMeters ?? 0) <= stopRadiusThreshold).slice(0, 10);

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

    if (hasActiveCoords) {
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
  }, [debouncedQuery, category, allStops, allRoutes, nearbyRoutes, activeLat, activeLon, searchAnchor, activeRadiusMeters]);

  return {
    stops,
    routes,
    loading,
    error,
    isNearby,
    searchAnchor,
    isMapDiverged,
    divergenceDistance,
    activeRadiusMeters,
    refreshMapArea,
    resetToGps,
    refresh,
  };
}
