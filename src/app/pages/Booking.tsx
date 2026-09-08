import { BookingWizard } from '../components/booking/BookingWizard';

export default function Booking() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Book Your Appointment</h1>
        <p className="text-lg text-gray-600">Follow the steps below to schedule your dental visit.</p>
      </div>
      <BookingWizard />
    </div>
  );
}
