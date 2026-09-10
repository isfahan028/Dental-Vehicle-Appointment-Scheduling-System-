export type Role = 'normal_user' | 'admin';

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  is_active: boolean;
  approved_by?: string;
  created_at: string;
};

export type DentalVehicle = {
  id: string;
  name: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  is_available: boolean;
  image_url: string;
};

export type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  description?: string;
  price?: number;
};

export type AppointmentStatus = 'Pending' | 'Approved' | 'Completed' | 'Cancelled';

export type Appointment = {
  id: string;
  user_id: string;
  vehicle_id: string;
  service_id: string;
  date: string; // ISO date string YYYY-MM-DD
  time: string; // HH:mm
  status: AppointmentStatus;
  price?: number | null; // snapshotted at booking, admin-editable per appointment
  created_at: string;
  // Joined fields for UI convenience
  vehicle_name?: string;
  service_name?: string;
  user_name?: string;
};
