import { describe, it, expect } from 'vitest';
import type { Favorite } from '@basbuddy/shared';
import { filterFavorites, isRouteFavorite, isStopFavorite } from '../favoritesFilter.ts';

describe('favoritesFilter pure functions', () => {
  const mockFavorites: Favorite[] = [
    {
      id: 1,
      routeId: '750',
      stopId: null,
      label: 'Route 750 (Pasar Seni ➔ UiTM)',
      createdAt: '2026-08-30T00:00:00.000Z',
    },
    {
      id: 2,
      routeId: 'T719',
      stopId: null,
      label: 'Route T719 (MRT Kajang Feeder)',
      createdAt: '2026-08-30T01:00:00.000Z',
    },
    {
      id: 3,
      routeId: null,
      stopId: 'KL1081',
      label: 'KL Sentral Monorail',
      createdAt: '2026-08-30T02:00:00.000Z',
    },
    {
      id: 4,
      routeId: '750',
      stopId: 'SA0201',
      label: 'Kompleks PKNS Shah Alam',
      createdAt: '2026-08-30T03:00:00.000Z',
    },
  ];

  it('correctly identifies route vs stop favorites', () => {
    expect(isRouteFavorite(mockFavorites[0]!)).toBe(true);
    expect(isStopFavorite(mockFavorites[0]!)).toBe(false);

    expect(isRouteFavorite(mockFavorites[2]!)).toBe(false);
    expect(isStopFavorite(mockFavorites[2]!)).toBe(true);

    // Stop favorite associated with a route
    expect(isRouteFavorite(mockFavorites[3]!)).toBe(false);
    expect(isStopFavorite(mockFavorites[3]!)).toBe(true);
  });

  it('calculates accurate aggregate counts across all categories', () => {
    const res = filterFavorites(mockFavorites, '', 'all');
    expect(res.counts).toEqual({
      all: 4,
      routes: 2,
      stops: 2,
    });
    expect(res.items.length).toBe(4);
  });

  it('filters by category segment tabs', () => {
    const routeRes = filterFavorites(mockFavorites, '', 'routes');
    expect(routeRes.items.length).toBe(2);
    expect(routeRes.items.map((f) => f.id)).toEqual([1, 2]);

    const stopRes = filterFavorites(mockFavorites, '', 'stops');
    expect(stopRes.items.length).toBe(2);
    expect(stopRes.items.map((f) => f.id)).toEqual([3, 4]);
  });

  it('filters by query string across labels, route IDs, and stop IDs case-insensitively', () => {
    // Search by label keyword
    const labelMatch = filterFavorites(mockFavorites, 'kajang', 'all');
    expect(labelMatch.items.length).toBe(1);
    expect(labelMatch.items[0]?.id).toBe(2);

    // Search by stop ID
    const stopIdMatch = filterFavorites(mockFavorites, 'kl1081', 'all');
    expect(stopIdMatch.items.length).toBe(1);
    expect(stopIdMatch.items[0]?.id).toBe(3);

    // Search by route ID matching both a route and a stop with routeId
    const routeIdMatch = filterFavorites(mockFavorites, '750', 'all');
    expect(routeIdMatch.items.length).toBe(2);

    // Search by route ID scoped to 'routes' category
    const routeIdScoped = filterFavorites(mockFavorites, '750', 'routes');
    expect(routeIdScoped.items.length).toBe(1);
    expect(routeIdScoped.items[0]?.id).toBe(1);
  });

  it('handles empty query and empty results gracefully', () => {
    const emptyQuery = filterFavorites(mockFavorites, '   ', 'all');
    expect(emptyQuery.items.length).toBe(4);

    const noMatch = filterFavorites(mockFavorites, 'nonexistent query 12345', 'all');
    expect(noMatch.items.length).toBe(0);
    expect(noMatch.counts.all).toBe(4);
  });
});
