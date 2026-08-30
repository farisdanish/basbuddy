import { describe, it, expect } from 'vitest';
import { KLANG_VALLEY_HUBS, AGENCY_OPTIONS, filterHubsByQuery } from '../transitHubs.ts';

describe('transitHubs', () => {
  it('contains essential Klang Valley transit hubs', () => {
    expect(KLANG_VALLEY_HUBS.length).toBeGreaterThanOrEqual(8);
    const hubIds = KLANG_VALLEY_HUBS.map((h) => h.id);
    expect(hubIds).toContain('kl-sentral');
    expect(hubIds).toContain('pasar-seni');
    expect(hubIds).toContain('bandar-utama');
    expect(hubIds).toContain('shah-alam-seksyen-14');
  });

  it('defines valid agency filter options', () => {
    const agencyIds = AGENCY_OPTIONS.map((a) => a.id);
    expect(agencyIds).toContain('all');
    expect(agencyIds).toContain('rapid-bus-kl');
    expect(agencyIds).toContain('rapid-bus-mrtfeeder');
    expect(agencyIds).toContain('rapid-rail-kl');
  });

  it('filters transit hubs by name, city, or description query', () => {
    expect(filterHubsByQuery(KLANG_VALLEY_HUBS, '')).toEqual(KLANG_VALLEY_HUBS);

    const sentralHubs = filterHubsByQuery(KLANG_VALLEY_HUBS, 'sentral');
    expect(sentralHubs.length).toBeGreaterThanOrEqual(3);

    const pjHubs = filterHubsByQuery(KLANG_VALLEY_HUBS, 'Petaling Jaya');
    expect(pjHubs).toHaveLength(1);
    expect(pjHubs[0]?.id).toBe('bandar-utama');

    const noMatches = filterHubsByQuery(KLANG_VALLEY_HUBS, 'NonExistentCityXYZ');
    expect(noMatches).toEqual([]);
  });
});
