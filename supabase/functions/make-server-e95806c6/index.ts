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

  // A deactivated account's sessions stop working immediately — not just
  // future logins — so re-check is_active on every request, not only signin.
  const profile = await db.getUser(session.user_id);
  if (!profile || !profile.is_active) {
    console.log('AUTH: Account is deactivated:', session.user_id);
    await db.deleteSession(token);
    return { userId: null, error: 'This account has been deactivated' };
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

    if (!userProfile.is_active) {
      console.log(`Sign in blocked - account deactivated: ${data.user.id}`);
      return c.json({ error: 'This account has been deactivated. Contact an administrator.' }, 403);
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
        // Snapshot the service price at booking time so later catalogue
        // edits never rewrite this appointment's cost.
        price: service.price ?? null,
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

// Update an appointment. Users may only cancel their own; admins may also
// change status and set a per-appointment price.
app.put('/make-server-e95806c6/appointments/:id', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);

  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  try {
    const id = c.req.param('id');
    const { status, price } = await c.req.json();

    const appointment = await db.getAppointment(id);

    if (!appointment) {
      return c.json({ error: 'Appointment not found' }, 404);
    }

    const userProfile = await db.getUser(userId);
    const isAdmin = userProfile?.role === 'admin';

    // Users can only act on their own appointments
    if (!isAdmin && appointment.user_id !== userId) {
      return c.json({ error: 'Not authorized to update this appointment' }, 403);
    }

    // Users can only cancel — no status changes, no price changes
    if (!isAdmin && (status !== 'Cancelled' || price !== undefined)) {
      return c.json({ error: 'Only cancellation is allowed' }, 403);
    }

    const updates: { status?: string; price?: number } = {};
    if (status !== undefined) updates.status = status;
    if (price !== undefined) {
      const p = Number(price);
      if (Number.isNaN(p) || p < 0) {
        return c.json({ error: 'Price must be a number of 0 or more' }, 400);
      }
      updates.price = p;
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: 'Nothing to update' }, 400);
    }

    const updatedAppointment = await db.updateAppointment(id, updates);

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

// ===== RECURRING APPOINTMENT REQUESTS =====

// Add `n` months to an ISO date string, clamping the day to the last day of
// the target month (e.g. Jan 31 + 1 month -> Feb 28/29). Plain date math so
// this needs no external date library.
function addMonthsClamped(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetIndex = m - 1 + n; // 0-based, can run past 11 or below 0
  const targetYear = y + Math.floor(targetIndex / 12);
  const targetMonth = ((targetIndex % 12) + 12) % 12; // 0-11
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(d, daysInTargetMonth);
  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Submit a recurring-appointment request (any authenticated user, for
// themselves). Stays Pending until an admin reviews it — no appointments
// are created yet.
app.post('/make-server-e95806c6/recurring-requests', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  try {
    const { vehicle_id, service_id, start_date, time, months_requested } = await c.req.json();

    if (!vehicle_id || !service_id || !start_date || !time || !months_requested) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const months = Number(months_requested);
    if (!Number.isInteger(months) || months < 1 || months > 24) {
      return c.json({ error: 'months_requested must be a whole number between 1 and 24' }, 400);
    }

    const vehicle = await db.getVehicle(vehicle_id);
    if (!vehicle) return c.json({ error: 'Vehicle not found' }, 404);

    const service = await db.getService(service_id);
    if (!service) return c.json({ error: 'Service not found' }, 404);

    const request = await db.createRecurringRequest({
      user_id: userId,
      vehicle_id,
      service_id,
      start_date,
      time,
      months_requested: months,
    });

    return c.json({ request, message: 'Recurring request submitted' });
  } catch (error) {
    console.error(`Error creating recurring request: ${error}`);
    return c.json({ error: `Failed to create recurring request: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// List requests: admins see everyone's, everyone else sees only their own.
app.get('/make-server-e95806c6/recurring-requests', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  try {
    const userProfile = await db.getUser(userId);
    const requests = userProfile?.role === 'admin'
      ? await db.getAllRecurringRequests()
      : await db.getRecurringRequestsByUser(userId);

    return c.json({ requests });
  } catch (error) {
    console.error(`Error fetching recurring requests: ${error}`);
    return c.json({ error: `Failed to fetch recurring requests: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Approve or reject a request (admin only, standing in for the dentist's
// sign-off). Approving generates the actual appointments, one per month,
// already Approved — skipping any month whose slot is already taken (the
// rest of the series still gets booked).
app.put('/make-server-e95806c6/recurring-requests/:id', async (c) => {
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
    const { status, admin_note, agreed_price } = await c.req.json();

    if (status !== 'Approved' && status !== 'Rejected') {
      return c.json({ error: "status must be 'Approved' or 'Rejected'" }, 400);
    }

    let agreedPrice: number | null = null;
    if (agreed_price !== undefined && agreed_price !== null && agreed_price !== '') {
      const p = Number(agreed_price);
      if (Number.isNaN(p) || p < 0) {
        return c.json({ error: 'agreed_price must be a number of 0 or more' }, 400);
      }
      agreedPrice = p;
    }

    const existing = await db.getRecurringRequest(id);
    if (!existing) return c.json({ error: 'Request not found' }, 404);
    if (existing.status !== 'Pending') {
      return c.json({ error: `Request has already been ${existing.status.toLowerCase()}` }, 409);
    }

    if (status === 'Rejected') {
      const request = await db.updateRecurringRequestStatus(id, {
        status: 'Rejected',
        admin_note: admin_note ?? null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      });
      return c.json({ request, createdCount: 0, skippedDates: [], message: 'Request rejected' });
    }

    // Approved: generate one appointment per month. A special per-month
    // price the admin sets here (a package rate for committing to the
    // series) overrides the service's catalogue price for every one of
    // them; leaving it blank keeps today's behaviour.
    const service = await db.getService(existing.service_id);
    if (!service) return c.json({ error: 'Service no longer exists' }, 404);

    const priceToUse = agreedPrice ?? service.price ?? null;

    const createdDates: string[] = [];
    const skippedDates: string[] = [];

    for (let i = 0; i < existing.months_requested; i++) {
      const date = addMonthsClamped(existing.start_date, i);
      const conflict = await db.hasAppointmentConflict(existing.vehicle_id, date, existing.time);
      if (conflict) {
        skippedDates.push(date);
        continue;
      }
      try {
        await db.createAppointment({
          user_id: existing.user_id,
          vehicle_id: existing.vehicle_id,
          service_id: existing.service_id,
          date,
          time: existing.time,
          status: 'Approved',
          price: priceToUse,
        });
        createdDates.push(date);
      } catch (err) {
        // Lost a last-moment race on this one month's slot — same
        // no-duplicate-booking guarantee a normal booking gets.
        if (err instanceof db.SlotConflictError) {
          skippedDates.push(date);
        } else {
          throw err;
        }
      }
    }

    const note = admin_note ??
      `Booked ${createdDates.length} of ${existing.months_requested} month(s)` +
      (agreedPrice != null ? ` at ${agreedPrice}/month (special rate).` : '.') +
      (skippedDates.length ? ` Skipped: ${skippedDates.join(', ')} (slot already booked).` : '');

    const request = await db.updateRecurringRequestStatus(id, {
      status: 'Approved',
      agreed_price: agreedPrice,
      admin_note: note,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    });

    return c.json({
      request,
      createdCount: createdDates.length,
      skippedDates,
      message: 'Request approved',
    });
  } catch (error) {
    console.error(`Error reviewing recurring request: ${error}`);
    return c.json({ error: `Failed to review recurring request: ${error instanceof Error ? error.message : String(error)}` }, 500);
  }
});

// Withdraw/remove a request — the owner may withdraw their own while it's
// still Pending; an admin may remove any of them at any time.
app.delete('/make-server-e95806c6/recurring-requests/:id', async (c) => {
  const { userId, error: authError } = await verifyAuth(c);
  if (authError || !userId) {
    return c.json({ error: authError || 'Unauthorized' }, 401);
  }

  try {
    const id = c.req.param('id');
    const existing = await db.getRecurringRequest(id);
    if (!existing) return c.json({ error: 'Request not found' }, 404);

    const userProfile = await db.getUser(userId);
    const isAdmin = userProfile?.role === 'admin';

    if (!isAdmin) {
      if (existing.user_id !== userId) {
        return c.json({ error: 'Not authorized to remove this request' }, 403);
      }
      if (existing.status !== 'Pending') {
        return c.json({ error: 'Only a pending request can be withdrawn' }, 403);
      }
    }

    await db.deleteRecurringRequest(id);
    return c.json({ message: 'Request removed' });
  } catch (error) {
    console.error(`Error deleting recurring request: ${error}`);
    return c.json({ error: `Failed to delete recurring request: ${error instanceof Error ? error.message : String(error)}` }, 500);
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

    // Demoting someone away from admin needs guardrails: never let the
    // acting admin lock themselves out mid-session, and never leave the
    // system with zero admins able to manage it.
    if (updates.role !== undefined && updates.role !== 'admin' && targetUser.role === 'admin') {
      if (id === userId) {
        return c.json({ error: "You can't change your own role." }, 403);
      }
      const adminCount = await db.countAdmins();
      if (adminCount <= 1) {
        return c.json({ error: 'Cannot remove the last admin.' }, 403);
      }
    }

    // Same idea for deactivating yourself: don't let an admin cut off their
    // own access mid-session.
    if (updates.is_active === false && id === userId) {
      return c.json({ error: "You can't deactivate your own account." }, 403);
    }

    const updatedUser = await db.updateUser(id, updates);

    // Deactivation takes effect immediately, not just for future logins:
    // kill every existing session for this user right now.
    if (updates.is_active === false) {
      await db.deleteSessionsByUser(id);
    }

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