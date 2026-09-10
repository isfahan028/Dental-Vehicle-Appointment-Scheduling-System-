import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { Link } from 'react-router';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import type { DentalVehicle } from '../types';

// Leaflet's default marker icon URLs assume a CSS-relative path that breaks
// under a bundler. Point them at the assets Vite has hashed for us.
type IconDefaultProto = { _getIconUrl?: unknown };
delete (L.Icon.Default.prototype as IconDefaultProto)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

type LocatedVehicle = DentalVehicle & { latitude: number; longitude: number };

const hasCoords = (v: DentalVehicle): v is LocatedVehicle =>
  typeof v.latitude === 'number' &&
  typeof v.longitude === 'number' &&
  !Number.isNaN(v.latitude) &&
  !Number.isNaN(v.longitude);

export function VehicleMap({ vehicles }: { vehicles: DentalVehicle[] }) {
  const located = vehicles.filter(hasCoords);

  if (located.length === 0) {
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

  const center: [number, number] = [
    located.reduce((sum, v) => sum + v.latitude, 0) / located.length,
    located.reduce((sum, v) => sum + v.longitude, 0) / located.length,
  ];

  return (
    <div className="relative z-0 overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={false}
        className="h-[420px] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {located.map((v) => (
          <Marker key={v.id} position={[v.latitude, v.longitude]}>
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
  );
}
