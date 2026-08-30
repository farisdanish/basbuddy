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
    scard: vi.fn(async (key: string) => setStore.get(key)?.size ?? 0),
    mget: vi.fn(async (...keys: string[]) => keys.map((k) => store.get(k) ?? null)),
    pipeline: vi.fn(() => {
      const calls: Array<() => [null, number]> = [];
      const pipe = {
        scard: (key: string) => {
          calls.push(() => [null, setStore.get(key)?.size ?? 0]);
          return pipe;
        },
        exec: async () => calls.map((c) => c()),
      };
      return pipe;
    }),
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
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('feed_id = $2'),
        ['SA1', 'rapid-bus-kl'],
      );
    });
  });

  // ── 4. GET /api/routes ─────────────────────────────────────────────────────
  describe('GET /api/routes', () => {
    it('returns RoutesResponse ordered by route_short_name with liveBusCount', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { route_id: '753', route_short_name: '753', route_long_name: 'Shah Alam', route_color: 'FF0000' },
          { route_id: '754', route_short_name: '754', route_long_name: 'Klang', route_color: '00FF00' },
        ],
        rowCount: 2,
      });

      mockValkey.setStore.set(VALKEY_KEYS.routeVehicles('753'), new Set(['VEH_1']));

      const res = await request(app).get('/api/routes');
      expect(res.status).toBe(200);
      expect(res.body.routes).toHaveLength(2);
      expect(res.body.routes[0].routeId).toBe('753');
      expect(res.body.routes[0].liveBusCount).toBe(1);
      expect(res.body.routes[1].routeId).toBe('754');
      expect(res.body.routes[1].liveBusCount).toBe(0);
    });

    it('returns nearby routes sorted by distanceMeters when ?near is provided', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { route_id: '753', route_short_name: '753', route_long_name: 'Shah Alam', route_color: 'FF0000', distance_meters: 450 },
          { route_id: '754', route_short_name: '754', route_long_name: 'Klang', route_color: '00FF00', distance_meters: 1800 },
        ],
        rowCount: 2,
      });

      mockValkey.setStore.set(VALKEY_KEYS.routeVehicles('753'), new Set(['VEH_1']));

      const res = await request(app).get('/api/routes?near=3.14,101.69&radiusMeters=25000');
      expect(res.status).toBe(200);
      expect(res.body.routes).toHaveLength(2);
      expect(res.body.routes[0].routeId).toBe('753');
      expect(res.body.routes[0].distanceMeters).toBe(450);
      expect(res.body.routes[0].liveBusCount).toBe(1);
      expect(res.body.routes[1].distanceMeters).toBe(1800);
    });

    it('returns 400 for invalid ?near parameter in /api/routes', async () => {
      const res = await request(app).get('/api/routes?near=invalid,coordinates');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_near_param');
    });

    it('GET /api/routes/:routeId returns RouteDetailsResponse with timetable', async () => {
      // 1. route basic info
      mockPool.query.mockResolvedValueOnce({
        rows: [{ route_id: '753', route_short_name: '753', route_long_name: 'Shah Alam', route_color: 'FF0000' }],
        rowCount: 1,
      });
      // 2. directions
      mockPool.query.mockResolvedValueOnce({
        rows: [{ direction_id: 0, trip_headsign: 'Terminal', shape_id: 'sh_1', trip_id: 'trip_1' }],
        rowCount: 1,
      });
      // 3. shapes
      mockPool.query.mockResolvedValueOnce({
        rows: [{ shape_pt_lat: 3.14, shape_pt_lon: 101.69 }],
        rowCount: 1,
      });
      // 4. stops
      mockPool.query.mockResolvedValueOnce({
        rows: [{ stop_id: 'SA1', stop_name: 'Stop 1', stop_lat: 3.14, stop_lon: 101.69, stop_sequence: 1 }],
        rowCount: 1,
      });
      // 5. timetable departures query
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { trip_id: 'trip_1', direction_id: 0, trip_headsign: 'Terminal', departure_time: '06:30:00' },
          { trip_id: 'trip_2', direction_id: 0, trip_headsign: 'Terminal', departure_time: '23:00:00' },
        ],
        rowCount: 2,
      });

      const res = await request(app).get('/api/routes/753');
      expect(res.status).toBe(200);
      expect(res.body.routeId).toBe('753');
      expect(res.body.routeShortName).toBe('753');
      expect(res.body.directions[0].stops).toHaveLength(1);
      expect(res.body.directions[0].shapes).toHaveLength(1);
      expect(res.body.timetable).not.toBeNull();
      expect(res.body.timetable.firstBusTime).toBe('06:30:00');
      expect(res.body.timetable.lastBusTime).toBe('23:00:00');
      expect(res.body.timetable.totalTripsToday).toBe(2);
      expect(res.body.timetable.allDepartures).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('feed_id = $2'),
        ['753', 'rapid-bus-kl'],
      );
    });

    it('GET /api/routes/:routeId/timetable returns full timetable departures for a route', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            trip_id: 'trip_1',
            direction_id: 0,
            trip_headsign: 'UiTM Puncak Alam',
            departure_time: '06:20:00',
            arrival_time: '06:20:00',
            stop_sequence: 1,
            stop_id: 'SA786',
            stop_name: 'Hentian Bandar Seksyen 14',
          },
          {
            trip_id: 'trip_2',
            direction_id: 0,
            trip_headsign: 'UiTM Puncak Alam',
            departure_time: '08:00:00',
            arrival_time: '08:00:00',
            stop_sequence: 1,
            stop_id: 'SA786',
            stop_name: 'Hentian Bandar Seksyen 14',
          },
        ],
        rowCount: 2,
      });

      const res = await request(app).get('/api/routes/753/timetable?directionId=0');
      expect(res.status).toBe(200);
      expect(res.body.firstBusTime).toBe('06:20:00');
      expect(res.body.lastBusTime).toBe('08:00:00');
      expect(res.body.totalTripsToday).toBe(2);
      expect(res.body.allDepartures).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('feed_id = $2'),
        ['753', 'rapid-bus-kl', 0],
      );
    });
  });

  // ── 4b. GET /api/stops/:stopId/timetable ─────────────────────────────────────
  describe('GET /api/stops/:stopId/timetable', () => {
    it('returns full 24h timetable for a stop', async () => {
      // 1. stop check
      mockPool.query.mockResolvedValueOnce({
        rows: [{ stop_id: 'SA1', stop_name: 'Kompleks PKNS' }],
        rowCount: 1,
      });
      // 2. schedule query
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            trip_id: 'T1',
            route_id: '753',
            route_short_name: '753',
            trip_headsign: 'UiTM',
            departure_time: '06:45:00',
            direction_id: 0,
          },
        ],
        rowCount: 1,
      });

      const res = await request(app).get('/api/stops/SA1/timetable');
      expect(res.status).toBe(200);
      expect(res.body.stopId).toBe('SA1');
      expect(res.body.stopName).toBe('Kompleks PKNS');
      expect(res.body.departures).toHaveLength(1);
      expect(res.body.departures[0].routeShortName).toBe('753');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('feed_id = $2'),
        ['SA1', 'rapid-bus-kl'],
      );
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
    const testDeviceId = '11111111-2222-4333-8444-555555555555';

    it('GET /api/favorites returns 400 when x-device-id header is missing', async () => {
      const res = await request(app).get('/api/favorites');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('missing_device_id');
    });

    it('GET /api/favorites returns 400 when x-device-id header is invalid', async () => {
      const res = await request(app)
        .get('/api/favorites')
        .set('x-device-id', 'bad!id');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_device_id');
    });

    it('GET /api/favorites returns list of favorites for requesting device', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 1, stop_id: 'SA1', route_id: '753', label: 'Home', created_at: '2026-08-22T10:00:00Z' },
        ],
        rowCount: 1,
      });

      const res = await request(app)
        .get('/api/favorites')
        .set('x-device-id', testDeviceId);

      expect(res.status).toBe(200);
      expect(res.body.favorites).toHaveLength(1);
      expect(res.body.favorites[0].stopId).toBe('SA1');
      expect(res.body.favorites[0].label).toBe('Home');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE device_id = $1'),
        [testDeviceId],
      );
    });

    it('POST /api/favorites returns 400 when x-device-id is missing', async () => {
      const res = await request(app)
        .post('/api/favorites')
        .send({ stopId: 'SA1', label: 'Work' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('missing_device_id');
    });

    it('POST /api/favorites creates stop favorite and returns 201', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 42, stop_id: 'SA1', route_id: null, label: 'Work', created_at: '2026-08-22T10:00:00Z' },
        ],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/favorites')
        .set('x-device-id', testDeviceId)
        .send({ stopId: 'SA1', label: 'Work' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(42);
      expect(res.body.stopId).toBe('SA1');
      expect(res.body.label).toBe('Work');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO favorites'),
        ['rapid-bus-kl', 'SA1', null, 'Work', testDeviceId],
      );
    });

    it('POST /api/favorites creates route-only favorite and returns 201', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 43, feed_id: 'rapid-bus-kl', stop_id: null, route_id: 'T7280', label: 'Route T728', created_at: '2026-08-22T10:00:00Z' },
        ],
        rowCount: 1,
      });

      const res = await request(app)
        .post('/api/favorites')
        .set('x-device-id', testDeviceId)
        .send({ routeId: 'T7280', label: 'Route T728' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(43);
      expect(res.body.routeId).toBe('T7280');
      expect(res.body.stopId).toBeNull();
      expect(res.body.label).toBe('Route T728');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO favorites'),
        ['rapid-bus-kl', null, 'T7280', 'Route T728', testDeviceId],
      );
    });

    it('POST /api/favorites returns 400 when both stopId and routeId are missing', async () => {
      const res = await request(app)
        .post('/api/favorites')
        .set('x-device-id', testDeviceId)
        .send({ label: 'No Stop Or Route' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('missing_target');
    });

    it('POST /api/favorites returns 400 on foreign key violation (stop or route not found)', async () => {
      const fkError = new Error('FK violation') as any;
      fkError.code = '23503';
      mockPool.query.mockRejectedValueOnce(fkError);

      const res = await request(app)
        .post('/api/favorites')
        .set('x-device-id', testDeviceId)
        .send({ stopId: 'INVALID_STOP' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_stop_or_route');
    });

    it('DELETE /api/favorites/:id returns 400 when x-device-id is missing', async () => {
      const res = await request(app).delete('/api/favorites/42');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('missing_device_id');
    });

    it('DELETE /api/favorites/:id returns 204 on successful deletion', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

      const res = await request(app)
        .delete('/api/favorites/42')
        .set('x-device-id', testDeviceId);
      expect(res.status).toBe(204);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND device_id = $2'),
        [42, testDeviceId],
      );
    });

    it('DELETE /api/favorites/:id returns 404 when favorite not found or belongs to another device', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await request(app)
        .delete('/api/favorites/999')
        .set('x-device-id', testDeviceId);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('DELETE /api/favorites/:id returns 400 on invalid NaN ID', async () => {
      const res = await request(app)
        .delete('/api/favorites/not-a-number')
        .set('x-device-id', testDeviceId);
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
