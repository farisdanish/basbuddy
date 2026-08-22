import { useState, useEffect, useCallback } from 'react';
import type { FavoritesResponse, Favorite, CreateFavoriteBody } from '@basbuddy/shared';
import { apiGet, apiPost, apiDelete } from '../lib/api.ts';

export interface UseFavoritesResult {
  favorites: Favorite[];
  loading: boolean;
  error: string | null;
  addFavorite: (body: CreateFavoriteBody) => Promise<void>;
  removeFavorite: (id: number) => Promise<void>;
  refetch: () => Promise<void>;
}

// Module-level shared store for seamless multi-component synchronization
let sharedFavorites: Favorite[] = [];
let sharedLoading = true;
let sharedError: string | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

async function fetchFavoritesFromApi() {
  sharedLoading = true;
  emitChange();
  try {
    const result = await apiGet<FavoritesResponse>('/api/favorites');
    sharedFavorites = result.favorites ?? [];
    sharedError = null;
  } catch (err) {
    sharedError = err instanceof Error ? err.message : 'Unknown error';
  } finally {
    sharedLoading = false;
    emitChange();
  }
}

export function useFavorites(): UseFavoritesResult {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);

    void fetchFavoritesFromApi();

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const addFavorite = useCallback(async (body: CreateFavoriteBody) => {
    const created = await apiPost<Favorite>('/api/favorites', body);
    sharedFavorites = [created, ...sharedFavorites.filter((f) => f.id !== created.id)];
    emitChange();
  }, []);

  const removeFavorite = useCallback(async (id: number) => {
    await apiDelete(`/api/favorites/${id}`);
    sharedFavorites = sharedFavorites.filter((f) => f.id !== id);
    emitChange();
  }, []);

  return {
    favorites: sharedFavorites,
    loading: sharedLoading,
    error: sharedError,
    addFavorite,
    removeFavorite,
    refetch: fetchFavoritesFromApi,
  };
}
