import { describe, it, expect } from 'vitest';
import { parseRoutes } from '../parsers/routes.js';
import { parseStops } from '../parsers/stops.js';
import { parseTrips } from '../parsers/trips.js';
import { parseStopTimes } from '../parsers/stopTimes.js';
import { parseShapes } from '../parsers/shapes.js';
import { parseCalendar } from '../parsers/calendar.js';
import { parseGtfsTime } from '@basbuddy/shared';

describe('GTFS Static Ingestion Parsers', () => {
  describe('parseRoutes', () => {
    it('parses routes CSV correctly', () => {
      const csv = `route_id,route_short_name,route_long_name,route_color
753,753,Shah Alam to UiTM,FF0000
T789,T789,LRT Universiti to Pantai Hillpark,`;

      const routes = parseRoutes(csv);
      expect(routes).toHaveLength(2);
      expect(routes[0]).toEqual({
        route_id: '753',
        route_short_name: '753',
        route_long_name: 'Shah Alam to UiTM',
        route_color: 'FF0000',
      });
      expect(routes[1]).toEqual({
        route_id: 'T789',
        route_short_name: 'T789',
        route_long_name: 'LRT Universiti to Pantai Hillpark',
        route_color: '',
      });
    });
  });

  describe('parseStops', () => {
    it('parses stops CSV correctly with numeric coordinates', () => {
      const csv = `stop_id,stop_name,stop_lat,stop_lon
SA786,HENTIAN BANDAR SEKSYEN 14,3.0719,101.5180
SA856,WISMA MBSA,3.0701,101.5192`;

      const stops = parseStops(csv);
      expect(stops).toHaveLength(2);
      expect(stops[0]).toEqual({
        stop_id: 'SA786',
        stop_name: 'HENTIAN BANDAR SEKSYEN 14',
        stop_lat: 3.0719,
        stop_lon: 101.5180,
      });
    });
  });

  describe('parseTrips', () => {
    it('parses trips CSV and casts direction_id to integer', () => {
      const csv = `trip_id,route_id,service_id,shape_id,trip_headsign,direction_id
trip_1,753,serv_wd,shape_1,Shah Alam,0
trip_2,753,serv_we,shape_2,UiTM,1`;

      const trips = parseTrips(csv);
      expect(trips).toHaveLength(2);
      expect(trips[0]).toEqual({
        trip_id: 'trip_1',
        route_id: '753',
        service_id: 'serv_wd',
        shape_id: 'shape_1',
        trip_headsign: 'Shah Alam',
        direction_id: 0,
      });
      expect(trips[1]?.direction_id).toBe(1);
    });
  });

  describe('parseStopTimes', () => {
    it('retains raw arrival_time and departure_time strings, including values past midnight', () => {
      const csv = `trip_id,stop_id,stop_sequence,arrival_time,departure_time
trip_1,SA786,1,08:30:00,08:30:00
trip_1,SA856,2,25:15:30,25:15:30`;

      const stopTimes = parseStopTimes(csv);
      expect(stopTimes).toHaveLength(2);
      expect(stopTimes[0]).toEqual({
        trip_id: 'trip_1',
        stop_id: 'SA786',
        stop_sequence: 1,
        arrival_time: '08:30:00',
        departure_time: '08:30:00',
      });
      // Crucial test: 25:15:30 must not be mutated or cast to Date
      expect(stopTimes[1]?.arrival_time).toBe('25:15:30');
      expect(stopTimes[1]?.departure_time).toBe('25:15:30');
      expect(stopTimes[1]?.stop_sequence).toBe(2);
    });
  });

  describe('parseShapes', () => {
    it('parses shape points with correct sequence and coordinates', () => {
      const csv = `shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence
shape_1,3.0719,101.5180,1
shape_1,3.0725,101.5185,2`;

      const shapes = parseShapes(csv);
      expect(shapes).toHaveLength(2);
      expect(shapes[0]).toEqual({
        shape_id: 'shape_1',
        shape_pt_lat: 3.0719,
        shape_pt_lon: 101.5180,
        shape_pt_sequence: 1,
      });
    });
  });

  describe('parseCalendar', () => {
    it('parses calendar bitmasks and dates correctly', () => {
      const csv = `service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date
weekday_service,1,1,1,1,1,0,0,20260101,20261231
weekend_service,0,0,0,0,0,1,1,20260101,20261231`;

      const calendar = parseCalendar(csv);
      expect(calendar).toHaveLength(2);
      expect(calendar[0]).toEqual({
        service_id: 'weekday_service',
        monday: 1,
        tuesday: 1,
        wednesday: 1,
        thursday: 1,
        friday: 1,
        saturday: 0,
        sunday: 0,
        start_date: '20260101',
        end_date: '20261231',
      });
    });
  });

  describe('parseGtfsTime', () => {
    it('converts standard GTFS times to seconds from midnight', () => {
      expect(parseGtfsTime('00:00:00')).toBe(0);
      expect(parseGtfsTime('01:00:00')).toBe(3600);
      expect(parseGtfsTime('08:30:15')).toBe(8 * 3600 + 30 * 60 + 15);
    });

    it('handles GTFS times exceeding 24:00:00 (past midnight)', () => {
      expect(parseGtfsTime('24:00:00')).toBe(24 * 3600);
      expect(parseGtfsTime('25:30:00')).toBe(25 * 3600 + 30 * 60);
    });

    it('throws on invalid or malformed times', () => {
      expect(() => parseGtfsTime('invalid')).toThrow();
      expect(() => parseGtfsTime('12:00')).toThrow();
      expect(() => parseGtfsTime('ab:cd:ef')).toThrow();
    });
  });
});
