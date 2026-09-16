import { describe, it, expect } from 'vitest';
import {
  haversineMeters,
  distanceToSegmentMeters,
  minDistanceToPolylineMeters,
  isVehicleOffCourse,
} from '../geoUtils.ts';

describe('geoUtils', () => {
  describe('haversineMeters', () => {
    it('returns 0 for identical points', () => {
      expect(haversineMeters(3.14, 101.69, 3.14, 101.69)).toBe(0);
    });

    it('calculates approximately correct distance between KL Sentral and Pasar Seni (~1.5 km)', () => {
      const dist = haversineMeters(3.134, 101.686, 3.142, 101.695);
      expect(dist).toBeGreaterThan(1200);
      expect(dist).toBeLessThan(1800);
    });
  });

  describe('distanceToSegmentMeters', () => {
    it('returns distance to segment when point lies directly beside it', () => {
      // Segment along latitude 3.14 from lon 101.0 to 101.1
      // Point at 3.141, 101.05 (roughly 111m north)
      const d = distanceToSegmentMeters(3.141, 101.05, 3.14, 101.0, 3.14, 101.1);
      expect(d).toBeGreaterThan(100);
      expect(d).toBeLessThan(125);
    });

    it('returns distance to closest endpoint when projected point lies outside segment', () => {
      // Point is beyond endpoint B
      const d = distanceToSegmentMeters(3.14, 101.2, 3.14, 101.0, 3.14, 101.1);
      const endpointDist = haversineMeters(3.14, 101.2, 3.14, 101.1);
      expect(Math.abs(d - endpointDist)).toBeLessThan(5);
    });
  });

  describe('minDistanceToPolylineMeters', () => {
    it('returns 0 for empty polyline', () => {
      expect(minDistanceToPolylineMeters(3.14, 101.0, [])).toBe(0);
    });

    it('calculates distance to single-point line', () => {
      const d = minDistanceToPolylineMeters(3.14, 101.0, [[3.14, 101.1]]);
      expect(d).toBeGreaterThan(10000);
    });
  });

  describe('isVehicleOffCourse', () => {
    const routePolyline: Array<[number, number]> = [
      [3.140, 101.690],
      [3.145, 101.690],
      [3.150, 101.690],
    ];

    it('returns false when vehicle is along the route (e.g. 50m away)', () => {
      // 0.0004 deg longitude is roughly 44m
      expect(isVehicleOffCourse(3.142, 101.6904, routePolyline, 200)).toBe(false);
    });

    it('returns true when vehicle has deviated beyond threshold (>200m)', () => {
      // 0.003 deg longitude is roughly 330m away
      expect(isVehicleOffCourse(3.142, 101.6930, routePolyline, 200)).toBe(true);
    });

    it('returns false when route points are missing or empty', () => {
      expect(isVehicleOffCourse(3.142, 101.693, null)).toBe(false);
      expect(isVehicleOffCourse(3.142, 101.693, [])).toBe(false);
    });
  });
});
