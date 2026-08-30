import { useMap } from 'react-leaflet';
import { Locate } from 'lucide-react';
import type { GeoPosition } from '../../hooks/useGeolocation.ts';
import { smoothFlyTo, getTargetCenter } from '../../lib/mapUtils.ts';

interface RecenterButtonProps {
  position: GeoPosition | null;
  defaultCenter?: [number, number];
}

export function RecenterButton({ position, defaultCenter }: RecenterButtonProps) {
  const map = useMap();

  const handleRecenter = (e: React.MouseEvent) => {
    e.stopPropagation();
    const target = getTargetCenter(position, defaultCenter);
    smoothFlyTo(map, target, 15, 1.2, true);
  };

  return (
    <div className="leaflet-bottom leaflet-right !pointer-events-auto !mb-24 !mr-4 z-[400]">
      <button
        type="button"
        onClick={handleRecenter}
        aria-label="Re-center map to your location"
        className="flex items-center justify-center w-12 h-12 bg-[#182337]/90 hover:bg-[#182337] active:scale-95 text-[#FFF8EE] border border-white/10 rounded-full shadow-xl backdrop-blur-md transition-all duration-150"
      >
        <Locate className="w-5 h-5 text-[#F4A100]" />
      </button>
    </div>
  );
}
