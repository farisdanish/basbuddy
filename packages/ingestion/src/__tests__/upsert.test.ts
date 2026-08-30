import { describe, it, expect, vi } from 'vitest';
import { upsertAll } from '../upsert.ts';
import type { Pool, PoolClient } from 'pg';

describe('upsertAll feed namespacing', () => {
  it('scopes all table upserts with feed_id and composite ON CONFLICT clauses', async () => {
    const executedQueries: Array<{ sql: string; params: unknown[] }> = [];

    const mockClient = {
      query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
        executedQueries.push({ sql, params: params ?? [] });
        return Promise.resolve({ rows: [], rowCount: 0 });
      }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as unknown as Pool;

    const mockData = {
      routes: [
        {
          route_id: 'T750',
          route_short_name: 'T750',
          route_long_name: 'Hab Pasar Seni ~ Shah Alam',
          route_color: '1F7A6C',
          route_type: 3,
        },
      ],
      stops: [
        {
          stop_id: 'KL1081',
          stop_name: 'Hab Pasar Seni',
          stop_lat: 3.143,
          stop_lon: 101.696,
        },
      ],
      trips: [
        {
          trip_id: 'trip_001',
          route_id: 'T750',
          service_id: 'serv_001',
          shape_id: 'shp_001',
          trip_headsign: 'Shah Alam',
          direction_id: 0,
        },
      ],
      stopTimes: [
        {
          trip_id: 'trip_001',
          stop_id: 'KL1081',
          stop_sequence: 1,
          arrival_time: '08:00:00',
          departure_time: '08:00:00',
        },
      ],
      shapes: [
        {
          shape_id: 'shp_001',
          shape_pt_lat: 3.143,
          shape_pt_lon: 101.696,
          shape_pt_sequence: 1,
        },
      ],
      calendar: [
        {
          service_id: 'serv_001',
          monday: 1 as const,
          tuesday: 1 as const,
          wednesday: 1 as const,
          thursday: 1 as const,
          friday: 1 as const,
          saturday: 0 as const,
          sunday: 0 as const,
          start_date: '20260101',
          end_date: '20261231',
        },
      ],
    };

    await upsertAll(mockPool, mockData, 'rapid-bus-mrtfeeder');

    // Verify transaction lifecycle
    expect(executedQueries[0]?.sql).toBe('BEGIN');
    expect(executedQueries[executedQueries.length - 1]?.sql).toBe('COMMIT');

    // Verify routes query scoped by feed_id
    const routeQuery = executedQueries.find((q) => q.sql.includes('INSERT INTO routes'));
    expect(routeQuery).toBeDefined();
    expect(routeQuery?.sql).toContain('ON CONFLICT (feed_id, route_id)');
    expect(routeQuery?.params).toContain('rapid-bus-mrtfeeder');
    expect(routeQuery?.params).toContain('T750');

    // Verify stops query scoped by feed_id
    const stopQuery = executedQueries.find((q) => q.sql.includes('INSERT INTO stops'));
    expect(stopQuery).toBeDefined();
    expect(stopQuery?.sql).toContain('ON CONFLICT (feed_id, stop_id)');
    expect(stopQuery?.params).toContain('rapid-bus-mrtfeeder');
    expect(stopQuery?.params).toContain('KL1081');

    // Verify trips query scoped by feed_id
    const tripQuery = executedQueries.find((q) => q.sql.includes('INSERT INTO trips'));
    expect(tripQuery).toBeDefined();
    expect(tripQuery?.sql).toContain('ON CONFLICT (feed_id, trip_id)');
    expect(tripQuery?.params).toContain('rapid-bus-mrtfeeder');

    // Verify stop_times query scoped by feed_id
    const stopTimeQuery = executedQueries.find((q) => q.sql.includes('INSERT INTO stop_times'));
    expect(stopTimeQuery).toBeDefined();
    expect(stopTimeQuery?.sql).toContain('ON CONFLICT (feed_id, trip_id, stop_sequence)');
    expect(stopTimeQuery?.params).toContain('rapid-bus-mrtfeeder');

    // Verify shapes query scoped by feed_id
    const shapeQuery = executedQueries.find((q) => q.sql.includes('INSERT INTO shapes'));
    expect(shapeQuery).toBeDefined();
    expect(shapeQuery?.sql).toContain('ON CONFLICT (feed_id, shape_id, shape_pt_sequence)');
    expect(shapeQuery?.params).toContain('rapid-bus-mrtfeeder');

    // Verify calendar query scoped by feed_id
    const calQuery = executedQueries.find((q) => q.sql.includes('INSERT INTO calendar'));
    expect(calQuery).toBeDefined();
    expect(calQuery?.sql).toContain('ON CONFLICT (feed_id, service_id)');
    expect(calQuery?.params).toContain('rapid-bus-mrtfeeder');
  });
});
