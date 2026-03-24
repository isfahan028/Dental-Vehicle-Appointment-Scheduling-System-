import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger(console.log));

// Initialize Supabase client for admin operations
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Helper to generate a simple secure token
function generateToken() {
  const randomPart = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  const timePart = Date.now().toString(36);
  return `mts_${timePart}_${randomPart}`;
}

// Helper function to verify user authentication
// Reads the custom session token from X-Session-Token header.
// We do NOT use the Authorization header for our session token because
// Supabase's API gateway intercepts it and rejects non-JWT values.
async function verifyAuth(c: any) {
  const token = c.req.header('X-Session-Token');
  
  if (!token) {
    console.log('AUTH: No X-Session-Token header found');
    return { userId: null, error: 'No session token provided' };
  }
  
  // Look up the session in KV store
  const session = await kv.get(`session:${token}`);
  
  if (!session) {
    console.log('AUTH: Session not found for token:', token.substring(0, 20) + '...');
    return { userId: null, error: 'Invalid or expired session' };
  }
  
  // Check if session is expired (7 days)
  const sessionAge = Date.now() - new Date(session.created_at).getTime();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  if (sessionAge > maxAge) {
    console.log('AUTH: Session expired');
    await kv.del(`session:${token}`);
    return { userId: null, error: 'Session expired' };
  }

  console.log('AUTH: User verified:', session.user_id);
  return { userId: session.user_id, error: null };
}

// ===== AUTH ROUTES =====

// Sign up new user
app.post('/make-server-e95806c6/auth/signup', async (c) => {
  try {
    const { email, password, name, phone } = await c.req.json();

    if (!email || !password || !name || !phone) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, phone },
      // Automatically confirm email since email server hasn't been configured
      email_confirm: true,
    });

    if (authError) {
      console.log(`Error creating user during signup: ${authError.message}`);
      return c.json({ error: authError.message }, 400);
    }

    // Check if this is the first user - if so, make them admin
    const existingUsers = await kv.getByPrefix('user:');
    const role = (!existingUsers || existingUsers.length === 0) ? 'admin' : 'normal_user';

    // Store user profile in KV store
    const userProfile = {
      id: authData.user.id,
      name,
      email,
      phone,
      role,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    await kv.set(`user:${authData.user.id}`, userProfile);

    return c.json({ 
      user: userProfile,
      message: `User created successfully${role === 'admin' ? ' as admin' : ''}` 
    });
  } catch (error) {
    console.log(`Signup error: ${error}`);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// Sign in
app.post('/make-server-e95806c6/auth/signin', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Missing email or password' }, 400);
    }

    // Sign in with Supabase
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log(`Sign in error: ${error.message}`);
      return c.json({ error: error.message }, 401);
    }

    // Get user profile from KV store
    const userProfile = await kv.get(`user:${data.user.id}`);

    if (!userProfile) {
      return c.json({ error: 'User profile not found' }, 404);
    }

    // Generate our own simple token
    const customToken = generateToken();

    // Store session in KV store with our custom token
    const session = {
      user_id: data.user.id,
      created_at: new Date().toISOString(),
    };

    await kv.set(`session:${customToken}`, session);
    
    console.log(`User ${data.user.id} signed in successfully, session created`);

    return c.json({
      access_token: customToken,
      user: userProfile,
    });
  } catch (error) {
    console.log(`Sign in unexpected error: ${error}`);
    return c.json({ error: 'Sign in failed' }, 500);
  }
});

// Get current user session
app.get('/make-server-e95806c6/auth/user', async (c) => {
  const { userId, error } = await verifyAuth(c);
  
  if (error || !userId) {
    return c.json({ error: error || 'Unauthorized' }, 401);
  }

  const userProfile = await kv.get(`user:${userId}`);
  
  if (!userProfile) {
    return c.json({ error: 'User profile not found' }, 404);
  }

  return c.json({ user: userProfile });
});

// Sign out
app.post('/make-server-e95806c6/auth/signout', async (c) => {
  const token = c.req.header('X-Session-Token');
  
  if (token) {
    await kv.del(`session:${token}`);
    console.log('Session deleted successfully');
  }

  return c.json({ message: 'Signed out successfully' });
});

// ===== VEHICLE ROUTES =====

// Get all vehicles
app.get('/make-server-e95806c6/vehicles', async (c) => {
  try {
    const vehicles = await kv.getByPrefix('vehicle:');
    return c.json({ vehicles: vehicles || [] });
  } catch (error) {
    console.log(`Error fetching vehicles: ${error}`);
    return c.json({ error: 'Failed to fetch vehicles' }, 500);
  }
});

// Get single vehicle
app.get('/make-server-e95806c6/vehicles/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const vehicle = await kv.get(`vehicle:${id}`);
    
    if (!vehicle) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }
    
    return c.json({ vehicle });
  } catch (error) {
    console.log(`Error fetching vehicle: ${error}`);
    return c.json({ error: 'Failed to fetch vehicle' }, 500);
  }
});

// Create vehicle (admin only)
app.post('/make-server-e95806c6/vehicles', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  const userProfile = await kv.get(`user:${userId}`);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const vehicleData = await c.req.json();
    const vehicleId = `v-${Date.now()}`;
    
    const vehicle = {
      id: vehicleId,
      ...vehicleData,
    };

    await kv.set(`vehicle:${vehicleId}`, vehicle);
    
    return c.json({ vehicle, message: 'Vehicle created successfully' });
  } catch (error) {
    console.log(`Error creating vehicle: ${error}`);
    return c.json({ error: 'Failed to create vehicle' }, 500);
  }
});

// Update vehicle (admin only)
app.put('/make-server-e95806c6/vehicles/:id', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  const userProfile = await kv.get(`user:${userId}`);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    const existingVehicle = await kv.get(`vehicle:${id}`);
    
    if (!existingVehicle) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }

    const updates = await c.req.json();
    const updatedVehicle = { ...existingVehicle, ...updates, id };

    await kv.set(`vehicle:${id}`, updatedVehicle);
    
    return c.json({ vehicle: updatedVehicle, message: 'Vehicle updated successfully' });
  } catch (error) {
    console.log(`Error updating vehicle: ${error}`);
    return c.json({ error: 'Failed to update vehicle' }, 500);
  }
});

// ===== SERVICE ROUTES =====

// Get all services
app.get('/make-server-e95806c6/services', async (c) => {
  try {
    const services = await kv.getByPrefix('service:');
    return c.json({ services: services || [] });
  } catch (error) {
    console.log(`Error fetching services: ${error}`);
    return c.json({ error: 'Failed to fetch services' }, 500);
  }
});

// Create service (admin only)
app.post('/make-server-e95806c6/services', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  const userProfile = await kv.get(`user:${userId}`);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const serviceData = await c.req.json();
    const serviceId = `s-${Date.now()}`;
    
    const service = {
      id: serviceId,
      ...serviceData,
    };

    await kv.set(`service:${serviceId}`, service);
    
    return c.json({ service, message: 'Service created successfully' });
  } catch (error) {
    console.log(`Error creating service: ${error}`);
    return c.json({ error: 'Failed to create service' }, 500);
  }
});

// ===== APPOINTMENT ROUTES =====

// Get user's appointments
app.get('/make-server-e95806c6/appointments', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  try {
    const userProfile = await kv.get(`user:${userId}`);
    const allAppointments = await kv.getByPrefix('appointment:');
    
    let appointments = allAppointments || [];

    // If not admin, filter to only user's appointments
    if (userProfile?.role !== 'admin') {
      appointments = appointments.filter(apt => apt.user_id === userId);
    }

    // Enrich appointments with vehicle and service names
    const enrichedAppointments = await Promise.all(
      appointments.map(async (apt) => {
        const vehicle = await kv.get(`vehicle:${apt.vehicle_id}`);
        const service = await kv.get(`service:${apt.service_id}`);
        const appointmentUser = await kv.get(`user:${apt.user_id}`);
        
        return {
          ...apt,
          vehicle_name: vehicle?.name,
          service_name: service?.name,
          user_name: appointmentUser?.name,
        };
      })
    );

    return c.json({ appointments: enrichedAppointments });
  } catch (error) {
    console.log(`Error fetching appointments: ${error}`);
    return c.json({ error: 'Failed to fetch appointments' }, 500);
  }
});

// Create appointment
app.post('/make-server-e95806c6/appointments', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    console.log(`Appointment creation - Authorization error: ${authError || 'No user'}`);
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  try {
    const { vehicle_id, service_id, date, time } = await c.req.json();

    console.log(`Appointment creation request from user ${userId}:`, {
      vehicle_id,
      service_id,
      date,
      time
    });

    if (!vehicle_id || !service_id || !date || !time) {
      console.log('Missing required fields for appointment');
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Verify vehicle exists
    const vehicle = await kv.get(`vehicle:${vehicle_id}`);
    if (!vehicle) {
      console.log(`Vehicle not found: ${vehicle_id}`);
      return c.json({ error: 'Vehicle not found' }, 404);
    }

    // Verify service exists
    const service = await kv.get(`service:${service_id}`);
    if (!service) {
      console.log(`Service not found: ${service_id}`);
      return c.json({ error: 'Service not found' }, 404);
    }

    // Check for conflicts
    const allAppointments = await kv.getByPrefix('appointment:');
    const hasConflict = allAppointments?.some(
      apt => apt.vehicle_id === vehicle_id && 
             apt.date === date && 
             apt.time === time &&
             apt.status !== 'Cancelled'
    );

    if (hasConflict) {
      console.log(`Time slot conflict for vehicle ${vehicle_id} on ${date} at ${time}`);
      return c.json({ error: 'Time slot already booked' }, 409);
    }

    const appointmentId = `a-${Date.now()}`;
    const appointment = {
      id: appointmentId,
      user_id: userId,
      vehicle_id,
      service_id,
      date,
      time,
      status: 'Pending',
      created_at: new Date().toISOString(),
    };

    await kv.set(`appointment:${appointmentId}`, appointment);
    console.log(`Appointment ${appointmentId} created successfully`);

    // Enrich response
    const userProfile = await kv.get(`user:${userId}`);

    const enrichedAppointment = {
      ...appointment,
      vehicle_name: vehicle?.name,
      service_name: service?.name,
      user_name: userProfile?.name,
    };

    return c.json({ 
      appointment: enrichedAppointment, 
      message: 'Appointment created successfully' 
    });
  } catch (error) {
    console.log(`Error creating appointment: ${error}`);
    return c.json({ error: 'Failed to create appointment' }, 500);
  }
});

// Update appointment status (admin only)
app.put('/make-server-e95806c6/appointments/:id', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  try {
    const id = c.req.param('id');
    const { status } = await c.req.json();

    const appointment = await kv.get(`appointment:${id}`);
    
    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    const userProfile = await kv.get(`user:${userId}`);
    
    // Users can only cancel their own appointments
    // Admins can update any appointment status
    if (userProfile?.role !== 'admin' && appointment.user_id !== userId) {
      return c.json({ error: 'Not authorized to update this appointment' }, 403);
    }

    // Users can only cancel, not approve/complete
    if (userProfile?.role !== 'admin' && status !== 'Cancelled') {
      return c.json({ error: 'Only cancellation is allowed' }, 403);
    }

    const updatedAppointment = {
      ...appointment,
      status,
    };

    await kv.set(`appointment:${id}`, updatedAppointment);

    return c.json({ 
      appointment: updatedAppointment, 
      message: 'Appointment updated successfully' 
    });
  } catch (error) {
    console.log(`Error updating appointment: ${error}`);
    return c.json({ error: 'Failed to update appointment' }, 500);
  }
});

// Delete appointment (admin only)
app.delete('/make-server-e95806c6/appointments/:id', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  const userProfile = await kv.get(`user:${userId}`);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    await kv.del(`appointment:${id}`);
    
    return c.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.log(`Error deleting appointment: ${error}`);
    return c.json({ error: 'Failed to delete appointment' }, 500);
  }
});

// ===== ADMIN ROUTES =====

// Get all users (admin only)
app.get('/make-server-e95806c6/admin/users', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  const userProfile = await kv.get(`user:${userId}`);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const users = await kv.getByPrefix('user:');
    return c.json({ users: users || [] });
  } catch (error) {
    console.log(`Error fetching users: ${error}`);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// Update user status (admin only)
app.put('/make-server-e95806c6/admin/users/:id', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  const userProfile = await kv.get(`user:${userId}`);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    
    const targetUser = await kv.get(`user:${id}`);
    if (!targetUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    const updatedUser = { ...targetUser, ...updates, id };
    await kv.set(`user:${id}`, updatedUser);
    
    return c.json({ user: updatedUser, message: 'User updated successfully' });
  } catch (error) {
    console.log(`Error updating user: ${error}`);
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

// Get dashboard statistics (admin only)
app.get('/make-server-e95806c6/admin/stats', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  const userProfile = await kv.get(`user:${userId}`);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const users = await kv.getByPrefix('user:');
    const appointments = await kv.getByPrefix('appointment:');
    const vehicles = await kv.getByPrefix('vehicle:');

    const stats = {
      totalUsers: users?.length || 0,
      activeUsers: users?.filter(u => u.is_active).length || 0,
      totalAppointments: appointments?.length || 0,
      pendingAppointments: appointments?.filter(a => a.status === 'Pending').length || 0,
      approvedAppointments: appointments?.filter(a => a.status === 'Approved').length || 0,
      completedAppointments: appointments?.filter(a => a.status === 'Completed').length || 0,
      totalVehicles: vehicles?.length || 0,
      availableVehicles: vehicles?.filter(v => v.is_available).length || 0,
    };

    return c.json({ stats });
  } catch (error) {
    console.log(`Error fetching stats: ${error}`);
    return c.json({ error: 'Failed to fetch statistics' }, 500);
  }
});

// Initialize sample data (development only)
app.post('/make-server-e95806c6/init-data', async (c) => {
  try {
    // Check if data already exists
    const existingVehicles = await kv.getByPrefix('vehicle:');
    if (existingVehicles && existingVehicles.length > 0) {
      return c.json({ message: 'Data already initialized' });
    }

    // Initialize vehicles
    const vehicles = [
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
        is_available: false,
        image_url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      },
    ];

    for (const vehicle of vehicles) {
      await kv.set(`vehicle:${vehicle.id}`, vehicle);
    }

    // Initialize services
    const services = [
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
      },
    ];

    for (const service of services) {
      await kv.set(`service:${service.id}`, service);
    }

    return c.json({ 
      message: 'Sample data initialized successfully',
      vehiclesCount: vehicles.length,
      servicesCount: services.length,
    });
  } catch (error) {
    console.log(`Error initializing data: ${error}`);
    return c.json({ error: 'Failed to initialize data' }, 500);
  }
});

// Health check
app.get('/make-server-e95806c6/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

Deno.serve(app.fetch);