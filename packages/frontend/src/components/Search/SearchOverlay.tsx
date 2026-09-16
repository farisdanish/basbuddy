import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, X, Search, MapPin, RefreshCw, Compass, ArrowRight } from 'lucide-react';
import { useSearch, type SearchCategory, type SearchMapViewport } from '../../hooks/useSearch.ts';
import { getServiceBadge } from '../../utils/serviceBadges.ts';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStop: (stopId: string) => void;
  onSelectRoute: (routeId: string) => void;
  userLocation?: { lat: number; lon: number } | [number, number] | null;
  mapViewport?: SearchMapViewport | null;
}

function formatDistance(meters?: number | null): string | null {
  if (meters === undefined || meters === null || isNaN(meters)) return null;
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function SearchOverlay({
  isOpen,
  onClose,
  onSelectStop,
  onSelectRoute,
  userLocation,
  mapViewport,
}: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    stops,
    routes,
    loading,
    isNearby,
    searchAnchor,
    isMapDiverged,
    divergenceDistance,
    activeRadiusMeters,
    refreshMapArea,
    resetToGps,
  } = useSearch(query, category, userLocation, mapViewport);

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
    <div
      data-testid="search-overlay"
      className="fixed inset-0 z-50 flex flex-col bg-[#101B2D]/95 backdrop-blur-xl animate-in fade-in duration-200"
    >
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
        {/* Divergence banner: suggest searching map area when panned away from GPS */}
        {!query && isMapDiverged && searchAnchor === 'gps' && (
          <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-[#F4A100]/10 border border-[#F4A100]/25 text-xs text-[#FFF8EE]">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-[#F4A100] shrink-0" />
              <span className="truncate">
                {divergenceDistance !== null
                  ? `Map panned ${formatDistance(divergenceDistance)} away · search this area?`
                  : 'Search routes in current map view?'}
              </span>
            </div>
            <button
              type="button"
              data-testid="search-divergence-prompt-btn"
              onClick={refreshMapArea}
              className="text-[#F4A100] font-medium hover:underline text-[11px] whitespace-nowrap ml-2 shrink-0 flex items-center gap-1 active:scale-95 transition-all"
            >
              <span>Search Map Area</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12 text-[#FFF8EE]/40 text-sm">
            Searching transit network...
          </div>
        )}

        {!loading && stops.length === 0 && routes.length === 0 && (
          <div className="text-center py-12 text-[#FFF8EE]/40 text-sm space-y-3">
            <p>{query ? 'No matching stops or routes found.' : 'Type a stop name or route number to begin.'}</p>
            {!query && mapViewport && (
              <button
                type="button"
                data-testid="search-refresh-map-btn"
                onClick={refreshMapArea}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4A100]/10 border border-[#F4A100]/30 text-[#F4A100] text-xs font-mono hover:bg-[#F4A100]/20 active:scale-95 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Search Current Map View</span>
              </button>
            )}
          </div>
        )}

        {/* Routes Section (shown first when proximity routes are available) */}
        {routes.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-mono uppercase tracking-wider text-[#FFF8EE]/60 flex items-center gap-1.5">
                <span>
                  {!query
                    ? searchAnchor === 'map'
                      ? `🗺️ Routes in Map View (${formatDistance(activeRadiusMeters)})`
                      : isNearby
                      ? '📍 Routes Near You (Within 25 km)'
                      : '🚌 Popular & Active Routes'
                    : `Routes (${routes.length})`}
                </span>
              </h3>
              {!query && (
                <div className="flex items-center gap-1.5">
                  {searchAnchor === 'map' && userLocation && (
                    <button
                      type="button"
                      data-testid="search-reset-gps-btn"
                      onClick={resetToGps}
                      className="text-[10px] font-mono text-[#FFF8EE]/70 hover:text-[#FFF8EE] flex items-center gap-1 px-2 py-0.5 rounded border border-white/10 hover:border-white/20 active:scale-95 transition-all"
                      title="Switch search back to your GPS location"
                    >
                      <Compass className="w-3 h-3 text-emerald-400" />
                      <span>My GPS</span>
                    </button>
                  )}
                  <button
                    type="button"
                    data-testid="search-refresh-map-btn"
                    onClick={refreshMapArea}
                    aria-label="Refresh routes for current map area"
                    className="flex items-center gap-1 text-[11px] font-mono text-[#F4A100] hover:text-[#ffb733] bg-[#F4A100]/10 hover:bg-[#F4A100]/20 px-2 py-0.5 rounded border border-[#F4A100]/25 active:scale-95 transition-all shadow-sm"
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    <span>{searchAnchor === 'map' ? 'Refresh Map' : 'Search Map Area'}</span>
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              {routes.map((route) => {
                const badge = getServiceBadge(route.routeShortName);
                const hasLiveVehicles = route.liveBusCount !== undefined && route.liveBusCount > 0;
                const distanceStr = formatDistance(route.distanceMeters);
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
                          {distanceStr && (
                            <span
                              title={searchAnchor === 'map' ? 'Distance from map center' : 'Distance from you'}
                              className="inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1F7A6C]/20 text-[#2dd4bf] border border-[#1F7A6C]/40 shrink-0 font-medium"
                            >
                              <MapPin className="w-2.5 h-2.5" />
                              <span>{distanceStr}</span>
                            </span>
                          )}
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

        {/* Empty state for map area with zero routes */}
        {!loading && searchAnchor === 'map' && routes.length === 0 && !query && (
          <div className="p-4 rounded-xl bg-[#182337]/50 border border-white/5 text-center text-xs text-[#FFF8EE]/60 space-y-2">
            <p>No transit routes found in this immediate map area (~{formatDistance(activeRadiusMeters)}).</p>
            <p className="text-[11px] text-[#FFF8EE]/40">Try zooming out or panning to an active transit corridor.</p>
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                data-testid="search-refresh-map-btn"
                onClick={refreshMapArea}
                className="inline-flex items-center gap-1 text-xs text-[#F4A100] hover:underline"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Map Search</span>
              </button>
              {userLocation && (
                <button
                  type="button"
                  onClick={resetToGps}
                  className="inline-flex items-center gap-1 text-xs text-[#FFF8EE]/60 hover:text-[#FFF8EE]"
                >
                  <Compass className="w-3 h-3 text-emerald-400" />
                  <span>Back to my GPS location</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stops Section */}
        {stops.length > 0 && (
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#FFF8EE]/50 mb-2">
              {!query
                ? searchAnchor === 'map'
                  ? '🚏 Bus Stops in Map View'
                  : isNearby
                  ? '🚏 Bus Stops Near You'
                  : 'Bus Stops'
                : `Bus Stops (${stops.length})`}
            </h3>
            <div className="space-y-1.5">
              {stops.map((stop) => {
                const distanceStr = formatDistance(stop.distanceMeters);
                return (
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
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-sans font-medium text-[#FFF8EE] truncate">
                          {stop.stopName}
                        </div>
                        {distanceStr && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1F7A6C]/20 text-[#2dd4bf] border border-[#1F7A6C]/40 shrink-0 font-medium">
                            {distanceStr} away
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono text-[#FFF8EE]/40">
                        Stop {stop.stopId}
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
