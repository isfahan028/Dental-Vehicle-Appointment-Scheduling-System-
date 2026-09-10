import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeTime, slotKey } from '../lib/slots';
import { useRealtimeRefetch } from './useRealtime';
import { usePolling } from './usePolling';

// A vehicle as far as the availability view cares.
export type AvailVehicle = {
  id: string;
  name: string;
  available: boolean;
};

// One occupied slot. Cancelled appointments are filtered out (they free the
// slot again — same rule the server uses in `hasAppointmentConflict`).
export type Booking = {
  vehicleId: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  status: string;
};

type State = {
  vehicles: AvailVehicle[];
  bookings: Booking[];
  loading: boolean;
  error: string | null;
};

/**
 * Live view of every vehicle booking, read straight from Postgres with the
 * public anon key (migration 04 grants anon SELECT on `appointments`, and the
 * rows carry no personal data — just vehicle id + date + time + status).
 *
 * Stays fresh two ways:
 *   - Realtime: a Postgres change on `appointments` triggers an immediate refetch
 *     (needs `appointments` in the `supabase_realtime` publication).
 *   - Polling: a 60s fallback so it still updates if Realtime isn't enabled.
 */
export function useAvailability() {
  const [state, setState] = useState<State>({
    vehicles: [],
    bookings: [],
    loading: true,
    error: null,
  });

  // Returns the freshly-fetched set of taken slot keys (or null on failure) so
  // callers can do a just-in-time conflict check right before booking, without
  // waiting for React state / polling to catch up.
  const reload = useCallback(async (): Promise<Set<string> | null> => {
    try {
      const [vehiclesRes, apptRes] = await Promise.all([
        supabase
          .from('dental_vehicles')
          .select('vehicle_id, vehicle_name, available'),
        supabase
          .from('appointments')
          .select('vehicle_id, appointment_date, appointment_time, status'),
      ]);

      if (vehiclesRes.error) throw new Error(vehiclesRes.error.message);
      if (apptRes.error) throw new Error(apptRes.error.message);

      const vehicles: AvailVehicle[] = (vehiclesRes.data ?? [])
        .map((v) => ({
          id: String(v.vehicle_id),
          name: v.vehicle_name as string,
          available: Boolean(v.available),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const bookings: Booking[] = (apptRes.data ?? [])
        .filter((a) => a.status !== 'Cancelled')
        .map((a) => ({
          vehicleId: String(a.vehicle_id),
          date: a.appointment_date as string,
          time: normalizeTime(a.appointment_time as string),
          status: a.status as string,
        }));

      setState({ vehicles, bookings, loading: false, error: null });

      const freshSet = new Set<string>();
      for (const b of bookings) freshSet.add(slotKey(b.vehicleId, b.date, b.time));
      return freshSet;
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load availability',
      }));
      return null;
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useRealtimeRefetch('appointments', reload);
  usePolling(reload, { intervalMs: 60_000 });

  // Fast slot lookup: "vehicleId|date|time" -> true.
  const bookedSet = useMemo(() => {
    const set = new Set<string>();
    for (const b of state.bookings) {
      set.add(slotKey(b.vehicleId, b.date, b.time));
    }
    return set;
  }, [state.bookings]);

  return { ...state, bookedSet, reload };
}
