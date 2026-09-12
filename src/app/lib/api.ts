import { projectId, publicAnonKey } from "../utils/supabase/info";
import type { User, DentalVehicle, Service, Appointment, AppointmentStatus, RecurringRequest, RecurringRequestResult } from '../types';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-e95806c6`;

// Helper to get auth headers.
// IMPORTANT: Supabase's API gateway validates the Authorization header as a JWT,
// so we MUST always send publicAnonKey there. Our custom session token goes in
// a separate X-Session-Token header so it bypasses gateway JWT validation.
function getAuthHeaders(sessionToken?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
  };

  if (sessionToken) {
    headers['X-Session-Token'] = sessionToken;
  }

  return headers;
}

// ===== AUTH API =====

export async function signUp(email: string, password: string, name: string, phone: string) {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ email, password, name, phone }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Sign up failed');
  }

  return data;
}

export async function signIn(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/signin`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Sign in failed');
  }

  return data;
}

export async function getCurrentUser(accessToken: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/user`, {
    headers: getAuthHeaders(accessToken),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to get user');
  }

  return data.user;
}

export async function signOut(accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/auth/signout`, {
    method: 'POST',
    headers: getAuthHeaders(accessToken),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Sign out failed');
  }

  return data;
}

// ===== VEHICLE API =====

export async function getVehicles(): Promise<DentalVehicle[]> {
  const response = await fetch(`${API_BASE_URL}/vehicles`, {
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch vehicles');
  }

  return data.vehicles;
}

export async function getVehicle(id: string): Promise<DentalVehicle> {
  const response = await fetch(`${API_BASE_URL}/vehicles/${id}`, {
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch vehicle');
  }

  return data.vehicle;
}

export async function createVehicle(vehicleData: Omit<DentalVehicle, 'id'>, accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/vehicles`, {
    method: 'POST',
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(vehicleData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to create vehicle');
  }

  return data;
}

export async function updateVehicle(id: string, updates: Partial<DentalVehicle>, accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/vehicles/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(updates),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to update vehicle');
  }

  return data;
}

export async function deleteVehicle(id: string, accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/vehicles/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(accessToken),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to delete vehicle');
  }

  return data;
}

// ===== SERVICE API =====

export async function getServices(): Promise<Service[]> {
  const response = await fetch(`${API_BASE_URL}/services`, {
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch services');
  }

  return data.services;
}

export async function getService(id: string): Promise<Service> {
  const services = await getServices();
  const service = services.find(s => s.id === id);
  
  if (!service) {
    throw new Error('Service not found');
  }
  
  return service;
}

export async function createService(serviceData: Omit<Service, 'id'>, accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/services`, {
    method: 'POST',
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(serviceData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to create service');
  }

  return data;
}

export async function updateService(id: string, updates: Partial<Service>, accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/services/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(updates),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to update service');
  }

  return data;
}

export async function deleteService(id: string, accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/services/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(accessToken),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to delete service');
  }

  return data;
}

// ===== APPOINTMENT API =====

export async function getAppointments(accessToken: string): Promise<Appointment[]> {
  const response = await fetch(`${API_BASE_URL}/appointments`, {
    headers: getAuthHeaders(accessToken),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch appointments');
  }

  return data.appointments;
}

export async function createAppointment(
  appointmentData: {
    vehicle_id: string;
    service_id: string;
    date: string;
    time: string;
  },
  accessToken: string
) {
  const response = await fetch(`${API_BASE_URL}/appointments`, {
    method: 'POST',
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(appointmentData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to create appointment');
  }

  return data;
}

export async function updateAppointment(
  id: string,
  status: AppointmentStatus,
  accessToken: string
) {
  const response = await fetch(`${API_BASE_URL}/appointments/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify({ status }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to update appointment');
  }

  return data;
}

// Admin only: set a per-appointment price override.
export async function setAppointmentPrice(id: string, price: number, accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/appointments/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify({ price }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to update price');
  }

  return data;
}

export async function deleteAppointment(id: string, accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/appointments/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(accessToken),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to delete appointment');
  }

  return data;
}

// ===== RECURRING APPOINTMENT REQUESTS API =====

export async function createRecurringRequest(
  data: {
    vehicle_id: string;
    service_id: string;
    start_date: string;
    time: string;
    months_requested: number;
  },
  accessToken: string
) {
  const response = await fetch(`${API_BASE_URL}/recurring-requests`, {
    method: 'POST',
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to submit recurring request');
  }

  return result as { request: RecurringRequest; message: string };
}

export async function getRecurringRequests(accessToken: string): Promise<RecurringRequest[]> {
  const response = await fetch(`${API_BASE_URL}/recurring-requests`, {
    headers: getAuthHeaders(accessToken),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch recurring requests');
  }

  return data.requests;
}

// Admin only: approve or reject a request. Approving generates the actual
// appointments — the result says how many months were booked and which, if
// any, were skipped because that slot was already taken.
export async function reviewRecurringRequest(
  id: string,
  review: { status: 'Approved' | 'Rejected'; admin_note?: string },
  accessToken: string
): Promise<RecurringRequestResult> {
  const response = await fetch(`${API_BASE_URL}/recurring-requests/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(review),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to review recurring request');
  }

  return data;
}

export async function deleteRecurringRequest(id: string, accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/recurring-requests/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(accessToken),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to remove recurring request');
  }

  return data;
}

// ===== ADMIN API =====

export async function getAllUsers(accessToken: string): Promise<User[]> {
  const response = await fetch(`${API_BASE_URL}/admin/users`, {
    headers: getAuthHeaders(accessToken),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch users');
  }

  return data.users;
}

export async function updateUser(id: string, updates: Partial<User>, accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/admin/users/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(updates),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to update user');
  }

  return data;
}

export async function getDashboardStats(accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/admin/stats`, {
    headers: getAuthHeaders(accessToken),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch statistics');
  }

  return data.stats;
}

// ===== INITIALIZATION =====

export async function initializeSampleData() {
  const response = await fetch(`${API_BASE_URL}/init-data`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to initialize data');
  }

  return data;
}