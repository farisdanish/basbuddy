import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getFeedsToIngest, KNOWN_FEEDS } from '../config.ts';

describe('GTFS Multi-Feed Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.FEED_ID;
    delete process.env.GTFS_STATIC_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns all known feeds when no flag or env var is provided', () => {
    const feeds = getFeedsToIngest();
    expect(feeds.length).toBe(Object.keys(KNOWN_FEEDS).length);
    expect(feeds.map((f) => f.id)).toEqual([
      'rapid-bus-kl',
      'rapid-bus-mrtfeeder',
      'rapid-rail-kl',
    ]);
  });

  it('filters to specific feed when --feed CLI arg is passed', () => {
    const feeds = getFeedsToIngest('--feed=rapid-bus-mrtfeeder');
    expect(feeds.length).toBe(1);
    expect(feeds[0]?.id).toBe('rapid-bus-mrtfeeder');
    expect(feeds[0]?.name).toBe('MRT Feeder Bus');
  });

  it('returns all feeds when --feed=all is passed', () => {
    const feeds = getFeedsToIngest('--feed=all');
    expect(feeds.length).toBe(3);
  });

  it('filters to specific feed when FEED_ID env var is set', () => {
    process.env.FEED_ID = 'rapid-rail-kl';
    const feeds = getFeedsToIngest();
    expect(feeds.length).toBe(1);
    expect(feeds[0]?.id).toBe('rapid-rail-kl');
  });

  it('handles custom GTFS_STATIC_URL environment variable', () => {
    process.env.GTFS_STATIC_URL = 'https://custom-domain.com/gtfs.zip';
    const feeds = getFeedsToIngest();
    expect(feeds.length).toBe(1);
    expect(feeds[0]?.url).toBe('https://custom-domain.com/gtfs.zip');
  });
});
