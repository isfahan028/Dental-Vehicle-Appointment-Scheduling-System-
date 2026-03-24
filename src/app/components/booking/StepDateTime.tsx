import React from 'react';
import { Calendar, Clock, ChevronRight, ChevronLeft } from 'lucide-react';

interface StepDateTimeProps {
  date: string;
  time: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onNext: () => void;
  onPrev: () => void;
}

export const StepDateTime: React.FC<StepDateTimeProps> = ({ date, time, onDateChange, onTimeChange, onNext, onPrev }) => {
  const availableTimes = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Select Date & Time</h2>
        <p className="text-gray-500">Pick a convenient slot for your appointment</p>
      </div>

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
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">Select Time Slot</label>
          <div className="grid grid-cols-3 gap-3">
            {availableTimes.map((slot) => (
              <button
                key={slot}
                onClick={() => onTimeChange(slot)}
                className={`py-2 px-3 text-sm rounded-lg border transition-all ${
                  time === slot
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-6 mt-8 border-t border-gray-100">
        <button
          onClick={onPrev}
          className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={18} /> Back
        </button>
        <button
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
