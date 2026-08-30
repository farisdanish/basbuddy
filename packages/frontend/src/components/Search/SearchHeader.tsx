import { Search, Info, Bus } from 'lucide-react';
import { HealthIndicatorBadge } from './HealthIndicatorBadge.tsx';
import { BRAND_CONFIG } from '../../config/branding.ts';
import type { SystemHealthStatus } from '../../hooks/useSystemHealth.ts';

interface SearchHeaderProps {
  onOpenSearch: () => void;
  onOpenInfo?: () => void;
  onResetView?: () => void;
  systemStatus: SystemHealthStatus;
}

export function SearchHeader({
  onOpenSearch,
  onOpenInfo,
  onResetView,
  systemStatus,
}: SearchHeaderProps) {
  return (
    <header className="absolute top-4 left-4 right-4 z-20 pointer-events-none flex items-center justify-between gap-3 max-w-4xl mx-auto">
      {/* ── Desktop Top-Left Floating Brand Badge ────────────────────────────── */}
      <button
        type="button"
        onClick={onResetView}
        aria-label={`Reset view to ${BRAND_CONFIG.brandName} home`}
        title={`Reset view to ${BRAND_CONFIG.brandName}`}
        className="hidden md:flex pointer-events-auto items-center gap-2.5 px-3.5 h-12 rounded-2xl bg-[#182337]/90 border border-white/10 shadow-2xl backdrop-blur-md hover:border-[#F4A100]/40 active:scale-[0.98] transition-all group shrink-0"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#F4A100] text-[#101B2D] shadow-sm group-hover:scale-105 transition-transform shrink-0">
          <Bus className="w-4 h-4 text-[#101B2D]" />
        </div>
        <div className="flex flex-col text-left pr-1">
          <span className="font-display font-bold text-sm text-[#FFF8EE] leading-tight tracking-tight group-hover:text-[#F4A100] transition-colors">
            {BRAND_CONFIG.brandName}
          </span>
          <span className="text-[10px] font-mono text-[#FFF8EE]/50 flex items-center gap-1 leading-none mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Live {BRAND_CONFIG.regionName}
          </span>
        </div>
      </button>

      {/* ── Search Bar & Status Cluster ──────────────────────────────────────── */}
      <div className="pointer-events-auto flex-1 max-w-md mx-auto md:mx-0 w-full flex items-center justify-between gap-2 h-12 px-2.5 sm:px-3.5 rounded-2xl bg-[#182337]/90 border border-white/10 shadow-2xl backdrop-blur-md transition-all">
        {/* Mobile-Only Compact Brand Reset Button */}
        <button
          type="button"
          onClick={onResetView}
          aria-label={`Reset view to ${BRAND_CONFIG.brandName} home`}
          title={`Reset view to ${BRAND_CONFIG.brandName}`}
          className="flex md:hidden items-center justify-center w-8 h-8 rounded-xl bg-[#F4A100] text-[#101B2D] font-display font-bold text-xs shadow-sm active:scale-95 hover:brightness-110 transition-all shrink-0"
        >
          <Bus className="w-4 h-4 text-[#101B2D]" />
        </button>

        {/* Clickable search area */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search stops, routes, hubs"
          className="flex-1 flex items-center gap-2 min-w-0 text-left py-2 px-1 group"
        >
          <Search className="w-4 h-4 text-[#F4A100] shrink-0 transition-transform group-hover:scale-110" />
          <span className="text-xs sm:text-sm font-sans text-[#FFF8EE]/60 truncate">
            Search stops, routes, hubs...
          </span>
        </button>

        {/* Right action cluster: Status Pill + Info Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          <HealthIndicatorBadge status={systemStatus} />
          {onOpenInfo && (
            <button
              type="button"
              onClick={onOpenInfo}
              aria-label="About, FAQ and Feedback"
              title="About & FAQ"
              className="flex items-center justify-center w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-[#FFF8EE]/70 hover:text-[#F4A100] active:scale-90 transition-all"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
