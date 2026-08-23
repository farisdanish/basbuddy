import { describe, it, expect } from 'vitest';
import { getServiceBadge } from '../serviceBadges.ts';

describe('serviceBadges utility', () => {
  it('correctly classifies Smart Selangor routes and stops', () => {
    expect(getServiceBadge('SA02').type).toBe('smart_selangor');
    expect(getServiceBadge('SA05').label).toBe('Smart Selangor');
    expect(getServiceBadge('BTG1').type).toBe('smart_selangor');
    expect(getServiceBadge('BTG2').label).toBe('Smart Selangor');
    expect(getServiceBadge(null, 'SA786').type).toBe('smart_selangor');
  });

  it('correctly classifies PJ City bus routes', () => {
    expect(getServiceBadge('PJ01').type).toBe('pj_city');
    expect(getServiceBadge('PJ06').label).toBe('PJ City Bus');
    expect(getServiceBadge(null, 'PJ445').type).toBe('pj_city');
  });

  it('correctly classifies Nadi Putra Putrajaya routes', () => {
    expect(getServiceBadge('P108').type).toBe('nadi_putra');
    expect(getServiceBadge('P108').label).toBe('Nadi Putra');
    expect(getServiceBadge(null, 'PPJ12').type).toBe('nadi_putra');
  });

  it('correctly classifies MRT Feeder bus routes', () => {
    expect(getServiceBadge('T772').type).toBe('mrt_feeder');
    expect(getServiceBadge('T413').label).toBe('MRT Feeder');
    expect(getServiceBadge('T117').type).toBe('mrt_feeder');
  });

  it('correctly classifies Rail and BRT lines', () => {
    expect(getServiceBadge('KJL').type).toBe('rail');
    expect(getServiceBadge('AGL').label).toBe('Rail / BRT');
    expect(getServiceBadge('PYL').type).toBe('rail');
    expect(getServiceBadge('BRT').type).toBe('rail');
  });

  it('defaults standard numeric bus routes to RapidKL', () => {
    expect(getServiceBadge('750').type).toBe('rapidkl');
    expect(getServiceBadge('750').label).toBe('RapidKL');
    expect(getServiceBadge('300').type).toBe('rapidkl');
    expect(getServiceBadge('450').type).toBe('rapidkl');
  });
});
