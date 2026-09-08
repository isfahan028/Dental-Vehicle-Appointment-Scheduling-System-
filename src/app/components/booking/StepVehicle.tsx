import React, { useEffect, useState } from 'react';
import type { DentalVehicle } from '../../types';
import * as api from '../../lib/api';
import { MapPin, Clock } from 'lucide-react';

interface StepVehicleProps {
  selectedVehicleId: string;
  onSelect: (vehicleId: string) => void;
  onNext: () => void;
  onPrev: () => void;
}

export const StepVehicle: React.FC<StepVehicleProps> = ({ selectedVehicleId, onSelect, onNext, onPrev }) => {
  const [vehicles, setVehicles] = useState<DentalVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadVehicles = async () => {
      try {
        const data = await api.getVehicles();
        setVehicles(data);
      } catch (error) {
        console.error('Failed to load vehicles:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadVehicles();
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Select Location</h2>
        <p className="text-gray-500">Choose a mobile dental clinic near you</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-500 mt-4">Loading locations...</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              onClick={() => vehicle.is_available && onSelect(vehicle.id)}
              className={`relative p-6 border-2 rounded-xl transition-all duration-200 ${
                vehicle.is_available ? 'cursor-pointer hover:shadow-md hover:border-blue-200' : 'opacity-50 cursor-not-allowed bg-gray-50'
              } ${
                selectedVehicleId === vehicle.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-100'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-gray-900">{vehicle.name}</h3>
                <span className={`px-2 py-1 text-xs font-bold rounded ${vehicle.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {vehicle.is_available ? 'Available' : 'Maintenance'}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <MapPin size={16} className="text-blue-500" />
                <span className="text-sm">{vehicle.location}</span>
              </div>
              
              <div className="flex items-center gap-2 text-gray-600">
                <Clock size={16} className="text-blue-500" />
                <span className="text-sm">09:00 AM - 05:00 PM</span>
              </div>
              
              {selectedVehicleId === vehicle.id && (
                <div className="absolute top-4 right-4 bg-blue-500 w-3 h-3 rounded-full" />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-6">
        <button
          onClick={onPrev}
          className="px-6 py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!selectedVehicleId}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            selectedVehicleId
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Next Step
        </button>
      </div>
    </div>
  );
};