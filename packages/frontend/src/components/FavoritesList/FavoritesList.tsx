import { Star, Bus, MapPin } from 'lucide-react';
import { useFavorites } from '../../hooks/useFavorites.ts';

interface FavoritesListProps {
  selectedStopId?: string | null;
  selectedRouteId?: string | null;
  onSelectStop?: (stopId: string) => void;
  onSelectRoute?: (routeId: string) => void;
}

export function FavoritesList({
  selectedStopId,
  selectedRouteId,
  onSelectStop,
  onSelectRoute,
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
      <div className="flex items-center gap-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-[#F4A100] px-1 shrink-0">
        <Star className="w-3 h-3 fill-[#F4A100]" />
        <span>Saved</span>
      </div>

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
                {isRouteFav ? `Route ID: ${fav.routeId}` : `Stop ID: ${fav.stopId}`}
              </span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
