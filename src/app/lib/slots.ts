// Shared booking-slot constants and small date helpers.
//
// The time slots here MUST match the ones offered in the booking wizard
// (`components/booking/StepDateTime.tsx`) so the availability calendar and the
// booking form agree on what "a slot" is.

export const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00',
] as const;

export type TimeSlot = (typeof TIME_SLOTS)[number];

// Postgres `TIME` columns come back as "HH:MM:SS" — trim to "HH:MM".
export function normalizeTime(t: string): string {
  return t.slice(0, 5);
}

// Local-timezone date key "YYYY-MM-DD". Built from date parts (not toISOString)
// so it never shifts a day near midnight in the user's timezone.
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Unique key for one bookable slot.
export function slotKey(vehicleId: string, dateKey: string, time: string): string {
  return `${vehicleId}|${dateKey}|${normalizeTime(time)}`;
}

// A human month label, e.g. "March 2026".
export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

// 6-week (42-cell) grid covering `month`, starting on Sunday. Cells outside the
// month are included so the grid is always rectangular.
export function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
