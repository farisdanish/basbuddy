import type { SystemHealthStatus } from '../../hooks/useSystemHealth.ts';

interface HealthIndicatorBadgeProps {
  status: SystemHealthStatus;
  ageSeconds?: number | null;
  onClick?: () => void;
}

export function HealthIndicatorBadge({ status, ageSeconds, onClick }: HealthIndicatorBadgeProps) {
  const baseTooltip = ageSeconds !== null && ageSeconds !== undefined
    ? `Feed updated ${ageSeconds}s ago (30s cycle)`
    : undefined;

  const tooltip = onClick
    ? `${baseTooltip ? baseTooltip + ' · ' : ''}Click to view data.gov.my & system status`
    : baseTooltip;

  const clickableClasses = onClick
    ? 'cursor-pointer hover:brightness-125 active:scale-95 transition-all focus:outline-none focus:ring-1 focus:ring-white/20'
    : '';

  if (status === 'live') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        title={tooltip}
        aria-label={tooltip ?? 'Feed status: Live'}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-medium select-none ${clickableClasses}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span>Live</span>
        {ageSeconds !== null && ageSeconds !== undefined && (
          <span className="text-[10px] opacity-70 hidden sm:inline">{ageSeconds}s</span>
        )}
      </button>
    );
  }

  if (status === 'stale') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        title={tooltip}
        aria-label={tooltip ?? 'Feed status: Delayed'}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-mono font-medium select-none ${clickableClasses}`}
      >
        <span className="inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        <span>Delay</span>
        {ageSeconds !== null && ageSeconds !== undefined && (
          <span className="text-[10px] opacity-70 hidden sm:inline">{ageSeconds}s</span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={tooltip}
      aria-label={tooltip ?? 'Feed status: Offline'}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-mono font-medium select-none ${clickableClasses}`}
    >
      <span className="inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
      <span>Offline</span>
    </button>
  );
}
