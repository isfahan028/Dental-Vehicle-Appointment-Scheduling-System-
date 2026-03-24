import { User, DentalVehicle, Service, Appointment } from '../types';

export const mockUsers: User[] = [
  {
    id: 'u1',
    name: 'Admin User',
    email: 'admin@example.com',
    phone: '123-456-7890',
    role: 'admin',
    is_active: true,
    created_at: '2023-01-01T00:00:00Z',
  },
  {
    id: 'u2',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '555-0199',
    role: 'normal_user',
    is_active: true,
    created_at: '2023-02-15T10:00:00Z',
  },
  {
    id: 'u3',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '555-0200',
    role: 'normal_user',
    is_active: false, // pending approval
    created_at: '2023-03-01T09:30:00Z',
  }
];

export const mockVehicles: DentalVehicle[] = [
  {
    id: 'v1',
    name: 'Dental Unit Alpha',
    location: 'Central Park Entrance',
    latitude: 40.7644,
    longitude: -73.9732,
    is_available: true,
    image_url: 'https://images.unsplash.com/photo-1517166365435-027581788225?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'v2',
    name: 'Dental Unit Beta',
    location: 'Downtown Square',
    latitude: 40.7128,
    longitude: -74.0060,
    is_available: true,
    image_url: 'https://images.unsplash.com/photo-1629909615184-74f495363b63?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'v3',
    name: 'Mobile Clinic Gamma',
    location: 'Westside Community Center',
    latitude: 40.7484,
    longitude: -73.9857,
    is_available: false, // Maintenance
    image_url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
  }
];

export const mockServices: Service[] = [
  {
    id: 's1',
    name: 'General Checkup',
    duration_minutes: 30,
    price: 50,
    description: 'Routine dental examination and consultation.',
  },
  {
    id: 's2',
    name: 'Cleaning & Polishing',
    duration_minutes: 45,
    price: 80,
    description: 'Professional teeth cleaning to remove plaque and tartar.',
  },
  {
    id: 's3',
    name: 'Filling',
    duration_minutes: 60,
    price: 120,
    description: 'Restoration of damaged teeth with filling material.',
  },
  {
    id: 's4',
    name: 'X-Ray',
    duration_minutes: 15,
    price: 40,
    description: 'Digital dental radiography.',
  }
];

export const mockAppointments: Appointment[] = [
  {
    id: 'a1',
    user_id: 'u2',
    vehicle_id: 'v1',
    service_id: 's1',
    date: '2023-10-25',
    time: '10:00',
    status: 'Completed',
    created_at: '2023-10-20T08:00:00Z',
    vehicle_name: 'Dental Unit Alpha',
    service_name: 'General Checkup',
    user_name: 'John Doe'
  },
  {
    id: 'a2',
    user_id: 'u2',
    vehicle_id: 'v2',
    service_id: 's2',
    date: '2023-11-05',
    time: '14:00',
    status: 'Approved',
    created_at: '2023-10-28T12:30:00Z',
    vehicle_name: 'Dental Unit Beta',
    service_name: 'Cleaning & Polishing',
    user_name: 'John Doe'
  },
  {
    id: 'a3',
    user_id: 'u3',
    vehicle_id: 'v1',
    service_id: 's3',
    date: '2023-11-10',
    time: '09:00',
    status: 'Pending',
    created_at: '2023-11-01T15:45:00Z',
    vehicle_name: 'Dental Unit Alpha',
    service_name: 'Filling',
    user_name: 'Jane Smith'
  }
];

export const addAppointment = (appointment: Appointment) => {
  mockAppointments.push(appointment);
};
