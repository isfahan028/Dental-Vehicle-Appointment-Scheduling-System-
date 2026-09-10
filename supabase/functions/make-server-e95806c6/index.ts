import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as db from './db.ts';

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
async function verifyAuth(c: any) {
  const token = c.req.header('X-Session-Token');
  
  if (!token) {
    console.log('AUTH: No X-Session-Token header found');
    return { userId: null, error: 'No session token provided' };
  }
  
  // Look up the session in relational DB
  const session = await db.getSession(token);
  
  if (!session) {
    console.log('AUTH: Session not found for token:', token.substring(0, 20) + '...');
    return { userId: null, error: 'Invalid or expired session' };
  }
  
  // Check if session is expired (7 days)
  const sessionAge = Date.now() - new Date(session.created_at).getTime();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  if (sessionAge > maxAge) {
    console.log('AUTH: Session expired');
    await db.deleteSession(token);
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
      email_confirm: true,
    });

    if (authError) {
      console.log(`Error creating user during signup: ${authError.message}`);
      return c.json({ error: authError.message }, 400);
    }

    // Check if this is the first user - if so, make them admin
    const existingUsers = await db.getAllUsers();
    const role = existingUsers.length === 0 ? 'admin' : 'normal_user';

    // Store user profile in relational DB
    const userProfile = {
      id: authData.user.id,
      name,
      email,
      phone,
      role,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const createdUser = await db.createUser(userProfile);

    return c.json({ 
      user: createdUser,
      message: `User created successfully${role === 'admin' ? ' as admin' : ''}` 
    });
  } catch (error) {
    console.error(`Signup error: ${error}`);
    return c.json({ error: `Failed to create user: ${error instanceof Error ? error.message : String(error)}` }, 500);
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

    // Get user profile from relational DB
    const userProfile = await db.getUser(data.user.id);

    if (!userProfile) {
      return c.json({ error: 'User profile not found' }, 404);
    }

    // Generate our own simple token
    const customToken = generateToken();

    // Store session in relational DB
    await db.createSession(customToken, data.user.id);
    
    console.log(`User ${data.user.id} signed in successfully, session created`);

    return c.json({
      access_token: customToken,
      user: userProfile,
    });
  } catch (error) {
    console.error(`Sign in unexpected error: ${error}`);
    return c.json({ error: 'Sign in failed' }, 500);
  }
});

// Get current user session
app.get('/make-server-e95806c6/auth/user', async (c) => {
  const { userId, error } = await verifyAuth(c);
  
  if (error || !userId) {
    return c.json({ error: error || 'Unauthorized' }, 401);
  }

  const userProfile = await db.getUser(userId);
  
  if (!userProfile) {
    return c.json({ error: 'User profile not found' }, 404);
  }

  return c.json({ user: userProfile });
});

// Sign out
app.post('/make-server-e95806c6/auth/signout', async (c) => {
  const token = c.req.header('X-Session-Token');
  
  if (token) {
    await db.deleteSession(token);
    console.log('Session deleted successfully');
  }

  return c.json({ message: 'Signed out successfully' });
});

// ===== VEHICLE ROUTES =====

// Get all vehicles
app.get('/make-server-e95806c6/vehicles', async (c) => {
  try {
    const vehicles = await db.getAllVehicles();
    return c.json({ vehicles });
  } catch (error) {
    console.error(`Error fetching vehicles: ${error}`);
    return c.json({ error: `Failed to fetch vehicles: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Get single vehicle
app.get('/make-server-e95806c6/vehicles/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const vehicle = await db.getVehicle(id);
    
    if (!vehicle) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }
    
    return c.json({ vehicle });
  } catch (error) {
    console.error(`Error fetching vehicle: ${error}`);
    return c.json({ error: `Failed to fetch vehicle: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Create vehicle (admin only)
app.post('/make-server-e95806c6/vehicles', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  const userProfile = await db.getUser(userId);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const vehicleData = await c.req.json();
    const vehicle = await db.createVehicle(vehicleData);
    
    return c.json({ vehicle, message: 'Vehicle created successfully' });
  } catch (error) {
    console.error(`Error creating vehicle: ${error}`);
    return c.json({ error: `Failed to create vehicle: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Update vehicle (admin only)
app.put('/make-server-e95806c6/vehicles/:id', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  const userProfile = await db.getUser(userId);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    const existingVehicle = await db.getVehicle(id);
    
    if (!existingVehicle) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }

    const updates = await c.req.json();
    const updatedVehicle = await db.updateVehicle(id, updates);

    return c.json({ vehicle: updatedVehicle, message: 'Vehicle updated successfully' });
  } catch (error) {
    console.error(`Error updating vehicle: ${error}`);
    return c.json({ error: `Failed to update vehicle: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Delete vehicle (admin only). Refused if the vehicle still has appointments,
// so booking history is never silently cascaded away.
app.delete('/make-server-e95806c6/vehicles/:id', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);

  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  const userProfile = await db.getUser(userId);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    const existingVehicle = await db.getVehicle(id);

    if (!existingVehicle) {
      return c.json({ error: 'Vehicle not found' }, 404);
    }

    const apptCount = await db.countVehicleAppointments(id);
    if (apptCount > 0) {
      return c.json({
        error: `This vehicle has ${apptCount} appointment(s). Cancel or reassign them before deleting.`,
      }, 409);
    }

    await db.deleteVehicle(id);

    return c.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error(`Error deleting vehicle: ${error}`);
    return c.json({ error: `Failed to delete vehicle: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// ===== SERVICE ROUTES =====

// Get all services
app.get('/make-server-e95806c6/services', async (c) => {
  try {
    const services = await db.getAllServices();
    return c.json({ services });
  } catch (error) {
    console.error(`Error fetching services: ${error}`);
    return c.json({ error: `Failed to fetch services: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Create service (admin only)
app.post('/make-server-e95806c6/services', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  const userProfile = await db.getUser(userId);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const serviceData = await c.req.json();
    const service = await db.createService(serviceData);
    
    return c.json({ service, message: 'Service created successfully' });
  } catch (error) {
    console.error(`Error creating service: ${error}`);
    return c.json({ error: `Failed to create service: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Update service (admin only)
app.put('/make-server-e95806c6/services/:id', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);

  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  const userProfile = await db.getUser(userId);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    const existingService = await db.getService(id);

    if (!existingService) {
      return c.json({ error: 'Service not found' }, 404);
    }

    const updates = await c.req.json();
    const updatedService = await db.updateService(id, updates);

    return c.json({ service: updatedService, message: 'Service updated successfully' });
  } catch (error) {
    console.error(`Error updating service: ${error}`);
    return c.json({ error: `Failed to update service: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Delete service (admin only). Refused if the service still has appointments,
// so booking history is never silently cascaded away.
app.delete('/make-server-e95806c6/services/:id', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);

  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  const userProfile = await db.getUser(userId);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    const existingService = await db.getService(id);

    if (!existingService) {
      return c.json({ error: 'Service not found' }, 404);
    }

    const apptCount = await db.countServiceAppointments(id);
    if (apptCount > 0) {
      return c.json({
        error: `This service has ${apptCount} appointment(s). Reassign or cancel them before deleting.`,
      }, 409);
    }

    await db.deleteService(id);

    return c.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error(`Error deleting service: ${error}`);
    return c.json({ error: `Failed to delete service: ${error instanceof Error ? error.message : String(error)}` }, 500);
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
    const userProfile = await db.getUser(userId);
    
    // If admin, get all. Else, get by user (DB takes care of JOINs)
    let appointments;
    if (userProfile?.role === 'admin') {
      appointments = await db.getAllAppointments();
    } else {
      appointments = await db.getAppointmentsByUser(userId);
    }

    return c.json({ appointments });
  } catch (error) {
    console.error(`Error fetching appointments: ${error}`);
    return c.json({ error: `Failed to fetch appointments: ${error instanceof Error ? error.message : String(error)}` }, 500);
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
      vehicle_id, service_id, date, time
    });

    if (!vehicle_id || !service_id || !date || !time) {
      console.log('Missing required fields for appointment');
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Verify vehicle exists
    const vehicle = await db.getVehicle(vehicle_id);
    if (!vehicle) {
      console.log(`Vehicle not found: ${vehicle_id}`);
      return c.json({ error: 'Vehicle not found' }, 404);
    }

    // Verify service exists
    const service = await db.getService(service_id);
    if (!service) {
      console.log(`Service not found: ${service_id}`);
      return c.json({ error: 'Service not found' }, 404);
    }

    // Check for conflicts BEFORE creating anything.
    const hasConflict = await db.hasAppointmentConflict(vehicle_id, date, time);

    if (hasConflict) {
      console.log(`Time slot conflict for vehicle ${vehicle_id} on ${date} at ${time}`);
      return c.json({ error: 'Time slot already booked' }, 409);
    }

    let appointment;
    try {
      appointment = await db.createAppointment({
        user_id: userId,
        vehicle_id,
        service_id,
        date,
        time,
        status: 'Pending',
      });
    } catch (err) {
      // Lost the race: another request claimed the slot between the check
      // above and this insert, and the DB unique index rejected it.
      if (err instanceof db.SlotConflictError) {
        console.log(`Time slot race lost for vehicle ${vehicle_id} on ${date} at ${time}`);
        return c.json({ error: 'Time slot already booked' }, 409);
      }
      throw err;
    }

    console.log(`Appointment ${appointment.id} created successfully`);

    return c.json({
      appointment,
      message: 'Appointment created successfully'
    });
  } catch (error) {
    console.error(`Error creating appointment: ${error}`);
    return c.json({ error: `Failed to create appointment: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Update appointment status (admin only/cancel only for users)
app.put('/make-server-e95806c6/appointments/:id', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  try {
    const id = c.req.param('id');
    const { status } = await c.req.json();

    const appointment = await db.getAppointment(id);
    
    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    const userProfile = await db.getUser(userId);
    
    // Users can only cancel their own appointments
    // Admins can update any appointment status
    if (userProfile?.role !== 'admin' && appointment.user_id !== userId) {
      return c.json({ error: 'Not authorized to update this appointment' }, 403);
    }

    // Users can only cancel, not approve/complete
    if (userProfile?.role !== 'admin' && status !== 'Cancelled') {
      return c.json({ error: 'Only cancellation is allowed' }, 403);
    }

    const updatedAppointment = await db.updateAppointment(id, { status });

    return c.json({ 
      appointment: updatedAppointment, 
      message: 'Appointment updated successfully' 
    });
  } catch (error) {
    console.error(`Error updating appointment: ${error}`);
    return c.json({ error: `Failed to update appointment: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Delete appointment (admin only)
app.delete('/make-server-e95806c6/appointments/:id', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  const userProfile = await db.getUser(userId);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    await db.deleteAppointment(id);
    
    return c.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error(`Error deleting appointment: ${error}`);
    return c.json({ error: `Failed to delete appointment: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// ===== ADMIN ROUTES =====

// Get all users (admin only)
app.get('/make-server-e95806c6/admin/users', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  const userProfile = await db.getUser(userId);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const users = await db.getAllUsers();
    return c.json({ users });
  } catch (error) {
    console.error(`Error fetching users: ${error}`);
    return c.json({ error: `Failed to fetch users: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Update user status (admin only)
app.put('/make-server-e95806c6/admin/users/:id', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  const userProfile = await db.getUser(userId);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    
    const targetUser = await db.getUser(id);
    if (!targetUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    const updatedUser = await db.updateUser(id, updates);
    
    return c.json({ user: updatedUser, message: 'User updated successfully' });
  } catch (error) {
    console.error(`Error updating user: ${error}`);
    return c.json({ error: `Failed to update user: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Get dashboard statistics (admin only)
app.get('/make-server-e95806c6/admin/stats', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  const userProfile = await db.getUser(userId);
  if (!userProfile || userProfile.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const [users, appointments, vehicles] = await Promise.all([
      db.getAllUsers(),
      db.getAllAppointments(),
      db.getAllVehicles(),
    ]);

    const stats = {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.is_active).length,
      totalAppointments: appointments.length,
      pendingAppointments: appointments.filter(a => a.status === 'Pending').length,
      approvedAppointments: appointments.filter(a => a.status === 'Approved').length,
      completedAppointments: appointments.filter(a => a.status === 'Completed').length,
      totalVehicles: vehicles.length,
      availableVehicles: vehicles.filter(v => v.is_available).length,
    };

    return c.json({ stats });
  } catch (error) {
    console.error(`Error fetching stats: ${error}`);
    return c.json({ error: `Failed to fetch statistics: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Initialize sample data (development only)
app.post('/make-server-e95806c6/init-data', async (c) => {
  try {
    // Check if data already exists
    const existingVehicles = await db.getAllVehicles();
    if (existingVehicles.length > 0) {
      return c.json({ message: 'Data already initialized' });
    }

    // Initialize vehicles
    const vehiclesData = [
      {
        name: 'Dental Unit Alpha',
        location: 'Central Park Entrance',
        latitude: 40.7644,
        longitude: -73.9732,
        is_available: true,
        image_url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Dental Unit Beta',
        location: 'Downtown Square',
        latitude: 40.7128,
        longitude: -74.0060,
        is_available: true,
        image_url: 'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
      },
      {
        name: 'Mobile Clinic Gamma',
        location: 'Westside Community Center',
        latitude: 40.7484,
        longitude: -73.9857,
        is_available: true,
        image_url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      },
    ];

    const createVehicles = vehiclesData.map(v => db.createVehicle(v));
    const vehicles = await Promise.all(createVehicles);

    // Initialize services
    const servicesData = [
      {
        name: 'General Checkup',
        duration_minutes: 30,
        price: 50,
        description: 'Routine dental examination and consultation.',
      },
      {
        name: 'Cleaning & Polishing',
        duration_minutes: 45,
        price: 80,
        description: 'Professional teeth cleaning to remove plaque and tartar.',
      },
      {
        name: 'Filling',
        duration_minutes: 60,
        price: 120,
        description: 'Restoration of damaged teeth with filling material.',
      },
      {
        name: 'X-Ray',
        duration_minutes: 15,
        price: 40,
        description: 'Digital dental radiography.',
      },
    ];

    const createServices = servicesData.map(s => db.createService(s));
    const services = await Promise.all(createServices);

    return c.json({ 
      message: 'Sample data initialized successfully',
      vehiclesCount: vehicles.length,
      servicesCount: services.length,
    });
  } catch (error) {
    console.error(`Error initializing data: ${error}`);
    return c.json({ error: `Failed to initialize data: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Health check
app.get('/make-server-e95806c6/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database health check — tests if all relational tables exist
app.get('/make-server-e95806c6/health/db', async (c) => {
  const tables = ['users', 'dental_vehicles', 'services', 'appointments', 'sessions'];
  const results: Record<string, string> = {};
  
  for (const table of tables) {
    try {
      const { error } = await supabaseAdmin.from(table).select('*').limit(0);
      results[table] = error ? `ERROR: ${error.message}` : 'OK';
    } catch (err) {
      results[table] = `EXCEPTION: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  const allOk = Object.values(results).every(v => v === 'OK');
  return c.json({
    status: allOk ? 'healthy' : 'unhealthy',
    tables: results,
    hint: allOk ? 'All tables exist and are accessible' : 'Run 01_create_tables.sql in Supabase SQL Editor',
  }, allOk ? 200 : 503);
});

Deno.serve(app.fetch);