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
    <header className="absolute top-4 left-4 right-4 z-20 max-w-md mx-auto flex items-center gap-2">
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Search stops, routes, hubs"
        className="flex-1 flex items-center justify-between gap-3 h-12 px-4 rounded-2xl bg-[#182337]/90 hover:bg-[#182337] active:scale-[0.99] border border-white/10 text-left shadow-2xl backdrop-blur-md transition-all duration-150 group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Search className="w-5 h-5 text-[#F4A100] shrink-0 transition-transform group-hover:scale-110" />
          <span className="text-sm font-sans text-[#FFF8EE]/60 truncate">
            Search stops, routes, hubs...
          </span>
        </div>

        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <HealthIndicatorBadge status={systemStatus} />
        </div>
      </button>

      {onOpenInfo && (
        <button
          type="button"
          onClick={onOpenInfo}
          aria-label="About, FAQ and Feedback"
          title="About & FAQ"
          className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#182337]/90 hover:bg-[#182337] active:scale-95 border border-white/10 text-[#FFF8EE]/70 hover:text-[#F4A100] shadow-2xl backdrop-blur-md transition-all shrink-0"
        >
          <Info className="w-5 h-5" />
        </button>
      )}
    </header>
  );
}
