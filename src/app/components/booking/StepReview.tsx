import React, { useEffect, useState } from 'react';
import * as api from '../../lib/api';
import type { Service, DentalVehicle } from '../../types';
import { Button } from '../ui/Button';
import { CheckCircle2, MapPin, Clock, Calendar, Check } from 'lucide-react';

interface StepReviewProps {
  formData: {
    serviceId: string;
    vehicleId: string;
    date: string;
    time: string;
  };
  onConfirm: () => void;
  onPrev: () => void;
  isSubmitting: boolean;
}

export const StepReview: React.FC<StepReviewProps> = ({ formData, onConfirm, onPrev, isSubmitting }) => {
  const [service, setService] = useState<Service | null>(null);
  const [vehicle, setVehicle] = useState<DentalVehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const [serviceData, vehicleData] = await Promise.all([
          api.getService(formData.serviceId),
          api.getVehicle(formData.vehicleId)
        ]);
        
        setService(serviceData);
        setVehicle(vehicleData);
      } catch (error) {
        console.error('Failed to load booking details:', error);
        setError('Failed to load booking details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    if (formData.serviceId && formData.vehicleId) {
      loadData();
    }
  }, [formData.serviceId, formData.vehicleId]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-gray-500 mt-4">Loading booking details...</p>
      </div>
    );
  }

  if (error || !service || !vehicle) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error || 'Invalid Selection'}</p>
        <button
          onClick={onPrev}
          className="px-6 py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Confirm Your Appointment</h2>
        <p className="text-gray-500">Please review your booking details before confirming.</p>
      </div>

      <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
        <div className="grid gap-6 md:grid-cols-2">
          
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2 mb-4">Service Details</h3>
            
            <div className="flex items-start gap-3">
              <div className="bg-white p-2 rounded-lg shadow-sm text-blue-600">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">{service.name}</p>
                <p className="text-sm text-gray-500">{service.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-lg shadow-sm text-blue-600">
                <Clock size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">{service.duration_minutes} Minutes</p>
                <p className="text-sm text-gray-500">Estimated Duration</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 border-b pb-2 mb-4">Location & Time</h3>
            
            <div className="flex items-start gap-3">
              <div className="bg-white p-2 rounded-lg shadow-sm text-blue-600">
                <MapPin size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">{vehicle.name}</p>
                <p className="text-sm text-gray-500">{vehicle.location}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-lg shadow-sm text-blue-600">
                <Calendar size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">{formData.date} at {formData.time}</p>
                <p className="text-sm text-gray-500">Appointment Schedule</p>
              </div>
            </div>
          </div>

        </div>
        
        {service.price && (
          <div className="mt-8 pt-6 border-t border-blue-100 flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Total Estimated Cost
            </div>
            <div className="text-2xl font-bold text-gray-900">
              ฿{service.price}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-6 mt-4">
        <button
          onClick={onPrev}
          disabled={isSubmitting}
          className="px-6 py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Back
        </button>
        <Button
          onClick={onConfirm}
          disabled={isSubmitting}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 px-8"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
              Processing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Confirm Booking <Check size={18} />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
};