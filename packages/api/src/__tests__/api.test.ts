import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { VALKEY_KEYS, type StopEtasResponse } from '@basbuddy/shared';

// ── Mock Factory ─────────────────────────────────────────────────────────────

function createMockValkey() {
  const store = new Map<string, string>();
  const setStore = new Map<string, Set<string>>();

  return {
    store,
    setStore,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, val: string) => {
      store.set(key, val);
      return 'OK';
    }),
    smembers: vi.fn(async (key: string) => Array.from(setStore.get(key) ?? [])),
    mget: vi.fn(async (...keys: string[]) => keys.map((k) => store.get(k) ?? null)),
  };
}

function createMockPool() {
  return {
    query: vi.fn(async <T = any>(_queryText?: string, _values?: any[]): Promise<{ rows: T[]; rowCount: number }> => ({
      rows: [] as T[],
      rowCount: 0,
    })),
  };
}


describe('BasBuddy REST API (M4)', () => {
  let mockValkey: ReturnType<typeof createMockValkey>;
  let mockPool: ReturnType<typeof createMockPool>;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    mockValkey = createMockValkey();
    mockPool = createMockPool();
    app = createApp({
      valkey: mockValkey as any,
      pool: mockPool as any,
    });
  });

  // ── 1. GET /health ─────────────────────────────────────────────────────────
  describe('GET /health', () => {
    it('returns status ok, pollerHealthy true, and numeric age when poller heartbeat is fresh (< 90s)', async () => {
      const now = Date.now();
      const recentTimestamp = new Date(now - 15 * 1000).toISOString(); // 15s ago
      mockValkey.store.set(VALKEY_KEYS.pollerLastSuccess, recentTimestamp);

      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.pollerHealthy).toBe(true);
      expect(res.body.pollerAgeSeconds).toBeGreaterThanOrEqual(14);
      expect(res.body.pollerAgeSeconds).toBeLessThanOrEqual(16);
      expect(res.body.pollerLastSuccess).toBe(recentTimestamp);
      expect(res.body.timestamp).toBeDefined();
    });

    it('returns status degraded and pollerHealthy false when poller heartbeat is stale (> 90s)', async () => {
      const now = Date.now();
      const staleTimestamp = new Date(now - 150 * 1000).toISOString(); // 150s ago
      mockValkey.store.set(VALKEY_KEYS.pollerLastSuccess, staleTimestamp);

      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('degraded');
      expect(res.body.pollerHealthy).toBe(false);
      expect(res.body.pollerAgeSeconds).toBeGreaterThanOrEqual(149);
      expect(res.body.pollerLastSuccess).toBe(staleTimestamp);
    });

    it('returns status degraded, pollerHealthy false, and pollerAgeSeconds -1 when heartbeat is absent (null)', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('degraded');
      expect(res.body.pollerHealthy).toBe(false);
      expect(res.body.pollerAgeSeconds).toBe(-1);
      expect(res.body.pollerLastSuccess).toBeNull();
    });

    it('mounts same health check at /api/health', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('degraded');
    });
  });

  // ── 2. GET /api/stops ──────────────────────────────────────────────────────
  describe('GET /api/stops', () => {
    it('returns AllStopsResponse without origin or distanceMeters for unscoped query', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { stop_id: 'SA1', stop_name: 'Pasar Seni', stop_lat: 3.142, stop_lon: 101.695 },
          { stop_id: 'SA2', stop_name: 'KL Sentral', stop_lat: 3.134, stop_lon: 101.686 },
        ],
        rowCount: 2,
      });

      const res = await request(app).get('/api/stops');
      expect(res.status).toBe(200);
      expect(res.body.stops).toHaveLength(2);
      expect(res.body.stops[0]).toEqual({
        stopId: 'SA1',
        stopName: 'Pasar Seni',
        lat: 3.142,
        lon: 101.695,
      });
      expect(res.body.origin).toBeUndefined();
      expect(res.body.stops[0].distanceMeters).toBeUndefined();
    });

    it('returns NearbyStopsResponse with origin and sorted distanceMeters for scoped ?near query', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { stop_id: 'SA_FAR', stop_name: 'Far Stop', stop_lat: 3.145, stop_lon: 101.695 },
          { stop_id: 'SA_NEAR', stop_name: 'Near Stop', stop_lat: 3.139, stop_lon: 101.687 },
        ],
        rowCount: 2,
      });

      const res = await request(app).get('/api/stops?near=3.1390,101.6869&radiusMeters=2000');
      expect(res.status).toBe(200);
      expect(res.body.origin).toEqual({ lat: 3.139, lon: 101.6869 });
      expect(res.body.stops).toHaveLength(2);
      // Closest stop must be first
      expect(res.body.stops[0].stopId).toBe('SA_NEAR');
      expect(res.body.stops[0].distanceMeters).toBeLessThan(res.body.stops[1].distanceMeters);
    });

    it('returns 400 invalid_near_param on malformed ?near param', async () => {
      const res = await request(app).get('/api/stops?near=abc,def');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_near_param');
    });
  });

  // ── 3. GET /api/stops/:stopId/etas ─────────────────────────────────────────
  describe('GET /api/stops/:stopId/etas', () => {
    it('returns 404 stop_not_found when stopId is not found in database', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await request(app).get('/api/stops/UNKNOWN_STOP/etas');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('stop_not_found');
    });

    it('returns parsed StopEtasResponse directly on Valkey cache HIT', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ stop_id: 'SA1', stop_name: 'KL Sentral Hub' }],
        rowCount: 1,
      });

      const cachedData: StopEtasResponse = {
        stopId: 'SA1',
        stopName: 'KL Sentral Hub',
        generatedAt: '2026-08-22T14:00:00.000Z',
        arrivals: [
          {
            tripId: 'T101',
            routeId: '753',
            routeShortName: '753',
            tripHeadsign: 'Shah Alam',
            etaSeconds: 180,
            source: 'live',
            freshness: 'live',
            vehicle: { lat: 3.14, lon: 101.69, bearing: 90 },
          },
        ],
      };
      mockValkey.store.set(VALKEY_KEYS.stopEtas('SA1'), JSON.stringify(cachedData));

      const res = await request(app).get('/api/stops/SA1/etas');
      expect(res.status).toBe(200);
      expect(res.body.stopId).toBe('SA1');
      expect(res.body.stopName).toBe('KL Sentral Hub');
      expect(res.body.arrivals).toHaveLength(1);
      expect(res.body.arrivals[0].etaSeconds).toBe(180);
      expect(res.body.arrivals[0].source).toBe('live');
    });

    it('enriches empty stopName from Postgres when Valkey cached payload has empty stopName (defensive fallback)', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ stop_id: 'SA1', stop_name: 'KL Sentral Hub' }],
        rowCount: 1,
      });

      const cachedWithEmptyName: StopEtasResponse = {
        stopId: 'SA1',
        stopName: '',
        generatedAt: '2026-08-22T14:00:00.000Z',
        arrivals: [],
      };
      mockValkey.store.set(VALKEY_KEYS.stopEtas('SA1'), JSON.stringify(cachedWithEmptyName));

      const res = await request(app).get('/api/stops/SA1/etas');
      expect(res.status).toBe(200);
      expect(res.body.stopName).toBe('KL Sentral Hub');
    });

    it('falls back to static schedule on Valkey cache MISS, sets signal_lost & schedule source', async () => {
      // 1. Stop lookup query
      mockPool.query.mockResolvedValueOnce({
        rows: [{ stop_id: 'SA1', stop_name: 'KL Sentral Hub' }],
        rowCount: 1,
      });

      // Compute arrival_time ~10 minutes ahead in KL time
      const now = new Date();
      const klTimeStr = now.toLocaleTimeString('en-MY', {
        timeZone: 'Asia/Kuala_Lumpur',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const [h, m, s] = klTimeStr.split(':').map((v) => parseInt(v, 10));
      const targetSec = (h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0) + 600;
      const targetH = Math.floor(targetSec / 3600);
      const targetM = Math.floor((targetSec % 3600) / 60);
      const targetS = targetSec % 60;
      const arrivalTimeStr = `${String(targetH).padStart(2, '0')}:${String(targetM).padStart(2, '0')}:${String(targetS).padStart(2, '0')}`;

      // 2. Schedule lookup query
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            trip_id: 'SCH_TRIP_1',
            route_id: '753',
            route_short_name: '753',
            trip_headsign: 'Shah Alam',
            arrival_time: arrivalTimeStr,
          },
        ],
        rowCount: 1,
      });

      const res = await request(app).get('/api/stops/SA1/etas');
      expect(res.status).toBe(200);
      expect(res.body.stopId).toBe('SA1');
      expect(res.body.arrivals).toHaveLength(1);
      const arrival = res.body.arrivals[0];
      expect(arrival.tripId).toBe('SCH_TRIP_1');
      expect(arrival.source).toBe('schedule');
      expect(arrival.freshness).toBe('signal_lost');
      expect(arrival.vehicle).toBeNull();
      expect(arrival.etaSeconds).toBeGreaterThanOrEqual(580);
      expect(arrival.etaSeconds).toBeLessThanOrEqual(620);
    });
  });

  // ── 4. GET /api/routes ─────────────────────────────────────────────────────
  describe('GET /api/routes', () => {
    it('returns RoutesResponse ordered by route_short_name', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { route_id: '753', route_short_name: '753', route_long_name: 'Shah Alam', route_color: 'FF0000' },
          { route_id: '754', route_short_name: '754', route_long_name: 'Klang', route_color: '00FF00' },
        ],
        rowCount: 2,
      });

      const res = await request(app).get('/api/routes');
      expect(res.status).toBe(200);
      expect(res.body.routes).toHaveLength(2);
      expect(res.body.routes[0].routeId).toBe('753');
      expect(res.body.routes[1].routeId).toBe('754');
    });
  });

  // ── 5. GET /api/routes/:routeId/vehicles ───────────────────────────────────
  describe('GET /api/routes/:routeId/vehicles', () => {
    it('returns live vehicle positions and evaluates live / stale / signal_lost freshness', async () => {
      const now = Date.now();
      mockValkey.store.set(VALKEY_KEYS.pollerLastSuccess, new Date(now - 10 * 1000).toISOString());

      // Set of vehicles for route 753
      mockValkey.setStore.set(VALKEY_KEYS.routeVehicles('753'), new Set(['T_LIVE', 'T_STALE', 'T_LOST']));

      mockValkey.store.set(
        VALKEY_KEYS.vehicle('T_LIVE'),
        JSON.stringify({
          tripId: 'T_LIVE',
          routeId: '753',
          lat: 3.14,
          lon: 101.69,
          bearing: 90,
          timestamp: new Date(now - 30 * 1000).toISOString(), // 30s ago -> live
        }),
      );

      mockValkey.store.set(
        VALKEY_KEYS.vehicle('T_STALE'),
        JSON.stringify({
          tripId: 'T_STALE',
          routeId: '753',
          lat: 3.15,
          lon: 101.70,
          bearing: 180,
          timestamp: new Date(now - 150 * 1000).toISOString(), // 150s ago -> stale
        }),
      );

      mockValkey.store.set(
        VALKEY_KEYS.vehicle('T_LOST'),
        JSON.stringify({
          tripId: 'T_LOST',
          routeId: '753',
          lat: 3.16,
          lon: 101.71,
          bearing: 270,
          timestamp: new Date(now - 300 * 1000).toISOString(), // 300s ago -> signal_lost
        }),
      );

      const res = await request(app).get('/api/routes/753/vehicles');
      expect(res.status).toBe(200);
      expect(res.body.routeId).toBe('753');
      expect(res.body.vehicles).toHaveLength(3);

      const liveVeh = res.body.vehicles.find((v: any) => v.tripId === 'T_LIVE');
      const staleVeh = res.body.vehicles.find((v: any) => v.tripId === 'T_STALE');
      const lostVeh = res.body.vehicles.find((v: any) => v.tripId === 'T_LOST');

      expect(liveVeh.freshness).toBe('live');
      expect(staleVeh.freshness).toBe('stale');
      expect(lostVeh.freshness).toBe('signal_lost');
    });

    it('marks all vehicles as signal_lost when poller heartbeat is stale (> 90s)', async () => {
      const now = Date.now();
      // Poller is stale (120s ago)
      mockValkey.store.set(VALKEY_KEYS.pollerLastSuccess, new Date(now - 120 * 1000).toISOString());
      mockValkey.setStore.set(VALKEY_KEYS.routeVehicles('753'), new Set(['T_RECENT']));

      mockValkey.store.set(
        VALKEY_KEYS.vehicle('T_RECENT'),
        JSON.stringify({
          tripId: 'T_RECENT',
          routeId: '753',
          lat: 3.14,
          lon: 101.69,
          bearing: 90,
          timestamp: new Date(now - 10 * 1000).toISOString(),
        }),
      );

      const res = await request(app).get('/api/routes/753/vehicles');
      expect(res.status).toBe(200);
      expect(res.body.vehicles[0].freshness).toBe('signal_lost');
    });

    it('returns empty vehicles array when no live vehicles exist for route', async () => {
      const res = await request(app).get('/api/routes/NON_EXISTENT_ROUTE/vehicles');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ routeId: 'NON_EXISTENT_ROUTE', vehicles: [] });
    });
  });

  // ── 6. Favorites CRUD (/api/favorites) ─────────────────────────────────────
  describe('Favorites CRUD', () => {
    it('GET /api/favorites returns list of favorites', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 1, stop_id: 'SA1', route_id: '753', label: 'Home', created_at: '2026-08-22T10:00:00Z' },
        ],
        rowCount: 1,
      });

      const res = await request(app).get('/api/favorites');
      expect(res.status).toBe(200);
      expect(res.body.favorites).toHaveLength(1);
      expect(res.body.favorites[0].stopId).toBe('SA1');
      expect(res.body.favorites[0].label).toBe('Home');
    });

    it('POST /api/favorites creates favorite and returns 201', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 42, stop_id: 'SA1', route_id: '753', label: 'Work', created_at: '2026-08-22T10:00:00Z' },
        ],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/favorites')
        .send({ stopId: 'SA1', routeId: '753', label: 'Work' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(42);
      expect(res.body.stopId).toBe('SA1');
      expect(res.body.label).toBe('Work');
    });

    it('POST /api/favorites returns 400 on missing stopId', async () => {
      const res = await request(app)
        .post('/api/favorites')
        .send({ label: 'No Stop' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('missing_stop_id');
    });

    it('POST /api/favorites returns 400 on foreign key violation (stop or route not found)', async () => {
      const fkError = new Error('FK violation') as any;
      fkError.code = '23503';
      mockPool.query.mockRejectedValueOnce(fkError);

      const res = await request(app)
        .post('/api/favorites')
        .send({ stopId: 'INVALID_STOP' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_stop_or_route');
    });

    it('DELETE /api/favorites/:id returns 204 on successful deletion', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await request(app).delete('/api/favorites/42');
      expect(res.status).toBe(204);
    });

    it('DELETE /api/favorites/:id returns 404 when favorite not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await request(app).delete('/api/favorites/999');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('DELETE /api/favorites/:id returns 400 on invalid NaN ID', async () => {
      const res = await request(app).delete('/api/favorites/not-a-number');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_id');
    });
  });

  // ── 7. 404 Catch-All ───────────────────────────────────────────────────────
  describe('404 Catch-All', () => {
    it('returns 404 not_found on unknown routes', async () => {
      const res = await request(app).get('/api/unknown_endpoint');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });
  });
});
