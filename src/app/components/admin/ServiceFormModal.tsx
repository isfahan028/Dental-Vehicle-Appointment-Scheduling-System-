import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import * as api from '../../lib/api';
import type { Service } from '../../types';
import { Button } from '../ui/Button';

interface ServiceFormModalProps {
  /** Service to edit; omit / null to add a new one. */
  service?: Service | null;
  accessToken: string;
  onClose: () => void;
  onSaved: (service: Service) => void;
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export function ServiceFormModal({ service, accessToken, onClose, onSaved }: ServiceFormModalProps) {
  const isEdit = !!service;

  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [duration, setDuration] = useState(
    service?.duration_minutes != null ? String(service.duration_minutes) : '30',
  );
  const [price, setPrice] = useState(service?.price != null ? String(service.price) : '0');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const validate = (): string | null => {
    if (!name.trim()) return 'Name is required.';

    const d = Number(duration);
    if (duration.trim() === '' || Number.isNaN(d) || d <= 0) {
      return 'Duration must be a number greater than 0.';
    }

    const p = Number(price);
    if (price.trim() === '' || Number.isNaN(p) || p < 0) {
      return 'Price must be 0 or more.';
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

    const payload = {
      name: name.trim(),
      description: description.trim(),
      duration_minutes: Number(duration),
      price: Number(price),
    };

    try {
      const res = isEdit
        ? await api.updateService(service!.id, payload, accessToken)
        : await api.createService(payload, accessToken);
      onSaved(res.service as Service);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save service.');
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
            {isEdit ? 'Edit Service' : 'Add New Service'}
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
              placeholder="Teeth Whitening"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              className={inputClass}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of the treatment."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Duration (min)
              </label>
              <input
                type="text"
                className={inputClass}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="30"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Price (฿)</label>
              <input
                type="text"
                className={inputClass}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="500"
                inputMode="decimal"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Service'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
