export type ServiceType =
  | 'smart_selangor'
  | 'pj_city'
  | 'nadi_putra'
  | 'mrt_feeder'
  | 'rail'
  | 'rapidkl';

export interface ServiceBadgeInfo {
  type: ServiceType;
  label: string;
  badgeClass: string;
}

/**
 * Returns service classification and badge styling based on route short name,
 * route ID, or stop ID prefix.
 */
export function getServiceBadge(routeShortName?: string | null, stopId?: string | null): ServiceBadgeInfo {
  const code = (routeShortName || '').trim().toUpperCase();
  const stop = (stopId || '').trim().toUpperCase();

  // 1. Smart Selangor (Shah Alam SA*, Banting BTG*, or SA stops)
  if (
    code.startsWith('SA') ||
    code.startsWith('BTG') ||
    (stop.startsWith('SA') && !code.startsWith('T') && !code.startsWith('PJ'))
  ) {
    return {
      type: 'smart_selangor',
      label: 'Smart Selangor',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    };
  }

  // 2. PJ City Bus (Petaling Jaya PJ*, or PJ stops without specific route)
  if (code.startsWith('PJ') || (stop.startsWith('PJ') && !code)) {
    return {
      type: 'pj_city',
      label: 'PJ City Bus',
      badgeClass: 'bg-teal-500/15 border-teal-500/30 text-teal-300',
    };
  }

  // 3. Nadi Putra (Putrajaya P108, P1*, or PPJ stops)
  if (code.startsWith('P1') || code.startsWith('PPJ') || stop.startsWith('PPJ')) {
    return {
      type: 'nadi_putra',
      label: 'Nadi Putra',
      badgeClass: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
    };
  }

  // 4. MRT / LRT Feeder Bus (T-routes followed by digits e.g. T772, T413, T117)
  if (/^T\d+/i.test(code)) {
    return {
      type: 'mrt_feeder',
      label: 'MRT Feeder',
      badgeClass: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
    };
  }

  // 5. Rail / BRT Transit Lines
  if (
    [
      'AGL',
      'KJL',
      'SPL',
      'SAL',
      'KGL',
      'PYL',
      'MRL',
      'BRT',
      'AG',
      'KJ',
      'PH',
      'MR',
      'SUNWAY LINE',
    ].includes(code)
  ) {
    return {
      type: 'rail',
      label: 'Rail / BRT',
      badgeClass: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
    };
  }

  // 6. Default RapidKL City / Trunk
  return {
    type: 'rapidkl',
    label: 'RapidKL',
    badgeClass: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
  };
}
