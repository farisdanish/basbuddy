import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, X, Search, MapPin } from 'lucide-react';
import { useSearch, type SearchCategory } from '../../hooks/useSearch.ts';
import { getServiceBadge } from '../../utils/serviceBadges.ts';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStop: (stopId: string) => void;
  onSelectRoute: (routeId: string) => void;
}

export function SearchOverlay({
  isOpen,
  onClose,
  onSelectStop,
  onSelectRoute,
}: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const { stops, routes, loading } = useSearch(query, category);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setCategory('all');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#101B2D]/95 backdrop-blur-xl animate-in fade-in duration-200">
      {/* Top Search Bar */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to map"
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10 text-[#FFF8EE] active:scale-95 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F4A100]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stops, routes..."
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-[#182337] text-[#FFF8EE] placeholder:text-[#FFF8EE]/40 text-sm font-sans border border-white/10 focus:outline-none focus:border-[#F4A100] transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search query"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#FFF8EE]/60 hover:text-[#FFF8EE]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Category Chips */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 overflow-x-auto no-scrollbar">
        {(['all', 'stops', 'routes'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-sans font-medium transition-all ${
              category === cat
                ? 'bg-[#F4A100] text-[#101B2D] shadow-md'
                : 'bg-[#182337] text-[#FFF8EE]/70 hover:bg-[#182337]/80'
            }`}
          >
            {cat === 'all' && 'All'}
            {cat === 'stops' && '🚏 Stops'}
            {cat === 'routes' && '🚌 Routes'}
          </button>
        ))}
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-12 text-[#FFF8EE]/40 text-sm">
            Searching transit network...
          </div>
        )}

        {!loading && stops.length === 0 && routes.length === 0 && (
          <div className="text-center py-12 text-[#FFF8EE]/40 text-sm">
            {query ? 'No matching stops or routes found.' : 'Type a stop name or route number to begin.'}
          </div>
        )}

        {/* Stops Section */}
        {stops.length > 0 && (
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#FFF8EE]/50 mb-2">
              Bus Stops ({stops.length})
            </h3>
            <div className="space-y-1.5">
              {stops.map((stop) => (
                <button
                  key={stop.stopId}
                  type="button"
                  onClick={() => {
                    onSelectStop(stop.stopId);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3.5 p-3 rounded-xl bg-[#182337]/60 hover:bg-[#182337] active:scale-[0.99] border border-white/5 text-left transition-all group"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1F7A6C]/30 border border-[#1F7A6C]/40 text-[#1F7A6C] shrink-0 group-hover:scale-105 transition-transform">
                    <MapPin className="w-4 h-4 text-[#1F7A6C]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-sans font-medium text-[#FFF8EE] truncate">
                      {stop.stopName}
                    </div>
                    <div className="text-xs font-mono text-[#FFF8EE]/40">
                      Stop {stop.stopId}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Routes Section */}
        {routes.length > 0 && (
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#FFF8EE]/50 mb-2">
              Routes ({routes.length})
            </h3>
            <div className="space-y-1.5">
              {routes.map((route) => {
                const badge = getServiceBadge(route.routeShortName);
                const hasLiveVehicles = route.liveBusCount !== undefined && route.liveBusCount > 0;
                return (
                  <button
                    key={route.routeId}
                    data-testid={`search-route-${route.routeId}`}
                    type="button"
                    onClick={() => {
                      onSelectRoute(route.routeId);
                      onClose();
                    }}
                    className="w-full flex items-center gap-3.5 p-3 rounded-xl bg-[#182337]/60 hover:bg-[#182337] active:scale-[0.99] border border-white/5 text-left transition-all group"
                  >
                    <div className="flex items-center justify-center px-2.5 h-8 rounded-lg bg-[#F4A100] text-[#101B2D] font-display font-bold text-sm shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      {route.routeShortName}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-sans font-medium text-[#FFF8EE] truncate">
                          {route.routeLongName}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${badge.badgeClass}`}
                          >
                            {badge.label}
                          </span>
                          {hasLiveVehicles ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0 shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>{route.liveBusCount} live</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-[#FFF8EE]/40 border border-white/10 shrink-0">
                              Schedule
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs font-mono text-[#FFF8EE]/40 mt-0.5 flex items-center gap-1.5">
                        <span>Route ID: {route.routeId}</span>
                        <span>•</span>
                        <span>
                          {hasLiveVehicles
                            ? `${route.liveBusCount} ${route.liveBusCount === 1 ? 'bus' : 'buses'} tracking now`
                            : 'Timetable only'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
