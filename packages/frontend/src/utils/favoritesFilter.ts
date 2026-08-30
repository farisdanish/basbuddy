import type { Favorite } from '@basbuddy/shared';

export type FavoriteCategory = 'all' | 'routes' | 'stops';

export interface FilteredFavoritesResult {
  items: Favorite[];
  counts: {
    all: number;
    routes: number;
    stops: number;
  };
}

export function isRouteFavorite(fav: Favorite): boolean {
  return Boolean(fav.routeId && !fav.stopId);
}

export function isStopFavorite(fav: Favorite): boolean {
  return Boolean(fav.stopId);
}

export function filterFavorites(
  favorites: Favorite[],
  query: string,
  category: FavoriteCategory = 'all',
): FilteredFavoritesResult {
  const q = query.trim().toLowerCase();

  const totalRoutes = favorites.filter(isRouteFavorite).length;
  const totalStops = favorites.filter(isStopFavorite).length;

  const filtered = favorites.filter((fav) => {
    const isRoute = isRouteFavorite(fav);
    const isStop = isStopFavorite(fav);

    // 1. Category segment filtering
    if (category === 'routes' && !isRoute) return false;
    if (category === 'stops' && !isStop) return false;

    // 2. Query text filtering
    if (!q) return true;

    const labelMatch = fav.label ? fav.label.toLowerCase().includes(q) : false;
    const routeIdMatch = fav.routeId ? fav.routeId.toLowerCase().includes(q) : false;
    const stopIdMatch = fav.stopId ? fav.stopId.toLowerCase().includes(q) : false;

    return labelMatch || routeIdMatch || stopIdMatch;
  });

  return {
    items: filtered,
    counts: {
      all: favorites.length,
      routes: totalRoutes,
      stops: totalStops,
    },
  };
}
