import React, { useEffect, useState } from 'react';
import type { Service } from '../../types';
import * as api from '../../lib/api';
import { Check, Clock } from 'lucide-react';

interface StepServiceProps {
  selectedServiceId: string;
  onSelect: (serviceId: string) => void;
  onNext: () => void;
}

export const StepService: React.FC<StepServiceProps> = ({ selectedServiceId, onSelect, onNext }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadServices = async () => {
      try {
        const data = await api.getServices();
        setServices(data);
      } catch (error) {
        console.error('Failed to load services:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadServices();
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Choose a Service</h2>
        <p className="text-gray-500">Select the dental service you require</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-500 mt-4">Loading services...</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {services.map((service) => (
            <div
              key={service.id}
              onClick={() => onSelect(service.id)}
              className={`cursor-pointer relative p-6 border-2 rounded-xl transition-all duration-200 hover:shadow-md ${
                selectedServiceId === service.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-100 bg-white hover:border-blue-200'
              }`}
            >
              {selectedServiceId === service.id && (
                <div className="absolute top-4 right-4 bg-blue-500 text-white rounded-full p-1">
                  <Check size={16} />
                </div>
              )}
              
              <h3 className="font-bold text-lg text-gray-900 mb-2">{service.name}</h3>
              <p className="text-gray-500 text-sm mb-4 min-h-[40px]">{service.description}</p>
              
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                  <Clock size={14} />
                  <span>{service.duration_minutes} min</span>
                </div>
                <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                  <span className="font-semibold">฿</span>
                  <span>{service.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-6">
        <button
          onClick={onNext}
          disabled={!selectedServiceId}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            selectedServiceId
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