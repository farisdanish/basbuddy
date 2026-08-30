export interface TransitHub {
  id: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  modes: ('bus' | 'mrt' | 'lrt' | 'monorail' | 'ktm')[];
  description: string;
}

export const KLANG_VALLEY_HUBS: TransitHub[] = [
  {
    id: 'kl-sentral',
    name: 'KL Sentral',
    city: 'Kuala Lumpur',
    lat: 3.1342,
    lon: 101.6861,
    modes: ['bus', 'lrt', 'mrt', 'monorail', 'ktm'],
    description: 'Premier transit hub connecting all rail lines, express buses, and airport links.',
  },
  {
    id: 'pasar-seni',
    name: 'Pasar Seni',
    city: 'Kuala Lumpur',
    lat: 3.1428,
    lon: 101.6953,
    modes: ['bus', 'lrt', 'mrt'],
    description: 'City center bus terminal & interchange for Kelana Jaya LRT and Kajang MRT.',
  },
  {
    id: 'bandar-utama',
    name: '1 Utama / Bandar Utama',
    city: 'Petaling Jaya',
    lat: 3.1499,
    lon: 101.6154,
    modes: ['bus', 'mrt'],
    description: 'Major Petaling Jaya retail & residential interchange connecting Kajang MRT.',
  },
  {
    id: 'shah-alam-seksyen-14',
    name: 'Shah Alam Seksyen 14',
    city: 'Shah Alam',
    lat: 3.0726,
    lon: 101.5183,
    modes: ['bus'],
    description: 'Central hub for RapidKL trunk buses and Smart Selangor municipal network.',
  },
  {
    id: 'subang-ss15',
    name: 'SS15 Subang Jaya',
    city: 'Subang Jaya',
    lat: 3.0763,
    lon: 101.5898,
    modes: ['bus', 'lrt'],
    description: 'High-density commercial hub connecting Kelana Jaya LRT and local feeders.',
  },
  {
    id: 'putrajaya-sentral',
    name: 'Putrajaya Sentral',
    city: 'Putrajaya',
    lat: 2.9304,
    lon: 101.6698,
    modes: ['bus', 'mrt', 'ktm'],
    description: 'Southern gateway connecting Putrajaya MRT line, KLIA Transit, and intercity buses.',
  },
  {
    id: 'kajang-sentral',
    name: 'Kajang Sentral',
    city: 'Kajang',
    lat: 2.9831,
    lon: 101.7909,
    modes: ['bus', 'mrt', 'ktm'],
    description: 'Southeastern transit terminal linking Kajang MRT Line and KTM Seremban.',
  },
  {
    id: 'gombak-lrt',
    name: 'Gombak LRT Terminal',
    city: 'Gombak / Hulu Kelang',
    lat: 3.2312,
    lon: 101.7247,
    modes: ['bus', 'lrt'],
    description: 'Northern Kelana Jaya LRT terminus with connections to Genting and East Coast express coaches.',
  },
];

export interface AgencyFilterOption {
  id: string;
  name: string;
  feedId?: string;
  badgeColor: string;
  badgeBg: string;
}

export const AGENCY_OPTIONS: AgencyFilterOption[] = [
  { id: 'all', name: 'All Services', badgeColor: 'text-[#FFF8EE]', badgeBg: 'bg-white/10' },
  { id: 'rapid-bus-kl', name: 'RapidKL Bus', feedId: 'rapid-bus-kl', badgeColor: 'text-emerald-400', badgeBg: 'bg-emerald-500/10' },
  { id: 'rapid-bus-mrtfeeder', name: 'MRT Feeder', feedId: 'rapid-bus-mrtfeeder', badgeColor: 'text-teal-400', badgeBg: 'bg-teal-500/10' },
  { id: 'rapid-rail-kl', name: 'Rapid Rail', feedId: 'rapid-rail-kl', badgeColor: 'text-amber-400', badgeBg: 'bg-amber-500/10' },
  { id: 'smart-selangor', name: 'Smart Selangor', feedId: 'smart-selangor', badgeColor: 'text-rose-400', badgeBg: 'bg-rose-500/10' },
];

export function filterHubsByQuery(hubs: TransitHub[], query: string): TransitHub[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return hubs;
  return hubs.filter(
    (hub) =>
      hub.name.toLowerCase().includes(trimmed) ||
      hub.city.toLowerCase().includes(trimmed) ||
      hub.description.toLowerCase().includes(trimmed),
  );
}
