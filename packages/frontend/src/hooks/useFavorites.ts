import { useState, useEffect, useCallback } from 'react';
import type { FavoritesResponse, Favorite, CreateFavoriteBody } from '@basbuddy/shared';
import { apiGet, apiPost, apiDelete } from '../lib/api.ts';

export const FAVORITES_CACHE_KEY = 'basbuddy_favorites_cache';

export interface UseFavoritesResult {
  favorites: Favorite[];
  loading: boolean;
  error: string | null;
  addFavorite: (body: CreateFavoriteBody) => Promise<void>;
  removeFavorite: (id: number) => Promise<void>;
  refetch: () => Promise<void>;
}

function loadFavoritesFromStorage(): Favorite[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Favorite[]) : [];
  } catch {
    return [];
  }
}

function saveFavoritesToStorage(favorites: Favorite[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(favorites));
  } catch {
    // Ignore storage quota errors
  }
}

// Module-level shared store initialized with cached favorites for instant 0ms rendering
let sharedFavorites: Favorite[] = loadFavoritesFromStorage();
let sharedLoading = sharedFavorites.length === 0;
let sharedError: string | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

async function fetchFavoritesFromApi() {
  if (sharedFavorites.length === 0) {
    sharedLoading = true;
    emitChange();
  }

  try {
    const result = await apiGet<FavoritesResponse>('/api/favorites');
    if (result && Array.isArray(result.favorites)) {
      sharedFavorites = result.favorites;
      saveFavoritesToStorage(sharedFavorites);
      sharedError = null;
    }
  } catch (err) {
    // If API fetch fails, keep cached favorites and record error
    sharedError = err instanceof Error ? err.message : 'Failed to synchronize favorites';
    console.warn('[useFavorites] Background sync note:', sharedError);
  } finally {
    sharedLoading = false;
    emitChange();
  }
}

export function useFavorites(): UseFavoritesResult {
  const [favorites, setFavorites] = useState<Favorite[]>(sharedFavorites);
  const [loading, setLoading] = useState(sharedLoading);
  const [error, setError] = useState<string | null>(sharedError);

  useEffect(() => {
    const listener = () => {
      setFavorites([...sharedFavorites]);
      setLoading(sharedLoading);
      setError(sharedError);
    };
    listeners.add(listener);

    void fetchFavoritesFromApi();

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const addFavorite = useCallback(async (body: CreateFavoriteBody) => {
    // 1. Create optimistic entry so UI reacts instantly
    const tempId = -Date.now();
    const optimisticFav: Favorite = {
      id: tempId,
      stopId: body.stopId ?? null,
      routeId: body.routeId ?? null,
      label: body.label ?? (body.stopId ? `Stop ${body.stopId}` : `Route ${body.routeId}`),
      createdAt: new Date().toISOString(),
    };

    // 2. Safely deduplicate without erasing other route/stop favorites
    sharedFavorites = [
      optimisticFav,
      ...sharedFavorites.filter((f) => {
        if (body.stopId && f.stopId === body.stopId) return false;
        if (body.routeId && !body.stopId && f.routeId === body.routeId && !f.stopId) return false;
        return true;
      }),
    ];
    saveFavoritesToStorage(sharedFavorites);
    emitChange();

    // 3. Persist to API backend in the background
    try {
      const created = await apiPost<Favorite>('/api/favorites', body);
      if (created && created.id) {
        // Reconcile temporary ID with server ID
        sharedFavorites = sharedFavorites.map((f) => (f.id === tempId ? created : f));
        saveFavoritesToStorage(sharedFavorites);
        emitChange();
      }
    } catch (err) {
      console.warn('[useFavorites] Could not sync favorite to server, retained locally:', err);
    }
  }, []);

  const removeFavorite = useCallback(async (id: number) => {
    // 1. Optimistically remove from state & storage immediately
    sharedFavorites = sharedFavorites.filter((f) => f.id !== id);
    saveFavoritesToStorage(sharedFavorites);
    emitChange();

    // 2. If it is a confirmed server ID, delete from server
    if (id > 0) {
      try {
        await apiDelete(`/api/favorites/${id}`);
      } catch (err) {
        console.warn('[useFavorites] Could not delete favorite on server:', err);
      }
    }
  }, []);

  return {
    favorites,
    loading,
    error,
    addFavorite,
    removeFavorite,
    refetch: fetchFavoritesFromApi,
  };
}
