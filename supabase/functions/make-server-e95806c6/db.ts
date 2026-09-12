import { createClient } from 'npm:@supabase/supabase-js@2';

const client = () => createClient(
  Deno.env.get("SUPABASE_URL") ?? '',
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '',
);

// ===== SESSIONS =====

export async function getSession(token: string) {
  const supabase = client();
  const { data, error } = await supabase.from('sessions').select('*').eq('token', token).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createSession(token: string, userId: string) {
  const supabase = client();
  const { error } = await supabase.from('sessions').insert({ token, user_id: userId });
  if (error) throw new Error(error.message);
}

export async function deleteSession(token: string) {
  const supabase = client();
  const { error } = await supabase.from('sessions').delete().eq('token', token);
  if (error) throw new Error(error.message);
}

// ===== USERS =====

const mapUser = (dbUser: any) => ({
  id: dbUser.user_id,
  name: dbUser.name,
  email: dbUser.email,
  phone: dbUser.phone,
  role: dbUser.role,
  is_active: dbUser.is_active,
  created_at: dbUser.created_at,
  approved_by: dbUser.approved_by,
});

export async function getUser(id: string) {
  const supabase = client();
  const { data, error } = await supabase.from('users').select('*').eq('user_id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapUser(data) : null;
}

export async function createUser(user: any) {
  const supabase = client();
  const { error } = await supabase.from('users').insert({
    user_id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    is_active: user.is_active !== undefined ? user.is_active : true,
    created_at: user.created_at || new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return user;
}

export async function getAllUsers() {
  const supabase = client();
  const { data, error } = await supabase.from('users').select('*');
  if (error) throw new Error(error.message);
  return data ? data.map(mapUser) : [];
}

// Used to refuse demoting the last remaining admin.
export async function countAdmins() {
  const supabase = client();
  const { count, error } = await supabase
    .from('users')
    .select('user_id', { count: 'exact', head: true })
    .eq('role', 'admin');
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function updateUser(id: string, updates: any) {
  const supabase = client();
  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.email !== undefined) dbUpdates.email = updates.email;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.role !== undefined) dbUpdates.role = updates.role;
  if (updates.is_active !== undefined) dbUpdates.is_active = updates.is_active;

  const { data, error } = await supabase.from('users').update(dbUpdates).eq('user_id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapUser(data) : null;
}

// ===== VEHICLES =====

const mapVehicle = (dbVehicle: any) => ({
  id: dbVehicle.vehicle_id.toString(),
  name: dbVehicle.vehicle_name,
  location: dbVehicle.location_name,
  latitude: dbVehicle.latitude,
  longitude: dbVehicle.longitude,
  is_available: dbVehicle.available,
  image_url: dbVehicle.image_url,
});

export async function getAllVehicles() {
  const supabase = client();
  const { data, error } = await supabase.from('dental_vehicles').select('*');
  if (error) throw new Error(error.message);
  return data ? data.map(mapVehicle) : [];
}

export async function getVehicle(id: string) {
  const supabase = client();
  const { data, error } = await supabase.from('dental_vehicles').select('*').eq('vehicle_id', parseInt(id)).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapVehicle(data) : null;
}

export async function createVehicle(vehicle: any) {
  const supabase = client();
  const { data, error } = await supabase.from('dental_vehicles').insert({
    vehicle_name: vehicle.name,
    location_name: vehicle.location,
    latitude: vehicle.latitude,
    longitude: vehicle.longitude,
    available: vehicle.is_available,
    image_url: vehicle.image_url,
  }).select().maybeSingle();
  
  if (error) throw new Error(`createVehicle failed: ${error.message}`);
  if (!data) throw new Error('createVehicle: insert succeeded but no data returned (check RLS policies on dental_vehicles)');
  return mapVehicle(data);
}

export async function updateVehicle(id: string, updates: any) {
  const supabase = client();
  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.vehicle_name = updates.name;
  if (updates.location !== undefined) dbUpdates.location_name = updates.location;
  if (updates.latitude !== undefined) dbUpdates.latitude = updates.latitude;
  if (updates.longitude !== undefined) dbUpdates.longitude = updates.longitude;
  if (updates.is_available !== undefined) dbUpdates.available = updates.is_available;
  if (updates.image_url !== undefined) dbUpdates.image_url = updates.image_url;

  const { data, error } = await supabase.from('dental_vehicles').update(dbUpdates).eq('vehicle_id', parseInt(id)).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapVehicle(data) : null;
}

// How many appointments (any status) reference this vehicle. Used to block
// deletion of a vehicle that still has history / bookings.
export async function countVehicleAppointments(id: string) {
  const supabase = client();
  const { count, error } = await supabase
    .from('appointments')
    .select('appointment_id', { count: 'exact', head: true })
    .eq('vehicle_id', parseInt(id));
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function deleteVehicle(id: string) {
  const supabase = client();
  const { error } = await supabase.from('dental_vehicles').delete().eq('vehicle_id', parseInt(id));
  if (error) throw new Error(error.message);
}

// ===== SERVICES =====

const mapService = (dbService: any) => ({
  id: dbService.service_id.toString(),
  name: dbService.service_name,
  description: dbService.description,
  duration_minutes: dbService.duration_minutes,
  price: dbService.price,
});

export async function getAllServices() {
  const supabase = client();
  const { data, error } = await supabase.from('services').select('*');
  if (error) throw new Error(error.message);
  return data ? data.map(mapService) : [];
}

export async function getService(id: string) {
  const supabase = client();
  const { data, error } = await supabase.from('services').select('*').eq('service_id', parseInt(id)).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapService(data) : null;
}

export async function createService(service: any) {
  const supabase = client();
  const { data, error } = await supabase.from('services').insert({
    service_name: service.name,
    description: service.description,
    duration_minutes: service.duration_minutes,
    price: service.price,
  }).select().maybeSingle();
  if (error) throw new Error(`createService failed: ${error.message}`);
  if (!data) throw new Error('createService: insert succeeded but no data returned (check RLS policies on services)');
  return mapService(data);
}

export async function updateService(id: string, updates: any) {
  const supabase = client();
  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.service_name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.duration_minutes !== undefined) dbUpdates.duration_minutes = updates.duration_minutes;
  if (updates.price !== undefined) dbUpdates.price = updates.price;

  const { data, error } = await supabase.from('services').update(dbUpdates).eq('service_id', parseInt(id)).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapService(data) : null;
}

// How many appointments (any status) reference this service. Used to block
// deletion of a service that still has history / bookings.
export async function countServiceAppointments(id: string) {
  const supabase = client();
  const { count, error } = await supabase
    .from('appointments')
    .select('appointment_id', { count: 'exact', head: true })
    .eq('service_id', parseInt(id));
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function deleteService(id: string) {
  const supabase = client();
  const { error } = await supabase.from('services').delete().eq('service_id', parseInt(id));
  if (error) throw new Error(error.message);
}

// ===== APPOINTMENTS =====

const mapAppointment = (dbAppt: any) => {
  const base = {
    id: dbAppt.appointment_id.toString(),
    user_id: dbAppt.user_id,
    vehicle_id: dbAppt.vehicle_id.toString(),
    service_id: dbAppt.service_id.toString(),
    date: dbAppt.appointment_date,
    time: dbAppt.appointment_time,
    status: dbAppt.status,
    price: dbAppt.price != null ? Number(dbAppt.price) : null,
    created_at: dbAppt.created_at,
  };

  const extended: any = { ...base };
  if (dbAppt.dental_vehicles) extended.vehicle_name = dbAppt.dental_vehicles.vehicle_name;
  if (dbAppt.services) extended.service_name = dbAppt.services.service_name;
  if (dbAppt.users) extended.user_name = dbAppt.users.name;

  return extended;
};

export async function getAllAppointments() {
  const supabase = client();
  const { data, error } = await supabase.from('appointments').select(`
    *,
    dental_vehicles(vehicle_name),
    services(service_name),
    users(name)
  `);
  if (error) throw new Error(error.message);
  return data ? data.map(mapAppointment) : [];
}

export async function getAppointmentsByUser(userId: string) {
  const supabase = client();
  const { data, error } = await supabase.from('appointments').select(`
    *,
    dental_vehicles(vehicle_name),
    services(service_name),
    users(name)
  `).eq('user_id', userId);
  if (error) throw new Error(error.message);
  return data ? data.map(mapAppointment) : [];
}

export async function getAppointment(id: string) {
  const supabase = client();
  const { data, error } = await supabase.from('appointments').select('*').eq('appointment_id', parseInt(id)).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapAppointment(data) : null;
}

// Thrown when the DB unique index rejects a second booking for the same
// vehicle + date + time. The route turns this into a 409.
export class SlotConflictError extends Error {
  constructor() {
    super('Time slot already booked');
    this.name = 'SlotConflictError';
  }
}

export async function createAppointment(appt: any) {
  const supabase = client();
  const { data, error } = await supabase.from('appointments').insert({
    user_id: appt.user_id,
    vehicle_id: parseInt(appt.vehicle_id),
    service_id: parseInt(appt.service_id),
    appointment_date: appt.date,
    appointment_time: appt.time,
    status: appt.status || 'Pending',
    price: appt.price ?? null,
  }).select(`
    *,
    dental_vehicles(vehicle_name),
    services(service_name),
    users(name)
  `).maybeSingle();
  if (error) {
    // 23505 = unique_violation — the partial unique index on
    // (vehicle_id, appointment_date, appointment_time) WHERE status <> 'Cancelled'.
    if (error.code === '23505') throw new SlotConflictError();
    throw new Error(`createAppointment failed: ${error.message}`);
  }
  if (!data) throw new Error('createAppointment: insert succeeded but no data returned (check RLS policies on appointments)');
  return mapAppointment(data);
}

export async function updateAppointment(id: string, updates: any) {
  const supabase = client();
  const dbUpdates: any = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.price !== undefined) dbUpdates.price = updates.price;

  const { data, error } = await supabase.from('appointments').update(dbUpdates).eq('appointment_id', parseInt(id)).select(`
    *,
    dental_vehicles(vehicle_name),
    services(service_name),
    users(name)
  `).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapAppointment(data) : null;
}

export async function deleteAppointment(id: string) {
  const supabase = client();
  const { error } = await supabase.from('appointments').delete().eq('appointment_id', parseInt(id));
  if (error) throw new Error(error.message);
}

export async function hasAppointmentConflict(vehicleId: string, date: string, time: string) {
  const supabase = client();
  const { data, error } = await supabase.from('appointments')
    .select('appointment_id')
    .eq('vehicle_id', parseInt(vehicleId))
    .eq('appointment_date', date)
    .eq('appointment_time', time)
    .neq('status', 'Cancelled')
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return !!data;
}
