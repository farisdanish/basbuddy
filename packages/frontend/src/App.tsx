import { useEffect, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { useGeolocation } from './hooks/useGeolocation.ts';
import { FavoritesList } from './components/FavoritesList/FavoritesList.tsx';

// ── Time-of-day gradient (§11 signature element) ──────────────────────────────
function getTimeGradientClass(hour: number): string {
  if (hour >= 5 && hour < 7)   return 'gradient-dawn';
  if (hour >= 7 && hour < 11)  return 'gradient-morning';
  if (hour >= 11 && hour < 16) return 'gradient-midday';
  if (hour >= 16 && hour < 19) return 'gradient-golden';
  if (hour >= 19 && hour < 21) return 'gradient-dusk';
  return 'gradient-night';
}

// KL city centre — default map centre if geolocation unavailable
const KL_CENTER: [number, number] = [3.1390, 101.6869];
const DEFAULT_ZOOM = 14;

export default function App() {
  const [gradientClass, setGradientClass] = useState(() => {
    const klHour = new Date().toLocaleString('en-MY', {
      timeZone: 'Asia/Kuala_Lumpur',
      hour: 'numeric',
      hour12: false,
    });
    return getTimeGradientClass(parseInt(klHour, 10));
  });

  // Update gradient every 5 minutes
  useEffect(() => {
    const update = () => {
      const klHour = parseInt(
        new Date().toLocaleString('en-MY', {
          timeZone: 'Asia/Kuala_Lumpur',
          hour: 'numeric',
          hour12: false,
        }),
        10,
      );
      setGradientClass(getTimeGradientClass(klHour));
    };
    const id = setInterval(update, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const { position } = useGeolocation();
  const mapCenter: [number, number] = position
    ? [position.lat, position.lon]
    : KL_CENTER;

  return (
    <div className={`relative h-full w-full ${gradientClass}`}>
      {/* ── Full-screen map ─────────────────────────────────────────────────── */}
      <MapContainer
        center={mapCenter}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        className="absolute inset-0 z-0"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* TODO M6: VehicleMarkersLayer, StopMarkersLayer */}
      </MapContainer>

      {/* ── Bottom favourites tray ───────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <FavoritesList />
      </div>

      {/* ── Attribution footer (CC BY 4.0 requirement, §3) ──────────────────── */}
      <footer className="absolute bottom-0 left-0 z-20 p-1 text-[10px] text-muted opacity-50 pointer-events-none select-none">
        Data: <a className="pointer-events-auto underline" href="https://data.gov.my" target="_blank" rel="noopener noreferrer">data.gov.my</a> / Prasarana ·{' '}
        <a className="pointer-events-auto underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> ·{' '}
        Unofficial, not affiliated with Prasarana
      </footer>
    </div>
  );
}
