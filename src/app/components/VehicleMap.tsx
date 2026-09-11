import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link } from 'react-router';
import { Search } from 'lucide-react';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import type { DentalVehicle } from '../types';

// Leaflet's default marker icon URLs assume a CSS-relative path that breaks
// under a bundler. Point them at the assets Vite has hashed for us.
type IconDefaultProto = { _getIconUrl?: unknown };
delete (L.Icon.Default.prototype as IconDefaultProto)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

const FIT_OPTIONS: L.FitBoundsOptions = { padding: [50, 50], maxZoom: 12 };

/**
 * Fits the map to `bounds` once the container actually has a size. Leaflet
 * can't compute a zoom for a 0×0 container (which is what we get when the map
 * mounts inside an initially-hidden/hero-below section), so a plain `bounds`
 * prop leaves the map stuck at world zoom. A ResizeObserver re-fits as soon as
 * the container is laid out, then stops so it never fights the user's panning.
 */
function FitBounds({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap();

  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      const { x, y } = map.getSize();
      if (x === 0 || y === 0) return;
      map.fitBounds(bounds, FIT_OPTIONS);
      observer.disconnect();
    };

    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    fit();

    return () => observer.disconnect();
  }, [map, bounds]);

  return null;
}

type LocatedVehicle = DentalVehicle & { latitude: number; longitude: number };

const hasCoords = (v: DentalVehicle): v is LocatedVehicle =>
  typeof v.latitude === 'number' &&
  typeof v.longitude === 'number' &&
  !Number.isNaN(v.latitude) &&
  !Number.isNaN(v.longitude);

export function VehicleMap({ vehicles }: { vehicles: DentalVehicle[] }) {
  const located = useMemo(() => vehicles.filter(hasCoords), [vehicles]);

  const [map, setMap] = useState<L.Map | null>(null);
  const markerRefs = useRef<Record<string, L.Marker>>({});
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return located.filter(
      (v) =>
        v.name.toLowerCase().includes(q) || v.location.toLowerCase().includes(q),
    );
  }, [located, query]);

  const focusVehicle = (v: LocatedVehicle) => {
    setQuery('');
    if (!map) return;
    map.flyTo([v.latitude, v.longitude], 15, { duration: 0.75 });
    // Open the popup once the fly animation has started.
    window.setTimeout(() => markerRefs.current[v.id]?.openPopup(), 450);
  };

  // Home polls vehicle data on an interval, which hands us a brand-new
  // `vehicles` array every time even when nothing actually changed. Keying
  // the bounds memo off the real coordinate values (not the array reference)
  // means <FitBounds> only re-fits when a unit is actually added, removed, or
  // moved — not on every routine refresh, which used to snap the view back
  // out from under whoever was looking at (or panning) the map.
  const boundsKey = useMemo(
    () =>
      located
        .map((v) => `${v.id}:${v.latitude.toFixed(5)},${v.longitude.toFixed(5)}`)
        .sort()
        .join('|'),
    [located],
  );

  // Start zoomed out enough to see every unit plus surrounding context.
  const bounds = useMemo(() => {
    if (located.length === 0) return null;
    return L.latLngBounds(
      located.map((v) => [v.latitude, v.longitude] as [number, number]),
    ).pad(0.35);
    // Intentionally keyed on boundsKey, not `located` — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey]);

  if (located.length === 0 || !bounds) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-center text-gray-500">
        <p>
          No unit locations on the map yet.
          <br />
          <span className="text-sm">An admin can add coordinates from the dashboard.</span>
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a unit or area…"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {matches.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-[1000] mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {matches.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => focusVehicle(v)}
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-blue-50"
                >
                  <span className="font-medium text-gray-900">{v.name}</span>
                  <span className="text-xs text-gray-500">{v.location}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {query.trim() !== '' && matches.length === 0 && (
          <div className="absolute left-0 right-0 top-full z-[1000] mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-lg">
            No unit matches “{query.trim()}”.
          </div>
        )}
      </div>

      <div className="relative z-0 overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
        <MapContainer
          ref={setMap}
          bounds={bounds}
          boundsOptions={FIT_OPTIONS}
          scrollWheelZoom={false}
          className="h-[480px] w-full md:h-[600px]"
        >
          <FitBounds bounds={bounds} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {located.map((v) => (
            <Marker
              key={v.id}
              position={[v.latitude, v.longitude]}
              ref={(m) => {
                if (m) markerRefs.current[v.id] = m;
              }}
            >
              <Popup>
                <div className="space-y-1">
                  <p className="font-bold text-gray-900">{v.name}</p>
                  <p className="text-gray-600">{v.location}</p>
                  <p className="text-sm">
                    {v.is_available ? '🟢 Available' : '🔧 Under maintenance'}
                  </p>
                  {v.is_available && (
                    <Link
                      to={`/book?vehicleId=${v.id}`}
                      className="inline-block font-medium text-blue-600 hover:underline"
                    >
                      Book here →
                    </Link>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
