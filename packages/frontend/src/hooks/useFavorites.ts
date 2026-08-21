import { useState, useEffect, useCallback } from 'react';
import type { FavoritesResponse, Favorite, CreateFavoriteBody } from '@basbuddy/shared';
import { apiGet, apiPost, apiDelete } from '../lib/api.ts';

export interface UseFavoritesResult {
  favorites: Favorite[];
  loading: boolean;
  error: string | null;
  addFavorite: (body: CreateFavoriteBody) => Promise<void>;
  removeFavorite: (id: number) => Promise<void>;
}

export function useFavorites(): UseFavoritesResult {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await apiGet<FavoritesResponse>('/api/favorites');
      setFavorites(result.favorites);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const addFavorite = useCallback(async (body: CreateFavoriteBody) => {
    const created = await apiPost<Favorite>('/api/favorites', body);
    setFavorites((prev) => [created, ...prev]);
  }, []);

  const removeFavorite = useCallback(async (id: number) => {
    await apiDelete(`/api/favorites/${id}`);
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return { favorites, loading, error, addFavorite, removeFavorite };
}
