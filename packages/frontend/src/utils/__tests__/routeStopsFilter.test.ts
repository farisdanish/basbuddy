import { describe, it, expect } from 'vitest';
import { filterRouteStops } from '../routeStopsFilter.ts';
import type { RouteStopItem } from '@basbuddy/shared';

const mockStops: RouteStopItem[] = [
  { stopId: 'KL1081', stopName: 'Hab Pasar Seni', lat: 3.1425, lon: 101.696, stopSequence: 1 },
  { stopId: 'KL1082', stopName: 'KL Sentral Monorail', lat: 3.133, lon: 101.687, stopSequence: 2 },
  { stopId: 'KL1092', stopName: 'Mid Valley North Court', lat: 3.118, lon: 101.677, stopSequence: 3 },
  { stopId: 'SA001', stopName: 'Seksyen 2 Shah Alam', lat: 3.072, lon: 101.518, stopSequence: 4 },
];

describe('routeStopsFilter', () => {
  it('returns all stops when query is empty or whitespace', () => {
    expect(filterRouteStops(mockStops, '')).toEqual(mockStops);
    expect(filterRouteStops(mockStops, '   ')).toEqual(mockStops);
  });

  it('filters stops by case-insensitive name match', () => {
    const results = filterRouteStops(mockStops, 'pasar');
    expect(results).toHaveLength(1);
    expect(results[0]?.stopId).toBe('KL1081');

    const midValley = filterRouteStops(mockStops, 'MID VALLEY');
    expect(midValley).toHaveLength(1);
    expect(midValley[0]?.stopId).toBe('KL1092');
  });

  it('filters stops by stop ID match', () => {
    const results = filterRouteStops(mockStops, '1082');
    expect(results).toHaveLength(1);
    expect(results[0]?.stopName).toBe('KL Sentral Monorail');

    const saResults = filterRouteStops(mockStops, 'sa001');
    expect(saResults).toHaveLength(1);
    expect(saResults[0]?.stopName).toBe('Seksyen 2 Shah Alam');
  });

  it('returns empty array when no stops match', () => {
    const results = filterRouteStops(mockStops, 'NonExistentStationXYZ');
    expect(results).toEqual([]);
  });
});
