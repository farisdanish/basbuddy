import { describe, it, expect } from 'vitest';
import type { LiveVehicle, RouteDirection, RouteStopItem } from '@basbuddy/shared';
import {
  getVehicleMovementState,
  formatRelativeGpsAge,
  buildRouteStopsLookup,
  findVehicleStopProgress,
  updateDwellTracker,
  type DwellRecord,
} from '../vehicleStatus.ts';

describe('vehicleStatus utilities', () => {
  describe('getVehicleMovementState', () => {
    it('returns "in_transit" when dwell minutes is 0 and speed is not specified', () => {
      const state = getVehicleMovementState(0);
      expect(state.status).toBe('in_transit');
      expect(state.label).toBe('En Route');
      expect(state.badgeClass).toContain('text-emerald-300');
    });

    it('returns "at_stop" when dwell minutes is between 0 and 10', () => {
      const state1 = getVehicleMovementState(0.5);
      expect(state1.status).toBe('at_stop');
      expect(state1.label).toBe('At Stop');
      expect(state1.badgeClass).toContain('text-sky-300');

      const state2 = getVehicleMovementState(9.9);
      expect(state2.status).toBe('at_stop');
    });

    it('returns "holding_dwell" when dwell minutes >= 10', () => {
      const state = getVehicleMovementState(12.4);
      expect(state.status).toBe('holding_dwell');
      expect(state.label).toBe('Holding / Dwell (~12m)');
      expect(state.badgeClass).toContain('text-amber-300');
    });

    it('evaluates speed telemetry tiers when not dwelling', () => {
      // Cruising speed (>= 35 km/h)
      const cruising = getVehicleMovementState(0, 48.2);
      expect(cruising.status).toBe('cruising');
      expect(cruising.label).toBe('Cruising (48 km/h)');
      expect(cruising.badgeClass).toContain('text-emerald-300');

      // Slow traffic (0 < speed < 15 km/h)
      const slow = getVehicleMovementState(0, 8.4);
      expect(slow.status).toBe('slow_traffic');
      expect(slow.label).toBe('Slow Traffic (8 km/h)');
      expect(slow.badgeClass).toContain('text-orange-300');

      // Normal in transit (15 <= speed < 35 km/h)
      const enRoute = getVehicleMovementState(0, 26.0);
      expect(enRoute.status).toBe('in_transit');
      expect(enRoute.label).toBe('En Route (26 km/h)');

      // Stationary (0 km/h)
      const stationary = getVehicleMovementState(0, 0);
      expect(stationary.status).toBe('at_stop');
      expect(stationary.label).toBe('Stationary (0 km/h)');
    });

    it('dwell time takes precedence over speed telemetry', () => {
      // Dwell >= 10 min overrides speed
      const dwellState = getVehicleMovementState(15, 40);
      expect(dwellState.status).toBe('holding_dwell');
      expect(dwellState.label).toContain('Holding / Dwell');

      // Dwell > 0 min overrides speed
      const atStopState = getVehicleMovementState(2, 20);
      expect(atStopState.status).toBe('at_stop');
      expect(atStopState.label).toBe('At Stop');
    });
  });

  describe('formatRelativeGpsAge', () => {
    const now = 1700000000000;

    it('formats timestamps under 10 seconds as "Just now"', () => {
      const iso = new Date(now - 5000).toISOString();
      expect(formatRelativeGpsAge(iso, now)).toBe('Just now');
    });

    it('formats timestamps in seconds', () => {
      const iso = new Date(now - 35000).toISOString();
      expect(formatRelativeGpsAge(iso, now)).toBe('35s ago');
    });

    it('formats timestamps in minutes', () => {
      const iso = new Date(now - 150000).toISOString();
      expect(formatRelativeGpsAge(iso, now)).toBe('2m ago');
    });

    it('formats timestamps in hours', () => {
      const iso = new Date(now - 7200000).toISOString();
      expect(formatRelativeGpsAge(iso, now)).toBe('2h ago');
    });

    it('handles null or invalid timestamps gracefully', () => {
      expect(formatRelativeGpsAge(null, now)).toBe('Unknown GPS');
      expect(formatRelativeGpsAge(undefined, now)).toBe('Unknown GPS');
      expect(formatRelativeGpsAge('not-a-date', now)).toBe('Unknown GPS');
    });
  });

  describe('buildRouteStopsLookup', () => {
    it('aggregates unique stops across all directions and fallback list', () => {
      const directions: RouteDirection[] = [
        {
          directionId: 0,
          tripHeadsign: 'Terminus A',
          stops: [
            { stopId: 'STOP_1', stopName: 'Stop 1', lat: 3.1, lon: 101.6, stopSequence: 1 },
            { stopId: 'STOP_2', stopName: 'Stop 2', lat: 3.2, lon: 101.7, stopSequence: 2 },
          ],
        },
        {
          directionId: 1,
          tripHeadsign: 'Terminus B',
          stops: [
            { stopId: 'STOP_3', stopName: 'Stop 3', lat: 3.3, lon: 101.8, stopSequence: 1 },
            { stopId: 'STOP_1', stopName: 'Stop 1 (Return)', lat: 3.1, lon: 101.6, stopSequence: 2 },
          ],
        },
      ];

      const fallback: RouteStopItem[] = [
        { stopId: 'STOP_4', stopName: 'Stop 4', lat: 3.4, lon: 101.9, stopSequence: 4 },
      ];

      const lookup = buildRouteStopsLookup(directions, fallback);
      expect(lookup.size).toBe(4);
      expect(lookup.get('STOP_1')?.stopName).toBe('Stop 1');
      expect(lookup.get('STOP_3')?.stopName).toBe('Stop 3');
      expect(lookup.get('STOP_4')?.stopName).toBe('Stop 4');
    });
  });

  describe('findVehicleStopProgress', () => {
    const stopsLookup = new Map<string, RouteStopItem>([
      ['STOP_A', { stopId: 'STOP_A', stopName: 'Alpha', lat: 3.1, lon: 101.1, stopSequence: 1 }],
      ['STOP_B', { stopId: 'STOP_B', stopName: 'Beta', lat: 3.2, lon: 101.2, stopSequence: 2 }],
      ['STOP_C', { stopId: 'STOP_C', stopName: 'Gamma', lat: 3.3, lon: 101.3, stopSequence: 3 }],
    ]);

    const dirStops: RouteStopItem[] = [
      { stopId: 'STOP_A', stopName: 'Alpha', lat: 3.1, lon: 101.1, stopSequence: 1 },
      { stopId: 'STOP_B', stopName: 'Beta', lat: 3.2, lon: 101.2, stopSequence: 2 },
      { stopId: 'STOP_C', stopName: 'Gamma', lat: 3.3, lon: 101.3, stopSequence: 3 },
    ];

    it('resolves nearest stop, next stop, sequence, and stops remaining', () => {
      const vehicle: LiveVehicle = {
        tripId: 'TRIP_101',
        routeId: '750',
        lat: 3.2,
        lon: 101.2,
        bearing: 90,
        timestamp: new Date().toISOString(),
        freshness: 'live',
        nearestStopId: 'STOP_B',
      };

      const progress = findVehicleStopProgress(vehicle, stopsLookup, dirStops);
      expect(progress.nearestStop?.stopName).toBe('Beta');
      expect(progress.nextStop?.stopName).toBe('Gamma');
      expect(progress.stopSequence).toBe(2);
      expect(progress.stopsRemaining).toBe(1);
    });

    it('handles vehicles at terminus stop (0 remaining)', () => {
      const vehicle: LiveVehicle = {
        tripId: 'TRIP_102',
        routeId: '750',
        lat: 3.3,
        lon: 101.3,
        bearing: null,
        timestamp: new Date().toISOString(),
        freshness: 'live',
        nearestStopId: 'STOP_C',
      };

      const progress = findVehicleStopProgress(vehicle, stopsLookup, dirStops);
      expect(progress.nearestStop?.stopName).toBe('Gamma');
      expect(progress.nextStop).toBeNull();
      expect(progress.stopSequence).toBe(3);
      expect(progress.stopsRemaining).toBe(0);
    });

    it('correctly resolves stop sequence and remaining stops for return direction stops', () => {
      const returnDirStops: RouteStopItem[] = [
        { stopId: 'STOP_C', stopName: 'Gamma', lat: 3.3, lon: 101.3, stopSequence: 1 },
        { stopId: 'STOP_B', stopName: 'Beta', lat: 3.2, lon: 101.2, stopSequence: 2 },
        { stopId: 'STOP_A', stopName: 'Alpha', lat: 3.1, lon: 101.1, stopSequence: 3 },
      ];

      const returnVehicle: LiveVehicle = {
        tripId: 'TRIP_RETURN',
        routeId: '750',
        lat: 3.2,
        lon: 101.2,
        bearing: 270,
        timestamp: new Date().toISOString(),
        freshness: 'live',
        nearestStopId: 'STOP_B',
        directionId: 1,
      };

      const progress = findVehicleStopProgress(returnVehicle, stopsLookup, returnDirStops);
      expect(progress.nearestStop?.stopName).toBe('Beta');
      expect(progress.nextStop?.stopName).toBe('Alpha');
      expect(progress.stopSequence).toBe(2);
      expect(progress.stopsRemaining).toBe(1);
    });
  });

  describe('updateDwellTracker', () => {
    it('debounces initial stationary observation and accumulates dwell on subsequent cycles', () => {
      const dwellMap = new Map<string, DwellRecord>();
      const t0 = 1000000;
      const routeId = '750';

      const vehicles: LiveVehicle[] = [
        {
          tripId: 'TRIP_1',
          routeId,
          lat: 3.1,
          lon: 101.1,
          bearing: null,
          timestamp: new Date(t0).toISOString(),
          freshness: 'live',
          nearestStopId: 'STOP_1',
        },
      ];

      // Poll 1 (t0): Initial observation -> debounced (dwell 0)
      const res1 = updateDwellTracker(dwellMap, routeId, vehicles, t0);
      expect(res1.get('TRIP_1')).toBe(0);
      expect(dwellMap.get('750:TRIP_1')?.consecutiveStationaryCycles).toBe(1);

      // Poll 2 (t0 + 30s): Same stop -> confirmed dwell > 0
      const t1 = t0 + 30 * 1000;
      const res2 = updateDwellTracker(dwellMap, routeId, vehicles, t1);
      expect(res2.get('TRIP_1')).toBeCloseTo(0.5, 1);
      expect(dwellMap.get('750:TRIP_1')?.consecutiveStationaryCycles).toBe(2);

      // Poll 20 (t0 + 11 mins): Stationary for 11 mins -> confirmed dwell >= 11
      const t20 = t0 + 11 * 60 * 1000;
      const res20 = updateDwellTracker(dwellMap, routeId, vehicles, t20);
      expect(res20.get('TRIP_1')).toBeGreaterThanOrEqual(11);
    });

    it('resets dwell when vehicle moves to a new nearest stop', () => {
      const dwellMap = new Map<string, DwellRecord>();
      const t0 = 1000000;
      const routeId = '750';

      const vAtStop1: LiveVehicle[] = [
        {
          tripId: 'TRIP_1',
          routeId,
          lat: 3.1,
          lon: 101.1,
          bearing: null,
          timestamp: new Date(t0).toISOString(),
          freshness: 'live',
          nearestStopId: 'STOP_1',
        },
      ];

      updateDwellTracker(dwellMap, routeId, vAtStop1, t0);
      updateDwellTracker(dwellMap, routeId, vAtStop1, t0 + 30000);
      expect(dwellMap.get('750:TRIP_1')?.consecutiveStationaryCycles).toBe(2);

      // Vehicle moves to STOP_2
      const vAtStop2: LiveVehicle[] = [
        {
          tripId: 'TRIP_1',
          routeId,
          lat: 3.2,
          lon: 101.2,
          bearing: null,
          timestamp: new Date(t0 + 60000).toISOString(),
          freshness: 'live',
          nearestStopId: 'STOP_2',
        },
      ];

      const resMove = updateDwellTracker(dwellMap, routeId, vAtStop2, t0 + 60000);
      expect(resMove.get('TRIP_1')).toBe(0);
      expect(dwellMap.get('750:TRIP_1')?.stopId).toBe('STOP_2');
      expect(dwellMap.get('750:TRIP_1')?.consecutiveStationaryCycles).toBe(1);
    });

    it('isolates state across route switches (drops stale route entries)', () => {
      const dwellMap = new Map<string, DwellRecord>();
      const t0 = 1000000;

      // Track on route 750
      const vRoute750: LiveVehicle[] = [
        {
          tripId: 'TRIP_A',
          routeId: '750',
          lat: 3.1,
          lon: 101.1,
          bearing: null,
          timestamp: new Date(t0).toISOString(),
          freshness: 'live',
          nearestStopId: 'STOP_1',
        },
      ];
      updateDwellTracker(dwellMap, '750', vRoute750, t0);
      expect(dwellMap.has('750:TRIP_A')).toBe(true);

      // Switch to route T728
      const vRouteT728: LiveVehicle[] = [
        {
          tripId: 'TRIP_B',
          routeId: 'T728',
          lat: 3.5,
          lon: 101.5,
          bearing: null,
          timestamp: new Date(t0 + 10000).toISOString(),
          freshness: 'live',
          nearestStopId: 'STOP_99',
        },
      ];

      updateDwellTracker(dwellMap, 'T728', vRouteT728, t0 + 10000);
      expect(dwellMap.has('750:TRIP_A')).toBe(false); // Pruned!
      expect(dwellMap.has('T728:TRIP_B')).toBe(true);
    });

    it('prunes departed vehicles no longer present in feed', () => {
      const dwellMap = new Map<string, DwellRecord>();
      const t0 = 1000000;
      const routeId = '750';

      const vTwoBuses: LiveVehicle[] = [
        { tripId: 'BUS_1', routeId, lat: 3.1, lon: 101.1, bearing: null, timestamp: '', freshness: 'live', nearestStopId: 'S1' },
        { tripId: 'BUS_2', routeId, lat: 3.2, lon: 101.2, bearing: null, timestamp: '', freshness: 'live', nearestStopId: 'S2' },
      ];
      updateDwellTracker(dwellMap, routeId, vTwoBuses, t0);
      expect(dwellMap.size).toBe(2);

      // Next cycle, BUS_1 completed its trip and is gone
      const vOneBus: LiveVehicle[] = [
        { tripId: 'BUS_2', routeId, lat: 3.2, lon: 101.2, bearing: null, timestamp: '', freshness: 'live', nearestStopId: 'S2' },
      ];
      updateDwellTracker(dwellMap, routeId, vOneBus, t0 + 30000);
      expect(dwellMap.has('750:BUS_1')).toBe(false);
      expect(dwellMap.has('750:BUS_2')).toBe(true);
    });
  });
});
