import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { Calendar, Clock, ChevronRight, ChevronLeft, CalendarDays, AlertTriangle } from 'lucide-react';
import { useAvailability } from '../../hooks/useAvailability';
import { TIME_SLOTS, slotKey } from '../../lib/slots';

interface StepDateTimeProps {
  vehicleId: string;
  date: string;
  time: string;
  /** Shown as a prominent alert, e.g. after a slot was taken at confirm time. */
  notice?: string | null;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onNext: () => void;
  onPrev: () => void;
}

export const StepDateTime: React.FC<StepDateTimeProps> = ({
  vehicleId,
  date,
  time,
  notice,
  onDateChange,
  onTimeChange,
  onNext,
  onPrev,
}) => {
  const { bookedSet } = useAvailability();

  // Which of this vehicle's slots are already taken on the chosen date.
  const bookedTimes = useMemo(() => {
    const taken = new Set<string>();
    if (!vehicleId || !date) return taken;
    for (const t of TIME_SLOTS) {
      if (bookedSet.has(slotKey(vehicleId, date, t))) taken.add(t);
    }
    return taken;
  }, [bookedSet, vehicleId, date]);

  // If the currently selected time gets booked (by someone else, live), drop it.
  useEffect(() => {
    if (time && bookedTimes.has(time)) onTimeChange('');
  }, [time, bookedTimes, onTimeChange]);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Select Date & Time</h2>
        <p className="text-gray-500">Pick a convenient slot for your appointment</p>
      </div>

      {notice && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <p className="font-medium">{notice}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">Select Date</label>
          <div className="relative">
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
            />
            <Calendar className="absolute left-3 top-3.5 text-gray-400" size={20} />
          </div>

          <div className="p-4 bg-blue-50 rounded-xl text-blue-800 text-sm">
            <h4 className="font-bold mb-2 flex items-center gap-2">
              <Clock size={16} /> Opening Hours
            </h4>
            <p>Monday - Friday: 09:00 AM - 05:00 PM</p>
            <p>Saturday: 10:00 AM - 02:00 PM</p>
            <p>Sunday: Closed</p>
          </div>

          <Link
            to="/calendar"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <CalendarDays size={16} /> View full availability calendar
          </Link>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">Select Time Slot</label>
          {!date && (
            <p className="text-sm text-gray-400">Choose a date first to see open times.</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {TIME_SLOTS.map((slot) => {
              const isBooked = bookedTimes.has(slot);
              const isSelected = time === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => !isBooked && onTimeChange(slot)}
                  disabled={isBooked || !date}
                  title={isBooked ? 'Already booked' : undefined}
                  className={`py-2 px-3 text-sm rounded-lg border transition-all ${
                    isBooked
                      ? 'bg-red-50 text-red-400 border-red-100 line-through cursor-not-allowed'
                      : isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50 disabled:hover:bg-white disabled:hover:border-gray-200'
                  }`}
                >
                  {slot}
                </button>
              );
            })}
          </div>
          {date && bookedTimes.size > 0 && (
            <p className="text-xs text-gray-400">
              <span className="line-through">Crossed-out</span> times are already booked for this vehicle.
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-between pt-6 mt-8 border-t border-gray-100">
        <button
          type="button"
          onClick={onPrev}
          className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={18} /> Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!date || !time}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
            date && time
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Review Booking <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};
