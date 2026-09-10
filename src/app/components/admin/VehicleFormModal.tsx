import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import * as api from '../../lib/api';
import type { DentalVehicle } from '../../types';
import { Button } from '../ui/Button';

interface VehicleFormModalProps {
  /** Vehicle to edit; omit / null to add a new one. */
  vehicle?: DentalVehicle | null;
  accessToken: string;
  onClose: () => void;
  onSaved: (vehicle: DentalVehicle) => void;
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export function VehicleFormModal({ vehicle, accessToken, onClose, onSaved }: VehicleFormModalProps) {
  const isEdit = !!vehicle;

  const [name, setName] = useState(vehicle?.name ?? '');
  const [location, setLocation] = useState(vehicle?.location ?? '');
  const [imageUrl, setImageUrl] = useState(vehicle?.image_url ?? '');
  const [latitude, setLatitude] = useState(
    vehicle?.latitude != null ? String(vehicle.latitude) : '',
  );
  const [longitude, setLongitude] = useState(
    vehicle?.longitude != null ? String(vehicle.longitude) : '',
  );
  const [isAvailable, setIsAvailable] = useState(vehicle?.is_available ?? true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const validate = (): string | null => {
    if (!name.trim()) return 'Name is required.';
    if (!location.trim()) return 'Location is required.';

    for (const [label, value, min, max] of [
      ['Latitude', latitude, -90, 90],
      ['Longitude', longitude, -180, 180],
    ] as const) {
      if (value.trim() === '') continue;
      const n = Number(value);
      if (Number.isNaN(n)) return `${label} must be a number.`;
      if (n < min || n > max) return `${label} must be between ${min} and ${max}.`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    setError(null);

    // Send explicit null (not undefined) for a cleared coordinate so an edit
    // actually removes it — that's how a vehicle gets taken off the map.
    const payload = {
      name: name.trim(),
      location: location.trim(),
      image_url: imageUrl.trim(),
      is_available: isAvailable,
      latitude: latitude.trim() === '' ? null : Number(latitude),
      longitude: longitude.trim() === '' ? null : Number(longitude),
    };

    try {
      const res = isEdit
        ? await api.updateVehicle(vehicle!.id, payload, accessToken)
        : await api.createVehicle(payload, accessToken);
      onSaved(res.vehicle as DentalVehicle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save vehicle.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Edit Vehicle' : 'Add New Vehicle'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dental Unit Delta"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
            <input
              type="text"
              className={inputClass}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Riverside Plaza"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Image URL</label>
            <input
              type="text"
              className={inputClass}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Latitude <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                className={inputClass}
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="40.7644"
                inputMode="decimal"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Longitude <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                className={inputClass}
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="-73.9732"
                inputMode="decimal"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Available for booking
            <span className="text-xs font-normal text-gray-400">
              (unchecked = Maintenance)
            </span>
          </label>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Vehicle'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
