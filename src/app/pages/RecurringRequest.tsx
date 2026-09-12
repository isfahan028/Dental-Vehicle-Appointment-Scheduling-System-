import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';
import type { DentalVehicle, RecurringRequest, Service } from '../types';
import { TIME_SLOTS } from '../lib/slots';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { Repeat, Calendar, Clock, MapPin } from 'lucide-react';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

const STATUS_STYLES: Record<RecurringRequest['status'], string> = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
};

export default function RecurringRequestPage() {
  const { accessToken } = useAuth();

  const [vehicles, setVehicles] = useState<DentalVehicle[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [requests, setRequests] = useState<RecurringRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [vehicleId, setVehicleId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [time, setTime] = useState('');
  const [months, setMonths] = useState('3');
  const [submitting, setSubmitting] = useState(false);

  const [withdrawing, setWithdrawing] = useState<RecurringRequest | null>(null);
  const [withdrawBusy, setWithdrawBusy] = useState(false);

  const loadAll = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [v, s, r] = await Promise.all([
        api.getVehicles(),
        api.getServices(),
        api.getRecurringRequests(accessToken),
      ]);
      setVehicles(v.filter((x) => x.is_available));
      setServices(s);
      setRequests(r.sort((a, b) => b.created_at.localeCompare(a.created_at)));
    } catch (error) {
      console.error('Failed to load recurring requests:', error);
      toast.error('Failed to load this page');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;

    if (!vehicleId || !serviceId || !startDate || !time) {
      toast.error('Please fill in every field.');
      return;
    }
    const m = Number(months);
    if (!Number.isInteger(m) || m < 1 || m > 24) {
      toast.error('Months must be a whole number between 1 and 24.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createRecurringRequest(
        { vehicle_id: vehicleId, service_id: serviceId, start_date: startDate, time, months_requested: m },
        accessToken,
      );
      toast.success('Request submitted — an admin will review it soon.');
      setVehicleId('');
      setServiceId('');
      setStartDate('');
      setTime('');
      setMonths('3');
      loadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmWithdraw = async () => {
    if (!accessToken || !withdrawing) return;
    setWithdrawBusy(true);
    try {
      await api.deleteRecurringRequest(withdrawing.id, accessToken);
      setRequests((prev) => prev.filter((r) => r.id !== withdrawing.id));
      toast.success('Request withdrawn');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to withdraw request');
    } finally {
      setWithdrawBusy(false);
      setWithdrawing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-500 mt-4">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
          <Repeat size={26} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Request a Recurring Appointment</h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Need a standing monthly visit — like a regular check-up? Tell us the details once and
          an admin will review and confirm the whole series. You don't book each month yourself.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-4"
      >
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Vehicle</label>
            <select className={inputClass} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">Select a vehicle…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — {v.location}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Service</label>
            <select className={inputClass} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Select a service…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">First date</label>
            <input
              type="date"
              className={inputClass}
              value={startDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-400">Every following month books on this same day.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Time</label>
            <select className={inputClass} value={time} onChange={(e) => setTime(e.target.value)}>
              <option value="">Select a time…</option>
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              How many months
            </label>
            <input
              type="text"
              inputMode="numeric"
              className={inputClass}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              placeholder="3"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Request'}
          </Button>
        </div>
      </form>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Your Requests</h2>

        {requests.length === 0 ? (
          <p className="text-sm text-gray-400 bg-white rounded-xl border border-gray-100 p-6 text-center">
            You haven't submitted any recurring requests yet.
          </p>
        ) : (
          requests.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{r.service_name}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[r.status]}`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <MapPin size={14} /> {r.vehicle_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={14} /> starts {r.start_date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} /> {r.time}
                  </span>
                  <span>{r.months_requested} month(s)</span>
                </div>
                {r.admin_note && (
                  <p className="text-sm text-gray-500 italic">"{r.admin_note}"</p>
                )}
              </div>

              {r.status === 'Pending' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50 self-start sm:self-center"
                  onClick={() => setWithdrawing(r)}
                >
                  Withdraw
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {withdrawing && (
        <ConfirmDialog
          danger
          title="Withdraw this request?"
          message="This will cancel your recurring appointment request before it's reviewed."
          confirmLabel="Withdraw"
          busy={withdrawBusy}
          onConfirm={confirmWithdraw}
          onCancel={() => setWithdrawing(null)}
        />
      )}
    </div>
  );
}
