import React, { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { checkSlotTaken } from '../../hooks/useAvailability';
import * as api from '../../lib/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { StepService } from './StepService';
import { StepVehicle } from './StepVehicle';
import { StepDateTime } from './StepDateTime';
import { StepReview } from './StepReview';

const DATETIME_STEP = 2;
const SLOT_TAKEN_MESSAGE =
  'This slot is already booked. Please select another time slot.';

// Does a server / network error mean "someone else took this slot"?
function isSlotConflict(message: string): boolean {
  return /already booked|slot.*(taken|unavailable|conflict)|\b409\b/i.test(message);
}

export const BookingWizard: React.FC = () => {
  const { user, accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preSelectedVehicleId = searchParams.get('vehicleId');
  const preSelectedDate = searchParams.get('date');
  const preSelectedTime = searchParams.get('time');

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    serviceId: '',
    vehicleId: preSelectedVehicleId || '',
    date: preSelectedDate || '',
    time: preSelectedTime || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);
  // Hard guard against a double-click firing two bookings before the button
  // disables on re-render.
  const submitLock = useRef(false);

  // If vehicle is pre-selected, we might want to skip to step 1 (Service)? 
  // Or just have it selected in step 2 (Location).
  // Let's keep it simple: just pre-fill the data.
  
  const steps = [
    { title: 'Service', component: StepService },
    { title: 'Location', component: StepVehicle },
    { title: 'Time', component: StepDateTime },
    { title: 'Confirm', component: StepReview }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Picking a fresh time clears any stale "slot taken" warning.
    if (field === 'time' && value) setConflictNotice(null);
  };

  // Slot is gone: don't book, don't celebrate — send the user back to the
  // time picker with a clear, persistent explanation. StepDateTime re-fetches
  // availability on mount, so the taken slot shows as crossed-out there.
  const handleSlotTaken = () => {
    setConflictNotice(SLOT_TAKEN_MESSAGE);
    toast.error(SLOT_TAKEN_MESSAGE, { duration: 6000 });
    setFormData(prev => ({ ...prev, time: '' }));
    setCurrentStep(DATETIME_STEP);
  };

  const handleConfirm = async () => {
    if (submitLock.current || isSubmitting) return;

    if (!user || !accessToken) {
      toast.error('Please log in to complete your booking');
      navigate('/login');
      return;
    }

    const { vehicleId, serviceId, date, time } = formData;
    if (!vehicleId || !serviceId || !date || !time) {
      toast.error('Please complete every step before confirming.');
      return;
    }

    submitLock.current = true;
    setIsSubmitting(true);

    try {
      // Pre-flight check: confirm the slot is STILL free right now, before we
      // create anything. This is what stops the "Appointment booked!" /
      // "slot already taken" whiplash — a taken slot never reaches the API.
      if (await checkSlotTaken(vehicleId, date, time)) {
        handleSlotTaken();
        return;
      }

      await api.createAppointment(
        { vehicle_id: vehicleId, service_id: serviceId, date, time },
        accessToken,
      );

      toast.success('Appointment booked successfully!');
      navigate('/appointments');
    } catch (error) {
      console.error('Failed to create appointment:', error);
      const msg = error instanceof Error ? error.message : '';

      // The server rejected it because the slot was claimed in the moment
      // between our pre-flight check and the insert (or the DB unique index
      // fired). Same clean handling — no success message.
      if (isSlotConflict(msg)) {
        handleSlotTaken();
        return;
      }

      // Expired / invalid session: log out and send to login for a fresh token.
      if (
        msg.includes('Invalid or expired session') ||
        msg.includes('No session token') ||
        msg.includes('Unauthorized')
      ) {
        toast.error('Your session has expired. Please log in again.');
        await logout();
        navigate('/login');
        return;
      }

      toast.error(msg || 'Failed to book appointment. Please try again.');
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Progress Bar */}
      <div className="mb-12">
        <div className="flex justify-between items-center relative z-10">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-2 ${
                  index <= currentStep
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200'
                    : 'bg-white text-gray-400 border-gray-200'
                }`}
              >
                {index + 1}
              </div>
              <span className={`mt-2 text-xs font-medium uppercase tracking-wider ${
                index <= currentStep ? 'text-blue-600' : 'text-gray-400'
              }`}>
                {step.title}
              </span>
            </div>
          ))}
          
          {/* Connecting Line */}
          <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-100 -z-10">
            <div 
              className="h-full bg-blue-600 transition-all duration-300 ease-out"
              style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 border border-gray-100 min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep === 0 && (
              <StepService
                selectedServiceId={formData.serviceId}
                onSelect={(id) => updateFormData('serviceId', id)}
                onNext={handleNext}
              />
            )}
            {currentStep === 1 && (
              <StepVehicle
                selectedVehicleId={formData.vehicleId}
                onSelect={(id) => updateFormData('vehicleId', id)}
                onNext={handleNext}
                onPrev={handlePrev}
              />
            )}
            {currentStep === 2 && (
              <StepDateTime
                vehicleId={formData.vehicleId}
                date={formData.date}
                time={formData.time}
                notice={conflictNotice}
                onDateChange={(d) => updateFormData('date', d)}
                onTimeChange={(t) => updateFormData('time', t)}
                onNext={handleNext}
                onPrev={handlePrev}
              />
            )}
            {currentStep === 3 && (
              <StepReview
                formData={formData}
                onConfirm={handleConfirm}
                onPrev={handlePrev}
                isSubmitting={isSubmitting}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};