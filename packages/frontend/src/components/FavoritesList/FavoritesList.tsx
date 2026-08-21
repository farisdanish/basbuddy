import { useFavorites } from '../../hooks/useFavorites.ts';

// ─── FavoritesList ────────────────────────────────────────────────────────────
// Horizontal scrollable strip of favourite stops, shown above the map bottom edge.
// Tapping a favourite should open the StopSheet — wired in M7.

interface FavoritesListProps {
  onSelectStop?: (stopId: string) => void;
}

export function FavoritesList({ onSelectStop }: FavoritesListProps) {
  const { favorites, loading } = useFavorites();

  if (loading || favorites.length === 0) return null;

  return (
    <div
      className="px-3 py-2 overflow-x-auto flex gap-2"
      style={{
        background: 'linear-gradient(to top, var(--bg-primary) 60%, transparent)',
        paddingBottom: `calc(0.5rem + var(--safe-bottom))`,
        scrollbarWidth: 'none',
      }}
    >
      {favorites.map((fav) => (
        <button
          key={fav.id}
          id={`favorite-${fav.id}`}
          onClick={() => onSelectStop?.(fav.stopId)}
          className="flex-none flex flex-col items-start px-3 py-2 rounded-xl transition-all active:scale-95"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            minWidth: 120,
          }}
        >
          <span
            className="font-display text-base font-bold leading-tight"
            style={{ color: 'var(--color-mango-peel)' }}
          >
            {fav.label ?? fav.stopId}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {fav.routeId ? `Route ${fav.routeId}` : 'Stop'}
          </span>
        </button>
      ))}
    </div>
  );
}
