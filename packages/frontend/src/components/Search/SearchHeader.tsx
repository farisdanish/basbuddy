import { Search, Info } from 'lucide-react';
import { HealthIndicatorBadge } from './HealthIndicatorBadge.tsx';
import type { SystemHealthStatus } from '../../hooks/useSystemHealth.ts';

interface SearchHeaderProps {
  onOpenSearch: () => void;
  onOpenInfo?: () => void;
  systemStatus: SystemHealthStatus;
}

export function SearchHeader({ onOpenSearch, onOpenInfo, systemStatus }: SearchHeaderProps) {
  return (
    <header className="absolute top-4 left-4 right-4 z-20 max-w-md mx-auto">
      <div className="w-full flex items-center justify-between gap-2 h-12 px-3.5 rounded-2xl bg-[#182337]/90 border border-white/10 shadow-2xl backdrop-blur-md transition-all">
        {/* Clickable search area */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search stops, routes, hubs"
          className="flex-1 flex items-center gap-2.5 min-w-0 text-left py-2 group"
        >
          <Search className="w-5 h-5 text-[#F4A100] shrink-0 transition-transform group-hover:scale-110" />
          <span className="text-sm font-sans text-[#FFF8EE]/60 truncate">
            Search stops, routes, hubs...
          </span>
        </button>

        {/* Right action cluster: Status Pill + Info Button */}
        <div className="flex items-center gap-2 shrink-0">
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
