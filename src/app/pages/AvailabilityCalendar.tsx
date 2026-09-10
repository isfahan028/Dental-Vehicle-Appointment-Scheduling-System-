import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CalendarDays, Check, X } from 'lucide-react';
import { useAvailability } from '../hooks/useAvailability';
import {
  TIME_SLOTS,
  buildMonthGrid,
  monthLabel,
  slotKey,
  toDateKey,
} from '../lib/slots';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL = 'all';

type DayInfo = { free: number; total: number };

export default function AvailabilityCalendar() {
  const { vehicles, bookedSet, loading, error } = useAvailability();

  const now = new Date();
  const todayKey = toDateKey(now);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  // Pre-select a unit when linked here from the admin "View Schedule" button.
  const [vehicleId, setVehicleId] = useState<string>(searchParams.get('vehicleId') ?? ALL);

  // Only units that are actually in service count toward availability.
  const activeVehicles = useMemo(
    () => vehicles.filter((v) => v.available),
    [vehicles],
  );

  const scopedVehicles = useMemo(
    () =>
      vehicleId === ALL
        ? activeVehicles
        : activeVehicles.filter((v) => v.id === vehicleId),
    [activeVehicles, vehicleId],
  );

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const atCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  // Free / total slots for one day across the selected scope.
  function dayInfo(dateKey: string): DayInfo {
    const total = scopedVehicles.length * TIME_SLOTS.length;
    let free = 0;
    for (const v of scopedVehicles) {
      for (const t of TIME_SLOTS) {
        if (!bookedSet.has(slotKey(v.id, dateKey, t))) free += 1;
      }
    }
    return { free, total };
  }

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected(null);
  }

  function toneFor(info: DayInfo, isPast: boolean) {
    if (isPast || info.total === 0)
      return { cell: 'bg-gray-50 text-gray-300', bar: 'bg-gray-200' };
    if (info.free === 0)
      return { cell: 'bg-red-50 text-red-700', bar: 'bg-red-500' };
    if (info.free <= info.total * 0.34)
      return { cell: 'bg-amber-50 text-amber-800', bar: 'bg-amber-500' };
    return { cell: 'bg-emerald-50 text-emerald-800', bar: 'bg-emerald-500' };
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="text-blue-600" /> Booking Availability
          </h1>
          <p className="text-gray-500 mt-1">
            See which dates and times are open before you book.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-sm text-gray-500">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          Live &middot; updates automatically
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          Vehicle
          <select
            value={vehicleId}
            onChange={(e) => {
              setVehicleId(e.target.value);
              setSelected(null);
            }}
            className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value={ALL}>All units ({activeVehicles.length})</option>
            {activeVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            disabled={atCurrentMonth}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="min-w-[10rem] text-center font-semibold text-gray-800">
            {monthLabel(year, month)}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-600">
        <LegendDot className="bg-emerald-500" label="Wide open" />
        <LegendDot className="bg-amber-500" label="Filling up" />
        <LegendDot className="bg-red-500" label="Fully booked" />
        <LegendDot className="bg-gray-300" label="Past / closed" />
      </div>

      {/* States */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          Couldn&apos;t load availability: {error}
        </div>
      )}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          <p className="text-gray-500 mt-4">Loading calendar…</p>
        </div>
      ) : (
        <>
          {/* Month grid */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs font-semibold uppercase tracking-wider text-gray-400 py-2"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {grid.map((date) => {
                const key = toDateKey(date);
                const inMonth = date.getMonth() === month;
                const isPast = key < todayKey;
                const isToday = key === todayKey;
                const info = dayInfo(key);
                const tone = toneFor(info, isPast);
                const clickable = !isPast && info.total > 0;
                const isSelected = selected === key;

                return (
                  <button
                    key={key}
                    disabled={!clickable}
                    onClick={() => setSelected(isSelected ? null : key)}
                    className={[
                      'relative flex flex-col rounded-xl p-2 min-h-[4.75rem] sm:min-h-[5.5rem] text-left transition-all',
                      tone.cell,
                      inMonth ? '' : 'opacity-40',
                      clickable ? 'hover:ring-2 hover:ring-blue-300 cursor-pointer' : 'cursor-default',
                      isSelected ? 'ring-2 ring-blue-600' : '',
                      isToday ? 'outline outline-2 outline-offset-1 outline-blue-400' : '',
                    ].join(' ')}
                  >
                    <span className="text-sm font-bold">{date.getDate()}</span>
                    {clickable && (
                      <span className="block mt-auto">
                        <span className="mt-2 block h-1.5 w-full rounded-full bg-white/70 overflow-hidden">
                          <span
                            className={`block h-full ${tone.bar}`}
                            style={{
                              width: `${info.total ? (info.free / info.total) * 100 : 0}%`,
                            }}
                          />
                        </span>
                        <span className="mt-1 block text-[11px] font-medium">
                          {info.free === 0 ? 'Full' : `${info.free} open`}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected-day detail */}
          <AnimatePresence mode="wait">
            {selected && (
              <motion.div
                key={selected + vehicleId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
              >
                <DayDetail
                  dateKey={selected}
                  vehicles={scopedVehicles}
                  scopeIsAll={vehicleId === ALL}
                  bookedSet={bookedSet}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {!selected && (
            <p className="text-center text-sm text-gray-400">
              Pick a day to see its time slots.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function DayDetail({
  dateKey,
  vehicles,
  scopeIsAll,
  bookedSet,
}: {
  dateKey: string;
  vehicles: { id: string; name: string }[];
  scopeIsAll: boolean;
  bookedSet: Set<string>;
}) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const pretty = new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900">{pretty}</h3>

      {vehicles.length === 0 ? (
        <p className="text-sm text-gray-500">No units available.</p>
      ) : scopeIsAll ? (
        <div className="space-y-2">
          {TIME_SLOTS.map((t) => (
            <div
              key={t}
              className="flex items-center gap-3 flex-wrap border-b border-gray-100 pb-2 last:border-0"
            >
              <span className="w-14 font-mono text-sm font-semibold text-gray-700">
                {t}
              </span>
              {vehicles.map((v) => {
                const booked = bookedSet.has(slotKey(v.id, dateKey, t));
                return booked ? (
                  <span
                    key={v.id}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 border border-red-100"
                  >
                    <X size={12} /> {v.name}
                  </span>
                ) : (
                  <Link
                    key={v.id}
                    to={`/book?vehicleId=${v.id}&date=${dateKey}&time=${t}`}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                  >
                    <Check size={12} /> {v.name}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {TIME_SLOTS.map((t) => {
            const booked = bookedSet.has(slotKey(vehicles[0].id, dateKey, t));
            return booked ? (
              <div
                key={t}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-red-50 text-red-500 border border-red-100 text-sm"
              >
                <span className="font-mono">{t}</span>
                <span className="text-xs font-semibold">Booked</span>
              </div>
            ) : (
              <Link
                key={t}
                to={`/book?vehicleId=${vehicles[0].id}&date=${dateKey}&time=${t}`}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:shadow-sm transition-all text-sm group"
              >
                <span className="font-mono">{t}</span>
                <span className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  Book →
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
