import { useState } from 'react';
import { X, Navigation, Radio } from 'lucide-react';
import type { RouteDetailsResponse } from '@basbuddy/shared';

interface RouteTrackerSheetProps {
  routeData: RouteDetailsResponse | null;
  loading: boolean;
  onClose: () => void;
  onSelectStop: (stopId: string) => void;
}

export function RouteTrackerSheet({
  routeData,
  loading: _loading,
  onClose,
  onSelectStop,
}: RouteTrackerSheetProps) {
  const [activeDirectionIndex, setActiveDirectionIndex] = useState(0);

  const vehiclesCount = routeData?.vehicles?.length ?? 0;
  const directions = routeData?.directions ?? [];

  return (
    <aside
      aria-label="Route inspector"
      data-testid="route-inspector"
      className="absolute top-20 left-4 right-4 z-30 max-w-md mx-auto flex flex-col rounded-2xl bg-[#182337]/95 border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden transition-all"
    >
      {/* Route Header */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center min-w-[44px] h-9 px-2.5 rounded-xl bg-[#F4A100] text-[#101B2D] font-display text-lg font-bold shadow-md shrink-0 select-none">
            {routeData?.routeShortName || '...'}
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-sans font-bold text-[#FFF8EE] truncate">
              {routeData?.routeLongName || 'Loading route...'}
            </h2>
            <div className="flex items-center gap-2 mt-0.5 text-xs font-mono text-[#FFF8EE]/60">
              <span className="flex items-center gap-1 text-[#E94B8C]">
                <Radio className="w-3 h-3 animate-pulse" />
                {vehiclesCount} {vehiclesCount === 1 ? 'bus live' : 'buses live'}
              </span>
              {routeData?.stops && (
                <>
                  <span>•</span>
                  <span>{routeData.stops.length} stops</span>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close route inspector"
          className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-[#FFF8EE]/80 hover:text-[#FFF8EE] active:scale-95 transition-all shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Direction selector if multiple directions exist */}
      {directions.length > 1 && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.02] border-b border-white/5 overflow-x-auto no-scrollbar">
          {directions.map((dir, idx) => (
            <button
              key={`${dir.directionId}-${dir.tripHeadsign}`}
              type="button"
              onClick={() => setActiveDirectionIndex(idx)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-medium transition-all ${
                activeDirectionIndex === idx
                  ? 'bg-[#1F7A6C] text-[#FFF8EE] shadow-sm'
                  : 'bg-white/5 text-[#FFF8EE]/60 hover:bg-white/10'
              }`}
            >
              <Navigation className="w-3 h-3" />
              <span className="truncate max-w-[140px]">{dir.tripHeadsign || `Direction ${dir.directionId}`}</span>
            </button>
          ))}
        </div>
      )}

      {/* Horizontal sequence of stops along route */}
      {routeData?.stops && routeData.stops.length > 0 && (
        <div className="p-3 bg-black/20">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[#FFF8EE]/40 mb-1.5 px-1">
            Route Stops (Tap stop to view arrivals)
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {routeData.stops.map((stop, i) => (
              <button
                key={stop.stopId}
                type="button"
                onClick={() => onSelectStop(stop.stopId)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-[#1F7A6C]/30 hover:border-[#1F7A6C]/50 border border-white/10 text-left transition-all shrink-0 active:scale-95 group"
                style={{ maxWidth: 160 }}
              >
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white/10 text-[10px] font-mono text-[#F4A100] shrink-0">
                  {i + 1}
                </span>
                <span className="text-xs font-sans text-[#FFF8EE] truncate group-hover:text-[#F4A100]">
                  {stop.stopName}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
