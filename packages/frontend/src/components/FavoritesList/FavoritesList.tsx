import { Star } from 'lucide-react';
import { useFavorites } from '../../hooks/useFavorites.ts';

interface FavoritesListProps {
  selectedStopId?: string | null;
  onSelectStop?: (stopId: string) => void;
}

export function FavoritesList({ selectedStopId, onSelectStop }: FavoritesListProps) {
  const { favorites, loading } = useFavorites();

  if (loading || favorites.length === 0) return null;

  return (
    <nav
      aria-label="Favorite bus stops"
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
        const isSelected = selectedStopId === fav.stopId;
        return (
          <button
            key={fav.id}
            id={`favorite-${fav.id}`}
            type="button"
            onClick={() => onSelectStop?.(fav.stopId)}
            className={`flex-none flex flex-col items-start px-3.5 py-2 rounded-2xl transition-all duration-150 active:scale-95 text-left border ${
              isSelected
                ? 'bg-[#F4A100]/15 border-[#F4A100] ring-2 ring-[#F4A100]/30 shadow-lg shadow-[#F4A100]/10'
                : 'bg-[#182337]/90 hover:bg-[#182337] border-white/10 hover:border-white/20 shadow-md'
            }`}
            style={{ minWidth: 120, maxWidth: 180 }}
          >
            <span
              className="font-display text-sm font-bold leading-tight truncate w-full"
              style={{ color: isSelected ? '#FFF8EE' : '#F4A100' }}
            >
              {fav.label ?? `Stop ${fav.stopId}`}
            </span>
            <span className="text-[11px] font-mono text-[#FFF8EE]/40 mt-0.5">
              {fav.routeId ? `Route ${fav.routeId}` : `ID: ${fav.stopId}`}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
