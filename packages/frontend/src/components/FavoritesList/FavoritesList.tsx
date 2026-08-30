import { Star, Bus, MapPin, SlidersHorizontal } from 'lucide-react';
import { useFavorites } from '../../hooks/useFavorites.ts';

interface FavoritesListProps {
  selectedStopId?: string | null;
  selectedRouteId?: string | null;
  onSelectStop?: (stopId: string) => void;
  onSelectRoute?: (routeId: string) => void;
  onOpenModal?: () => void;
}

export function FavoritesList({
  selectedStopId,
  selectedRouteId,
  onSelectStop,
  onSelectRoute,
  onOpenModal,
}: FavoritesListProps) {
  const { favorites, loading } = useFavorites();

  if (loading || favorites.length === 0) return null;

  return (
    <nav
      aria-label="Favorite transit items"
      className="px-4 py-3 overflow-x-auto flex items-center gap-2.5 no-scrollbar select-none"
      style={{
        background: 'linear-gradient(to top, rgba(16, 27, 45, 0.95) 75%, transparent)',
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <button
        type="button"
        id="favorites-manage-button"
        onClick={onOpenModal}
        aria-label={`Saved favorites (${favorites.length})`}
        title="Manage saved favorites"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#F4A100]/15 hover:bg-[#F4A100]/25 text-[#F4A100] border border-[#F4A100]/30 text-[11px] font-mono font-semibold uppercase tracking-wider shrink-0 active:scale-95 transition-all"
      >
        <Star className="w-3.5 h-3.5 fill-[#F4A100]" />
        <span>Saved ({favorites.length})</span>
        <SlidersHorizontal className="w-3 h-3 text-[#F4A100]/70 ml-0.5" />
      </button>

      {favorites.map((fav) => {
        const isRouteFav = Boolean(fav.routeId && !fav.stopId);
        const isSelected = isRouteFav
          ? selectedRouteId === fav.routeId
          : selectedStopId === fav.stopId;

        const handleClick = () => {
          if (isRouteFav && fav.routeId) {
            onSelectRoute?.(fav.routeId);
          } else if (fav.stopId) {
            onSelectStop?.(fav.stopId);
          }
        };

        return (
          <button
            key={fav.id}
            id={`favorite-${fav.id}`}
            type="button"
            onClick={handleClick}
            className={`flex-none flex items-center gap-2.5 px-3 py-2 rounded-2xl transition-all duration-150 active:scale-95 text-left border ${
              isSelected
                ? 'bg-[#F4A100]/15 border-[#F4A100] ring-2 ring-[#F4A100]/30 shadow-lg shadow-[#F4A100]/10'
                : 'bg-[#182337]/90 hover:bg-[#182337] border-white/10 hover:border-white/20 shadow-md'
            }`}
            style={{ minWidth: 120, maxWidth: 190 }}
          >
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-xl shrink-0 ${
                isRouteFav
                  ? 'bg-[#F4A100]/20 text-[#F4A100] border border-[#F4A100]/30'
                  : 'bg-[#1F7A6C]/20 text-[#1F7A6C] border border-[#1F7A6C]/30'
              }`}
            >
              {isRouteFav ? <Bus className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
            </div>

            <div className="min-w-0 flex-1">
              <span
                className="font-display text-sm font-bold leading-tight truncate block"
                style={{ color: isSelected ? '#FFF8EE' : isRouteFav ? '#F4A100' : '#FFF8EE' }}
              >
                {fav.label ?? (isRouteFav ? `Route ${fav.routeId}` : `Stop ${fav.stopId}`)}
              </span>
              <span className="text-[10px] font-mono text-[#FFF8EE]/40 truncate block mt-0.5">
                {isRouteFav
                  ? `Route ID: ${fav.routeId}`
                  : fav.routeId
                    ? `Route ${fav.routeId}`
                    : `ID: ${fav.stopId}`}
              </span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
