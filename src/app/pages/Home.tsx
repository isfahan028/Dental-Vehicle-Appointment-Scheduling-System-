import { useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router';
import * as api from '../lib/api';
import type { DentalVehicle } from '../types';
import { Button } from '../components/ui/Button';
import { MapPin, Clock, Calendar, CheckCircle2, ArrowRight, Info } from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { VehicleMap } from '../components/VehicleMap';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { usePolling } from '../hooks/usePolling';

export default function Home() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'available'>('all');
  const [vehicles, setVehicles] = useState<DentalVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadVehicles = useCallback(async () => {
    try {
      const data = await api.getVehicles();
      setVehicles(data);
    } catch (error) {
      console.error('Failed to load vehicles:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  // Keep the fleet list fresh (availability changes) without a Realtime channel.
  usePolling(loadVehicles, { intervalMs: 45_000 });

  const filteredVehicles = vehicles.filter(v => 
    filter === 'all' ? true : v.is_available
  );

  return (
    
    <div className="space-y-16 pb-12">
      {/* Info Banner for First-Time Users */}
      {!user && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mx-4 lg:mx-0">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Welcome to DentalMove! 🦷</p>
              <p>This system is now connected to Supabase. <strong>Register</strong> to create your first account - the first user becomes an admin automatically!</p>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative bg-blue-600 text-white rounded-3xl overflow-hidden shadow-2xl mx-4 lg:mx-0">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 to-blue-600/80 z-10" />
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80" 
            alt="Dental Office" 
            className="w-full h-full object-cover"
          />
        </div>
        
        <div className="relative z-20 container mx-auto px-6 py-24 text-center lg:text-left flex flex-col lg:flex-row items-center gap-12">
          <div className="lg:w-1/2 space-y-6">
            <h1 className="text-4xl lg:text-6xl font-bold leading-tight">
              Quality Dental Care, <br/>
              <span className="text-blue-200">Right at Your Doorstep</span>
            </h1>
            <p className="text-xl text-blue-100 max-w-lg mx-auto lg:mx-0">
              Experience the convenience of our state-of-the-art mobile dental clinics. 
              Professional care that comes to you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
              <Link to="/book">
                <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 border-none shadow-lg w-full sm:w-auto">
                  Book Appointment
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10 w-full sm:w-auto">
                  Create Account
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Hero Stats/Features */}
          <div className="lg:w-1/2 grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 hover:bg-white/20 transition-colors">
              <div className="bg-blue-500/30 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-blue-100" />
              </div>
              <h3 className="font-bold text-lg mb-1">Flexible Hours</h3>
              <p className="text-blue-100 text-sm">We work around your schedule, including weekends.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 hover:bg-white/20 transition-colors">
              <div className="bg-blue-500/30 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-blue-100" />
              </div>
              <h3 className="font-bold text-lg mb-1">Multiple Locations</h3>
              <p className="text-blue-100 text-sm">Serving various neighborhoods across the city.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Booking a dental appointment has never been easier. Follow these simple steps to get started.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-8">
          {[
            { icon: CheckCircle2, title: 'Select Service', desc: 'Choose from our range of dental treatments.' },
            { icon: MapPin, title: 'Choose Location', desc: 'Find a mobile clinic parked near you.' },
            { icon: Calendar, title: 'Pick a Time', desc: 'Select a date and time that works best.' },
            { icon: CheckCircle2, title: 'Get Treated', desc: 'Visit our mobile clinic and enjoy your smile!' }
          ].map((step, index) => (
            <div key={index} className="flex flex-col items-center text-center group">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                <step.icon size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-gray-500">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Where To Find Us — live map of the fleet */}
      <section className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Where to Find Us</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Our mobile clinics move around the city. Here&apos;s where each unit is parked right now.
          </p>
        </div>
        <VehicleMap vehicles={vehicles} />
      </section>

      {/* Vehicles Section */}
      <section className="container mx-auto px-4 bg-gray-50 py-16 rounded-3xl">
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Our Modern Fleet</h2>
            <p className="text-gray-600">Equipped with the latest dental technology.</p>
          </div>
          
          <div className="flex bg-white p-1 rounded-lg shadow-sm border border-gray-200">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                filter === 'all' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              All Vehicles
            </button>
            <button
              onClick={() => setFilter('available')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                filter === 'available' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Available Now
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            <p className="text-gray-500 mt-4">Loading our fleet...</p>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <p className="text-center text-gray-500 py-12">No vehicles to show right now.</p>
        ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredVehicles.map((vehicle) => (
            <motion.div 
              key={vehicle.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100 hover:shadow-xl transition-shadow group"
            >
              <div className="h-56 w-full overflow-hidden relative">
                <ImageWithFallback 
                  src={vehicle.image_url} 
                  alt={vehicle.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold shadow-sm ${vehicle.is_available ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                  {vehicle.is_available ? 'Available' : 'Maintenance'}
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{vehicle.name}</h3>
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    <span>{vehicle.location}</span>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    <span className="block font-medium text-gray-900">98%</span>
                    Satisfaction
                  </div>
                  <Link to={`/book?vehicleId=${vehicle.id}`}>
                    <Button 
                      disabled={!vehicle.is_available}
                      className="group-hover:bg-blue-700 transition-colors"
                    >
                      Book Now <ArrowRight size={16} className="ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        )}
      </section>
    </div>
  );
}