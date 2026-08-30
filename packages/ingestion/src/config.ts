export interface FeedConfig {
  id: string;
  name: string;
  url: string;
  agencyId: string;
}

export const KNOWN_FEEDS: Record<string, FeedConfig> = {
  'rapid-bus-kl': {
    id: 'rapid-bus-kl',
    name: 'RapidKL Bus',
    url:
      process.env.GTFS_STATIC_RAPID_BUS_KL_URL ??
      'https://api.data.gov.my/gtfs-static/prasarana?category=rapid-bus-kl',
    agencyId: 'rapid-bus-kl',
  },
  'rapid-bus-mrtfeeder': {
    id: 'rapid-bus-mrtfeeder',
    name: 'MRT Feeder Bus',
    url:
      process.env.GTFS_STATIC_MRT_FEEDER_URL ??
      'https://api.data.gov.my/gtfs-static/prasarana?category=rapid-bus-mrtfeeder',
    agencyId: 'rapid-bus-mrtfeeder',
  },
  'rapid-rail-kl': {
    id: 'rapid-rail-kl',
    name: 'Rapid Rail KL (LRT / MRT / Monorail)',
    url:
      process.env.GTFS_STATIC_RAPID_RAIL_KL_URL ??
      'https://api.data.gov.my/gtfs-static/prasarana?category=rapid-rail-kl',
    agencyId: 'rapid-rail-kl',
  },
};

export function getFeedsToIngest(cliArg?: string): FeedConfig[] {
  // Check CLI argument e.g. --feed=rapid-bus-mrtfeeder or --feed=all
  const feedFlag = cliArg || process.env.FEED_ID;
  if (feedFlag) {
    const clean = feedFlag.replace(/^--feed=/, '').trim();
    if (clean === 'all') {
      return Object.values(KNOWN_FEEDS);
    }
    const found = KNOWN_FEEDS[clean];
    if (found) {
      return [found];
    }
    console.warn(`[config] Unknown feed "${clean}", falling back to all feeds.`);
  }

  // Default: if GTFS_STATIC_URL is explicitly set to a custom URL, run rapid-bus-kl with that URL
  if (process.env.GTFS_STATIC_URL) {
    return [
      {
        id: 'rapid-bus-kl',
        name: 'Custom Static Feed',
        url: process.env.GTFS_STATIC_URL,
        agencyId: 'rapid-bus-kl',
      },
    ];
  }

  // Default: ingest all known feeds
  return Object.values(KNOWN_FEEDS);
}
