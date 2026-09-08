import { useCallback, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';
import type { Appointment } from '../types';
import { Link } from 'react-router';
import { Button } from '../components/ui/Button';
import { Calendar, Clock, MapPin, Activity, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRealtimeRefetch } from '../hooks/useRealtime';

export default function Appointments() {
  const { user, accessToken } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAppointments = useCallback(async () => {
    if (!user || !accessToken) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.getAppointments(accessToken);
      setAppointments(data);
    } catch (error) {
      console.error('Failed to load appointments:', error);
      toast.error('Failed to load appointments');
    } finally {
      setIsLoading(false);
    }
  }, [user, accessToken]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // Live-update the list when an appointment is created / approved / cancelled.
  useRealtimeRefetch('appointments', loadAppointments, { enabled: !!user && !!accessToken });

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="bg-blue-50 p-6 rounded-full">
          <AlertCircle size={48} className="text-blue-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Please login to view your appointments</h2>
        <Link to="/login">
          <Button size="lg">Login to Account</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-500 mt-4">Loading appointments...</p>
      </div>
    );
  }

  const sortedAppointments = [...appointments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleCancel = async (id: string) => {
    if (!accessToken) return;

    if (confirm('Are you sure you want to cancel this appointment?')) {
      try {
        await api.updateAppointment(id, 'Cancelled', accessToken);
        
        // Update local state
        setAppointments(prev => 
          prev.map(a => a.id === id ? { ...a, status: 'Cancelled' as const } : a)
        );
        
        toast.success('Appointment cancelled successfully');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to cancel appointment');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Appointments</h1>
          <p className="text-gray-500">Track and manage your dental visits.</p>
        </div>
        <Link to="/book">
          <Button className="shadow-lg shadow-blue-200">Book New Appointment</Button>
        </Link>
      </div>

      {sortedAppointments.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
          <div className="bg-gray-50 p-4 rounded-full mb-4">
            <Calendar size={32} className="text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No appointments yet</h3>
          <p className="text-gray-500 mb-6 max-w-sm">You haven't scheduled any dental visits yet. Book your first appointment today!</p>
          <Link to="/book">
            <Button variant="outline">Schedule Now</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedAppointments.map((appointment) => (
            <div 
              key={appointment.id} 
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all group"
            >
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                      <Activity size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{appointment.service_name || 'Dental Service'}</h3>
                      <p className="text-sm text-gray-500">ID: {appointment.id}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      <span className="font-medium">{new Date(appointment.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span className="font-medium">{appointment.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      <span className="font-medium">{appointment.vehicle_name}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between gap-4">
                  <StatusBadge status={appointment.status} />
                  
                  {appointment.status === 'Pending' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 w-full md:w-auto"
                      onClick={() => handleCancel(appointment.id)}
                    >
                      <XCircle size={16} className="mr-2" /> Cancel Request
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    Pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Approved: 'bg-green-100 text-green-800 border-green-200',
    Completed: 'bg-blue-100 text-blue-800 border-blue-200',
    Cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  const style = styles[status as keyof typeof styles] || styles.Pending;

  return (
    <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${style} shadow-sm`}>
      {status}
    </span>
  );
}