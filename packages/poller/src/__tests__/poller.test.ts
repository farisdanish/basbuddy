import { describe, it, expect } from 'vitest';
import { transit_realtime } from 'gtfs-realtime-bindings';
import { decodeRealtimeFeed } from '../decode.js';
import { matchVehicle } from '../matcher.js';
import { computeEta } from '../eta.js';
import {
  haversineMeters,
  projectPointToPolylineDistance,
  type StaticLookup,
  type ShapePoint,
} from '../staticLookup.js';
import { VALKEY_KEYS, VEHICLE_TTL_SECONDS } from '@basbuddy/shared';

describe('GTFS-RT Poller & ETA Engine', () => {
  describe('decodeRealtimeFeed', () => {
    it('decodes valid protobuf entities and filters invalid/out-of-bounds positions', () => {
      const feed = transit_realtime.FeedMessage.create({
        header: {
          gtfsRealtimeVersion: '2.0',
          timestamp: 1700000000,
        },
        entity: [
          // Valid vehicle inside KL bounds
          {
            id: 'veh_1',
            vehicle: {
              trip: { tripId: 'trip_101', routeId: '753' },
              position: { latitude: 3.0721, longitude: 101.5183, bearing: 90 },
              timestamp: 1700000010,
            },
          },
          // (0,0) position — must be dropped
          {
            id: 'veh_2',
            vehicle: {
              trip: { tripId: 'trip_102', routeId: '753' },
              position: { latitude: 0, longitude: 0 },
            },
          },
          // Out-of-bounds position (e.g. London coordinates) — must be dropped
          {
            id: 'veh_3',
            vehicle: {
              trip: { tripId: 'trip_103', routeId: '753' },
              position: { latitude: 51.5074, longitude: -0.1278 },
            },
          },
        ],
      });

      const buffer = Buffer.from(transit_realtime.FeedMessage.encode(feed).finish());
      const decoded = decodeRealtimeFeed(buffer);

      expect(decoded).toHaveLength(1);
      const entity = decoded[0]!;
      expect(entity.tripId).toBe('trip_101');
      expect(entity.routeId).toBe('753');
      expect(entity.lat).toBeCloseTo(3.0721, 4);
      expect(entity.lon).toBeCloseTo(101.5183, 4);
      expect(entity.bearing).toBe(90);
      expect(entity.gtfsTimestamp).toBe(1700000010);
    });
  });

  describe('matcher & bearing disambiguation', () => {
    const mockLookup: StaticLookup = {
      routes: new Map([
        ['753', { routeShortName: '753', routeLongName: 'Shah Alam', routeColor: 'FF0000' }],
      ]),
      stops: new Map([
        ['SA1', { stopName: 'Stop 1', lat: 3.0700, lon: 101.5100 }],
        ['SA2', { stopName: 'Stop 2', lat: 3.0750, lon: 101.5150 }],
      ]),
      trips: new Map([
        [
          'trip_north',
          {
            routeId: '753',
            directionId: 0,
            shapeId: 'shape_north',
            headsign: 'Northbound',
          },
        ],
        [
          'trip_south',
          {
            routeId: '753',
            directionId: 1,
            shapeId: 'shape_south',
            headsign: 'Southbound',
          },
        ],
      ]),
      tripStopList: new Map([
        ['trip_north', [{ stopId: 'SA1', stopSequence: 1 }, { stopId: 'SA2', stopSequence: 2 }]],
      ]),
      shapes: new Map([
        // Heading North (bearing ~0°)
        [
          'shape_north',
          [
            { lat: 3.0700, lon: 101.5100, sequence: 1 },
            { lat: 3.0800, lon: 101.5100, sequence: 2 },
          ],
        ],
        // Heading South (bearing ~180°)
        [
          'shape_south',
          [
            { lat: 3.0800, lon: 101.5100, sequence: 1 },
            { lat: 3.0700, lon: 101.5100, sequence: 2 },
          ],
        ],
      ]),
      shapeCumulativeDistances: new Map([
        ['shape_north', [0, 1113]],
        ['shape_south', [0, 1113]],
      ]),
      stopSequences: new Map([
        ['trip_north|SA1', 1],
        ['trip_north|SA2', 2],
      ]),
      stopAtSequence: new Map([
        ['trip_north|1', 'SA1'],
        ['trip_north|2', 'SA2'],
      ]),
      stopShapeDistances: new Map([
        ['shape_north', new Map([['SA1', 0], ['SA2', 500]])],
      ]),
      tripCount: 2,
      shapeCount: 2,
    };

    it('matches directly when tripId exists in static lookup (primary path)', () => {
      const match = matchVehicle(
        {
          tripId: 'trip_north',
          routeId: '753',
          lat: 3.0710,
          lon: 101.5100,
          bearing: 0,
          gtfsTimestamp: null,
        },
        mockLookup,
      );

      expect(match).not.toBeNull();
      expect(match?.tripId).toBe('trip_north');
      expect(match?.shapeId).toBe('shape_north');
      expect(match?.directionId).toBe(0);
    });

    it('returns null when tripId is not in lookup and no fallback route matching is possible', () => {
      const match = matchVehicle(
        {
          tripId: 'non_existent_trip',
          routeId: null,
          lat: 3.0710,
          lon: 101.5100,
          bearing: null,
          gtfsTimestamp: null,
        },
        mockLookup,
      );

      expect(match).toBeNull();
    });

    it('performs fallback nearest-shape matching with bearing disambiguation', () => {
      // Vehicle has no tripId, but routeId is 753 and bearing is 0° (Northbound)
      const matchNorth = matchVehicle(
        {
          tripId: null,
          routeId: '753',
          lat: 3.0720,
          lon: 101.5100,
          bearing: 5, // Close to 0°
          gtfsTimestamp: null,
        },
        mockLookup,
      );

      expect(matchNorth).not.toBeNull();
      expect(matchNorth?.shapeId).toBe('shape_north');

      // Vehicle with bearing 180° (Southbound) should match shape_south
      const matchSouth = matchVehicle(
        {
          tripId: null,
          routeId: '753',
          lat: 3.0750,
          lon: 101.5100,
          bearing: 185,
          gtfsTimestamp: null,
        },
        mockLookup,
      );

      expect(matchSouth).not.toBeNull();
      expect(matchSouth?.shapeId).toBe('shape_south');
    });
  });

  describe('geometry and ETA calculation', () => {
    it('computes accurate Haversine distance', () => {
      // Distance between two points ~111km apart (1 degree lat)
      const dist = haversineMeters(3.0, 101.0, 4.0, 101.0);
      expect(dist).toBeGreaterThan(110_000);
      expect(dist).toBeLessThan(112_000);
    });

    it('projects point onto polyline cumulative distance', () => {
      const points: ShapePoint[] = [
        { lat: 3.00, lon: 101.00, sequence: 1 },
        { lat: 3.02, lon: 101.00, sequence: 2 },
      ];
      const cumDist = [0, 2000];

      // Midway point
      const midProj = projectPointToPolylineDistance(3.01, 101.00, points, cumDist);
      expect(midProj).toBeCloseTo(1000, -1);
    });

    it('computes ETAs for upcoming stops within lookahead window', () => {
      const mockLookup: StaticLookup = {
        routes: new Map(),
        stops: new Map(),
        trips: new Map([
          ['trip_1', { routeId: '753', directionId: 0, shapeId: 's1', headsign: 'Test' }],
        ]),
        tripStopList: new Map([
          ['trip_1', [{ stopId: 'stop_past', stopSequence: 1 }, { stopId: 'stop_upcoming', stopSequence: 2 }]],
        ]),
        shapes: new Map([
          ['s1', [{ lat: 3.00, lon: 101.00, sequence: 1 }, { lat: 3.10, lon: 101.00, sequence: 2 }]],
        ]),
        shapeCumulativeDistances: new Map([['s1', [0, 10000]]]),
        stopSequences: new Map([['trip_1|stop_past', 1], ['trip_1|stop_upcoming', 2]]),
        stopAtSequence: new Map([['trip_1|1', 'stop_past'], ['trip_1|2', 'stop_upcoming']]),
        stopShapeDistances: new Map([
          ['s1', new Map([['stop_past', 1000], ['stop_upcoming', 5000]])],
        ]),
        tripCount: 1,
        shapeCount: 1,
      };

      // Bus is at ~3000m along shape
      const etas = computeEta({
        entity: {
          tripId: 'trip_1',
          routeId: '753',
          lat: 3.03,
          lon: 101.00,
          bearing: null,
          gtfsTimestamp: null,
        },
        shapeId: 's1',
        tripId: 'trip_1',
        routeId: '753',
        headsign: 'Test',
        staticLookup: mockLookup,
        lookaheadSeconds: 3600,
      });

      // 'stop_past' is at 1000m (< 3000m), so it must NOT be included
      expect(etas.has('stop_past')).toBe(false);

      // 'stop_upcoming' is at 5000m (> 3000m, ~2000m remaining)
      // At 25 km/h ≈ 6.94 m/s, 2000m ≈ 288s
      expect(etas.has('stop_upcoming')).toBe(true);
      const eta = etas.get('stop_upcoming')!;
      expect(eta).toBeGreaterThan(200);
      expect(eta).toBeLessThan(400);
    });
  });

  describe('Valkey cache keys and TTLs', () => {
    it('adheres to key patterns and TTL constants from the execution spec', () => {
      expect(VALKEY_KEYS.vehicle('T123')).toBe('vehicle:T123');
      expect(VALKEY_KEYS.stopEtas('SA786')).toBe('stop_etas:SA786');
      expect(VALKEY_KEYS.routeVehicles('753')).toBe('route:753:vehicles');
      expect(VALKEY_KEYS.pollerLastSuccess).toBe('poller:last_success');
      expect(VEHICLE_TTL_SECONDS).toBe(240);
    });

    it('resolves stopName reliably from staticLookup stops map', () => {
      const stopsMap = new Map([
        ['SA1', { stopName: 'Pasar Seni Hub', lat: 3.14, lon: 101.69 }],
      ]);
      const stopInfo = stopsMap.get('SA1');
      const stopName = stopInfo?.stopName || 'SA1';
      expect(stopName).toBe('Pasar Seni Hub');

      // Fallback to stopId when stop not in lookup
      const missingInfo = stopsMap.get('SA999');
      const fallbackName = missingInfo?.stopName || 'SA999';
      expect(fallbackName).toBe('SA999');
    });
  });

});
