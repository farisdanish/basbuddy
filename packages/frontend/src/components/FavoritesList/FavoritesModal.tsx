import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search, Star, Bus, MapPin, Trash2, ArrowRight } from 'lucide-react';
import { useFavorites } from '../../hooks/useFavorites.ts';
import { getServiceBadge } from '../../utils/serviceBadges.ts';
import {
  filterFavorites,
  isRouteFavorite,
  type FavoriteCategory,
} from '../../utils/favoritesFilter.ts';

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStop?: (stopId: string) => void;
  onSelectRoute?: (routeId: string) => void;
  selectedStopId?: string | null;
  selectedRouteId?: string | null;
}

export function FavoritesModal({
  isOpen,
  onClose,
  onSelectStop,
  onSelectRoute,
  selectedStopId,
  selectedRouteId,
}: FavoritesModalProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FavoriteCategory>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const { favorites, removeFavorite } = useFavorites();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setCategory('all');
    }
  }, [isOpen]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const { items: filteredFavorites, counts } = useMemo(() => {
    return filterFavorites(favorites, query, category);
  }, [favorites, query, category]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="favorites-modal-title"
      data-testid="favorites-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#182337]/95 border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden text-[#FFF8EE] animate-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#101B2D]/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#F4A100]/20 border border-[#F4A100]/40 text-[#F4A100]">
              <Star className="w-4 h-4 fill-[#F4A100]" />
            </div>
            <div>
              <h2 id="favorites-modal-title" className="text-base font-display font-bold text-[#FFF8EE] flex items-center gap-2">
                <span>Saved Favorites</span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-mono font-medium text-[#F4A100]">
                  {favorites.length}
                </span>
              </h2>
              <p className="text-[11px] font-sans text-[#FFF8EE]/60">
                Quick access to your pinned routes and stops
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close favorites modal"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-[#FFF8EE]/70 hover:text-[#FFF8EE] active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Search Input */}
        {favorites.length > 0 && (
          <div className="p-3.5 border-b border-white/10 bg-[#101B2D]/40 shrink-0">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F4A100]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search saved routes or stops..."
                className="w-full h-10 pl-10 pr-9 rounded-xl bg-[#101B2D] text-[#FFF8EE] placeholder:text-[#FFF8EE]/40 text-xs sm:text-sm font-sans border border-white/10 focus:outline-none focus:border-[#F4A100] transition-colors"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search query"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#FFF8EE]/60 hover:text-[#FFF8EE]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Categorized Filter Tabs */}
            <div className="flex items-center gap-1.5 mt-2.5">
              {(
                [
                  { id: 'all', label: 'All', count: counts.all },
                  { id: 'routes', label: 'Routes', count: counts.routes },
                  { id: 'stops', label: 'Stops', count: counts.stops },
                ] as const
              ).map((tab) => {
                const isSelected = category === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategory(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-sans font-medium transition-all ${
                      isSelected
                        ? 'bg-[#F4A100] text-[#101B2D] font-bold shadow-sm'
                        : 'bg-white/5 text-[#FFF8EE]/70 hover:bg-white/10 hover:text-[#FFF8EE]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-[#101B2D]/20 text-[#101B2D]'
                          : 'bg-white/10 text-[#FFF8EE]/60'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 basbuddy-scroll min-h-[200px]">
          {favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-3xl bg-white/5 border border-white/10 text-[#F4A100] mb-3">
                <Star className="w-7 h-7" />
              </div>
              <h3 className="text-base font-display font-bold text-[#FFF8EE]">
                No Saved Favorites Yet
              </h3>
              <p className="text-xs font-sans text-[#FFF8EE]/60 max-w-xs mt-1 leading-relaxed">
                Tap the star icon on any bus route or stop arrival sheet to pin it here for instant 1-tap access.
              </p>
            </div>
          ) : filteredFavorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <p className="text-sm font-sans font-semibold text-[#FFF8EE]">
                No matching favorites found
              </p>
              <p className="text-xs font-sans text-[#FFF8EE]/50 mt-1 mb-3">
                Try adjusting your search query or switching category filter tabs.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategory('all');
                }}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#FFF8EE] text-xs font-sans font-medium transition-all"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            filteredFavorites.map((fav) => {
              const isRoute = isRouteFavorite(fav);
              const badge = isRoute ? getServiceBadge(fav.routeId) : null;
              const isSelected = isRoute
                ? selectedRouteId === fav.routeId
                : selectedStopId === fav.stopId;

              const handleCardClick = () => {
                if (isRoute && fav.routeId) {
                  onSelectRoute?.(fav.routeId);
                  onClose();
                } else if (fav.stopId) {
                  onSelectStop?.(fav.stopId);
                  onClose();
                }
              };

              const handleRemove = async (e: React.MouseEvent) => {
                e.stopPropagation();
                await removeFavorite(fav.id);
              };

              return (
                <div
                  key={fav.id}
                  data-testid={`favorite-modal-item-${fav.id}`}
                  onClick={handleCardClick}
                  className={`group relative flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] ${
                    isSelected
                      ? 'bg-[#F4A100]/15 border-[#F4A100] ring-1 ring-[#F4A100]/40'
                      : 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Icon glyph */}
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
                        isRoute
                          ? 'bg-[#F4A100]/20 text-[#F4A100] border border-[#F4A100]/30'
                          : 'bg-[#1F7A6C]/20 text-[#1F7A6C] border border-[#1F7A6C]/30'
                      }`}
                    >
                      {isRoute ? <Bus className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                    </div>

                    {/* Metadata text */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans font-bold text-sm text-[#FFF8EE] group-hover:text-[#F4A100] transition-colors truncate">
                          {fav.label || (isRoute ? `Route ${fav.routeId}` : `Stop ${fav.stopId}`)}
                        </span>
                        {badge && (
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border shrink-0 ${badge.badgeClass}`}>
                            {badge.label}
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-mono text-[#FFF8EE]/50 mt-0.5 flex items-center gap-2">
                        <span>
                          {isRoute
                            ? `Route ID: ${fav.routeId}`
                            : `Stop ID: ${fav.stopId}`}
                        </span>
                        {fav.createdAt && (
                          <>
                            <span>•</span>
                            <span className="text-[10px] text-[#FFF8EE]/40">
                              Saved {new Date(fav.createdAt).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions cluster */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleRemove}
                      title="Remove from favorites"
                      aria-label="Remove favorite"
                      className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 hover:bg-rose-500/20 text-[#FFF8EE]/60 hover:text-rose-300 border border-transparent hover:border-rose-500/30 active:scale-90 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/5 text-[#FFF8EE]/40 group-hover:text-[#F4A100] group-hover:translate-x-0.5 transition-all">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info note */}
        <div className="p-3 border-t border-white/5 bg-[#101B2D]/90 text-[10px] font-sans text-[#FFF8EE]/50 flex items-center justify-between shrink-0">
          <span>Favorites are saved locally on this device.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#FFF8EE] font-medium transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
