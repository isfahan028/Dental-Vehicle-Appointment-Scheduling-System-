import { useCallback, useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';
import type { Appointment, AppointmentStatus, DentalVehicle, RecurringRequest, Role, Service, User as UserType } from '../types';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { VehicleFormModal } from '../components/admin/VehicleFormModal';
import { ServiceFormModal } from '../components/admin/ServiceFormModal';
import { Calendar, Clock, MapPin, User, Settings, AlertCircle, Activity, Search, Tag, Pencil, Repeat, ChevronLeft, ChevronRight } from 'lucide-react';
import { buildMonthGrid, monthLabel, toDateKey } from '../lib/slots';
import { withRetry } from '../lib/retry';

const APPOINTMENT_FILTERS = ['All', 'Pending', 'Approved', 'Completed', 'Cancelled'] as const;
type AppointmentFilter = (typeof APPOINTMENT_FILTERS)[number];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
import { toast } from 'sonner';
import { useRealtimeRefetch } from '../hooks/useRealtime';
import { usePolling } from '../hooks/usePolling';

export default function AdminDashboard() {
  const { user, isAdmin, accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'appointments' | 'calendar' | 'vehicles' | 'services' | 'requests' | 'users'>('appointments');
  const [apptFilter, setApptFilter] = useState<AppointmentFilter>('All');
  const [apptSearch, setApptSearch] = useState('');
  const [editingPrice, setEditingPrice] = useState<{ id: string; value: string } | null>(null);
  // null = closed; { vehicle: null } = add; { vehicle: X } = edit
  const [vehicleForm, setVehicleForm] = useState<{ vehicle: DentalVehicle | null } | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<DentalVehicle | null>(null);
  const [serviceForm, setServiceForm] = useState<{ service: Service | null } | null>(null);
  const [deletingService, setDeletingService] = useState<Service | null>(null);
  const [roleChange, setRoleChange] = useState<{ user: UserType; nextRole: Role } | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<UserType | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ request: RecurringRequest; action: 'Approved' | 'Rejected' } | null>(null);
  const [agreedPriceInput, setAgreedPriceInput] = useState('');
  const [bulkPriceTarget, setBulkPriceTarget] = useState<RecurringRequest | null>(null);
  const [bulkPriceInput, setBulkPriceInput] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [bulkPriceBusy, setBulkPriceBusy] = useState(false);
  const now = useMemo(() => new Date(), []);
  const [calYear, setCalYear] = useState(() => now.getFullYear());
  const [calMonth, setCalMonth] = useState(() => now.getMonth());
  const [calVehicleFilter, setCalVehicleFilter] = useState('all');
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [vehicles, setVehicles] = useState<DentalVehicle[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [recurringRequests, setRecurringRequests] = useState<RecurringRequest[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const canLoad = !!user && isAdmin && !!accessToken;

  const loadAll = useCallback(async () => {
    if (!accessToken) return;

    // allSettled, not all: one tab's data failing to load (e.g. a bad embed
    // query) shouldn't blank out every other tab too. Each call also gets one
    // retry — a cold-starting edge function or a dropped request can fail a
    // handful of these together (usually the token-checking ones) for no
    // real reason, and a short retry clears that up before it ever becomes
    // a user-visible error.
    const [appointmentsRes, vehiclesRes, servicesRes, requestsRes, usersRes] = await Promise.allSettled([
      withRetry(() => api.getAppointments(accessToken)),
      withRetry(() => api.getVehicles()),
      withRetry(() => api.getServices()),
      withRetry(() => api.getAllRecurringRequests(accessToken)),
      withRetry(() => api.getAllUsers(accessToken)),
    ]);

    if (appointmentsRes.status === 'fulfilled') setAppointments(appointmentsRes.value);
    if (vehiclesRes.status === 'fulfilled') setVehicles(vehiclesRes.value);
    if (servicesRes.status === 'fulfilled') setServices(servicesRes.value);
    if (requestsRes.status === 'fulfilled') setRecurringRequests(requestsRes.value);
    if (usersRes.status === 'fulfilled') setUsers(usersRes.value);

    const failed = [appointmentsRes, vehiclesRes, servicesRes, requestsRes, usersRes]
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed.length > 0) {
      failed.forEach(r => console.error('Failed to load admin data:', r.reason));
      toast.error(
        failed.length === 5
          ? 'Failed to load dashboard data'
          : `Some dashboard data failed to load (${failed.length} of 5)`,
      );
    }

    setIsLoading(false);
  }, [accessToken]);

  const refetchAppointments = useCallback(async () => {
    if (!accessToken) return;
    try {
      setAppointments(await api.getAppointments(accessToken));
    } catch (error) {
      console.error('Failed to refresh appointments:', error);
    }
  }, [accessToken]);

  useEffect(() => {
    if (canLoad) loadAll();
  }, [canLoad, loadAll]);

  // Appointments change often while an admin is working — push updates instantly.
  useRealtimeRefetch('appointments', refetchAppointments, { enabled: canLoad });
  // Vehicles / users change rarely — a periodic refresh is enough.
  usePolling(loadAll, { intervalMs: 30_000, enabled: canLoad });

  // Client-side filter + search + newest-first sort for the appointments table.
  const visibleAppointments = useMemo(() => {
    const q = apptSearch.trim().toLowerCase();
    return appointments
      .filter(a => apptFilter === 'All' || a.status === apptFilter)
      .filter(a => {
        if (!q) return true;
        return (
          (a.user_name ?? '').toLowerCase().includes(q) ||
          (a.service_name ?? '').toLowerCase().includes(q) ||
          (a.vehicle_name ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  }, [appointments, apptFilter, apptSearch]);

  // Appointments grouped by date ("YYYY-MM-DD"), for the Calendar tab —
  // filtered by vehicle if one is picked, sorted by time within the day.
  const calAppointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      if (calVehicleFilter !== 'all' && a.vehicle_id !== calVehicleFilter) continue;
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [appointments, calVehicleFilter]);

  const calGrid = useMemo(() => buildMonthGrid(calYear, calMonth), [calYear, calMonth]);
  const todayKey = toDateKey(now);
  const calAtCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth();

  const shiftCalMonth = (delta: number) => {
    const d = new Date(calYear, calMonth + delta, 1);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setSelectedCalDate(null);
  };

  // Tints the whole day cell, not just a small dot, so busy days are
  // obvious at a glance. Priority: needs-attention statuses win, so a mixed
  // day still reads as "something to do here" rather than defaulting to a
  // pale, ambiguous color.
  function calDayTone(dayAppts: Appointment[]): string {
    if (dayAppts.length === 0) return 'bg-gray-50 hover:bg-gray-100';
    const has = (s: AppointmentStatus) => dayAppts.some((a) => a.status === s);
    if (has('Pending')) return 'bg-yellow-100 hover:ring-2 hover:ring-yellow-400';
    if (has('Approved')) return 'bg-green-100 hover:ring-2 hover:ring-green-400';
    if (has('Completed')) return 'bg-blue-100 hover:ring-2 hover:ring-blue-400';
    return 'bg-gray-200 hover:ring-2 hover:ring-gray-400';
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-500 mt-4">Loading dashboard...</p>
      </div>
    );
  }

  const handleStatusChange = async (id: string, newStatus: AppointmentStatus) => {
    if (!accessToken) return;

    try {
      await api.updateAppointment(id, newStatus, accessToken);
      
      setAppointments(prev => 
        prev.map(a => a.id === id ? { ...a, status: newStatus } : a)
      );
      
      toast.success(`Appointment marked as ${newStatus}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update appointment');
    }
  };

  const savePrice = async () => {
    if (!accessToken || !editingPrice) return;

    const p = Number(editingPrice.value);
    if (editingPrice.value.trim() === '' || Number.isNaN(p) || p < 0) {
      toast.error('Price must be a number of 0 or more');
      return;
    }

    const { id } = editingPrice;
    try {
      await api.setAppointmentPrice(id, p, accessToken);
      setAppointments(prev => prev.map(a => (a.id === id ? { ...a, price: p } : a)));
      toast.success('Price updated');
      setEditingPrice(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update price');
    }
  };

  const handleVehicleSaved = (saved: DentalVehicle) => {
    setVehicles(prev =>
      prev.some(v => v.id === saved.id)
        ? prev.map(v => (v.id === saved.id ? saved : v))
        : [...prev, saved],
    );
    setVehicleForm(null);
    toast.success('Vehicle saved');
  };

  const confirmDeleteVehicle = async () => {
    if (!accessToken || !deletingVehicle) return;

    setDeleteBusy(true);
    try {
      await api.deleteVehicle(deletingVehicle.id, accessToken);
      setVehicles(prev => prev.filter(v => v.id !== deletingVehicle.id));
      toast.success('Vehicle deleted');
    } catch (error) {
      // e.g. 409 when the vehicle still has appointments
      toast.error(error instanceof Error ? error.message : 'Failed to delete vehicle');
    } finally {
      setDeleteBusy(false);
      setDeletingVehicle(null);
    }
  };

  const handleServiceSaved = (saved: Service) => {
    setServices(prev =>
      prev.some(s => s.id === saved.id)
        ? prev.map(s => (s.id === saved.id ? saved : s))
        : [...prev, saved],
    );
    setServiceForm(null);
    toast.success('Service saved');
  };

  const confirmDeleteService = async () => {
    if (!accessToken || !deletingService) return;

    setDeleteBusy(true);
    try {
      await api.deleteService(deletingService.id, accessToken);
      setServices(prev => prev.filter(s => s.id !== deletingService.id));
      toast.success('Service deleted');
    } catch (error) {
      // e.g. 409 when the service still has appointments
      toast.error(error instanceof Error ? error.message : 'Failed to delete service');
    } finally {
      setDeleteBusy(false);
      setDeletingService(null);
    }
  };

  const setUserActive = async (id: string, isActive: boolean) => {
    if (!accessToken) return;

    try {
      await api.updateUser(id, { is_active: isActive }, accessToken);
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, is_active: isActive } : u)));
      toast.success(isActive ? 'User activated' : 'User deactivated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update user');
    }
  };

  // Activating is harmless and immediate. Deactivating locks someone out of
  // their own account, so it goes through a confirmation first.
  const activateUser = (id: string) => setUserActive(id, true);

  const confirmDeactivateUser = async () => {
    if (!deactivatingUser) return;
    setStatusBusy(true);
    try {
      await setUserActive(deactivatingUser.id, false);
    } finally {
      setStatusBusy(false);
      setDeactivatingUser(null);
    }
  };

  const confirmRoleChange = async () => {
    if (!accessToken || !roleChange) return;

    setRoleBusy(true);
    try {
      const res = await api.updateUser(roleChange.user.id, { role: roleChange.nextRole }, accessToken);
      setUsers(prev => prev.map(u => (u.id === roleChange.user.id ? (res.user as UserType) : u)));
      toast.success(
        `${roleChange.user.name} is now ${roleChange.nextRole === 'admin' ? 'an admin' : 'a patient'}`,
      );
    } catch (error) {
      // e.g. 403 from the self-demotion / last-admin guardrails
      toast.error(error instanceof Error ? error.message : 'Failed to update role');
    } finally {
      setRoleBusy(false);
      setRoleChange(null);
    }
  };

  const confirmReview = async () => {
    if (!accessToken || !reviewTarget) return;

    let agreedPrice: number | undefined;
    if (reviewTarget.action === 'Approved' && agreedPriceInput.trim() !== '') {
      const p = Number(agreedPriceInput);
      if (Number.isNaN(p) || p < 0) {
        toast.error('Special price must be a number of 0 or more');
        return;
      }
      agreedPrice = p;
    }

    setReviewBusy(true);
    try {
      const result = await api.reviewRecurringRequest(
        reviewTarget.request.id,
        { status: reviewTarget.action, agreed_price: agreedPrice },
        accessToken,
      );
      setRecurringRequests(prev =>
        prev.map(r => (r.id === reviewTarget.request.id ? result.request : r)),
      );

      if (reviewTarget.action === 'Approved') {
        const rateNote = agreedPrice != null ? ` at ฿${agreedPrice}/month` : '';
        toast.success(
          result.skippedDates.length > 0
            ? `Booked ${result.createdCount} of ${reviewTarget.request.months_requested} month(s)${rateNote}. Skipped: ${result.skippedDates.join(', ')} (already booked).`
            : `Booked all ${result.createdCount} month(s)${rateNote}.`,
        );
        // New appointments were created behind the scenes — refresh the list.
        refetchAppointments();
      } else {
        toast.success('Request rejected');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to review request');
    } finally {
      setReviewBusy(false);
      setReviewTarget(null);
      setAgreedPriceInput('');
    }
  };

  const confirmBulkPrice = async () => {
    if (!accessToken || !bulkPriceTarget) return;

    const p = Number(bulkPriceInput);
    if (bulkPriceInput.trim() === '' || Number.isNaN(p) || p < 0) {
      toast.error('Price must be a number of 0 or more');
      return;
    }

    setBulkPriceBusy(true);
    try {
      const result = await api.updateRecurringRequestPrice(bulkPriceTarget.id, p, accessToken);
      setRecurringRequests(prev =>
        prev.map(r => (r.id === bulkPriceTarget.id ? result.request : r)),
      );
      if (result.updatedCount > 0) {
        toast.success(`Updated price for ${result.updatedCount} appointment(s)`);
        refetchAppointments();
      } else {
        toast.error(
          'No linked appointments found — this request was approved before this feature existed. Edit each month individually in Appointments instead.',
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update price');
    } finally {
      setBulkPriceBusy(false);
      setBulkPriceTarget(null);
      setBulkPriceInput('');
    }
  };

  // Stats Calculation
  const totalAppointments = appointments.length;
  const pendingAppointments = appointments.filter(a => a.status === 'Pending').length;
  const activeVehicles = vehicles.filter(v => v.is_available).length;
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const pendingRequestCount = recurringRequests.filter(r => r.status === 'Pending').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500">Manage your dental fleet and appointments.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg flex-wrap">
          {(['appointments', 'calendar', 'vehicles', 'services', 'requests', 'users'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all capitalize flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
              {tab === 'requests' && pendingRequestCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-yellow-400 text-yellow-900 text-xs font-bold">
                  {pendingRequestCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-full text-blue-600">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Bookings</p>
            <p className="text-2xl font-bold text-gray-900">{totalAppointments}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="bg-yellow-100 p-3 rounded-full text-yellow-600">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Pending Actions</p>
            <p className="text-2xl font-bold text-gray-900">{pendingAppointments}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="bg-green-100 p-3 rounded-full text-green-600">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Active Vehicles</p>
            <p className="text-2xl font-bold text-gray-900">{activeVehicles} / {vehicles.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="bg-purple-100 p-3 rounded-full text-purple-600">
            <User size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
          </div>
        </div>
      </div>

      {activeTab === 'appointments' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 space-y-4">
            <h3 className="font-bold text-gray-900">
              Appointments
              <span className="ml-2 text-sm font-normal text-gray-400">
                Showing {visibleAppointments.length} of {appointments.length}
              </span>
            </h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={apptSearch}
                  onChange={(e) => setApptSearch(e.target.value)}
                  placeholder="Search patient, service or vehicle…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto">
                {APPOINTMENT_FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setApptFilter(f)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                      apptFilter === f
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {visibleAppointments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                      {appointments.length === 0
                        ? 'No appointments yet.'
                        : 'No appointments match your filters.'}
                    </td>
                  </tr>
                )}
                {visibleAppointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{appt.user_name || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">{appt.user_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{appt.service_name}</div>
                      <div className="text-sm text-gray-500">{appt.vehicle_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{appt.date}</div>
                      <div className="text-sm text-gray-500">{appt.time}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {editingPrice?.id === appt.id ? (
                        <span className="flex items-center gap-1">
                          <span className="text-gray-400">฿</span>
                          <input
                            autoFocus
                            type="text"
                            inputMode="decimal"
                            value={editingPrice.value}
                            onChange={(e) => setEditingPrice({ id: appt.id, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') savePrice();
                              if (e.key === 'Escape') setEditingPrice(null);
                            }}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button onClick={savePrice} className="text-green-600 hover:underline">Save</button>
                          <button onClick={() => setEditingPrice(null)} className="text-gray-400 hover:underline">Cancel</button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingPrice({ id: appt.id, value: appt.price != null ? String(appt.price) : '' })}
                          className="group inline-flex items-center gap-1 text-gray-900 hover:text-blue-600"
                          title="Edit price"
                        >
                          {appt.price != null ? `฿${appt.price}` : <span className="text-gray-400">—</span>}
                          <Pencil size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${appt.status === 'Approved' ? 'bg-green-100 text-green-800' : 
                          appt.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 
                          appt.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'}`}>
                        {appt.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {appt.status === 'Pending' && (
                        <Button size="sm" onClick={() => handleStatusChange(appt.id, 'Approved')} className="bg-green-600 hover:bg-green-700 text-white">
                          Approve
                        </Button>
                      )}
                      {appt.status === 'Approved' && (
                        <Button size="sm" onClick={() => handleStatusChange(appt.id, 'Completed')} className="bg-blue-600 hover:bg-blue-700 text-white">
                          Complete
                        </Button>
                      )}
                      {(appt.status === 'Pending' || appt.status === 'Approved') && (
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleStatusChange(appt.id, 'Cancelled')}>
                          Cancel
                        </Button>
                      )}
                      {(appt.status === 'Completed' || appt.status === 'Cancelled') && (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'calendar' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              Vehicle
              <select
                value={calVehicleFilter}
                onChange={(e) => {
                  setCalVehicleFilter(e.target.value);
                  setSelectedCalDate(null);
                }}
                className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All vehicles</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-2">
              <button
                onClick={() => shiftCalMonth(-1)}
                className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="min-w-[10rem] text-center font-semibold text-gray-800">
                {monthLabel(calYear, calMonth)}
              </span>
              <button
                onClick={() => shiftCalMonth(1)}
                className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
              {!calAtCurrentMonth && (
                <button
                  onClick={() => { setCalYear(now.getFullYear()); setCalMonth(now.getMonth()); setSelectedCalDate(null); }}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Today
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-gray-700">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> Pending</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-600" /> Approved</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Completed</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gray-500" /> Cancelled</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center text-xs font-semibold uppercase tracking-wider text-gray-400 py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {calGrid.map((date) => {
                const key = toDateKey(date);
                const inMonth = date.getMonth() === calMonth;
                const isToday = key === todayKey;
                const isSelected = selectedCalDate === key;
                const dayAppts = calAppointmentsByDate.get(key) ?? [];
                const statusesPresent = new Set(dayAppts.map((a) => a.status));

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedCalDate(isSelected ? null : key)}
                    className={[
                      'relative flex flex-col rounded-xl p-2 min-h-[4.5rem] sm:min-h-[5rem] text-left transition-all',
                      calDayTone(dayAppts),
                      inMonth ? '' : 'opacity-40',
                      isSelected ? 'ring-2 ring-blue-600' : '',
                      isToday ? 'outline outline-2 outline-offset-1 outline-blue-500' : '',
                    ].join(' ')}
                  >
                    <span className="text-sm font-bold text-gray-800">{date.getDate()}</span>
                    {dayAppts.length > 0 && (
                      <span className="mt-auto space-y-1">
                        <span className="flex gap-1 flex-wrap">
                          {statusesPresent.has('Pending') && <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 ring-2 ring-white" />}
                          {statusesPresent.has('Approved') && <span className="h-2.5 w-2.5 rounded-full bg-green-600 ring-2 ring-white" />}
                          {statusesPresent.has('Completed') && <span className="h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white" />}
                          {statusesPresent.has('Cancelled') && <span className="h-2.5 w-2.5 rounded-full bg-gray-500 ring-2 ring-white" />}
                        </span>
                        <span className="block text-[11px] font-bold text-gray-700">
                          {dayAppts.length} appt{dayAppts.length > 1 ? 's' : ''}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedCalDate && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900">
                {(() => {
                  const [y, m, d] = selectedCalDate.split('-').map(Number);
                  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                  });
                })()}
              </h3>

              {(calAppointmentsByDate.get(selectedCalDate) ?? []).length === 0 ? (
                <p className="text-sm text-gray-400">No appointments on this day.</p>
              ) : (
                <div className="space-y-3">
                  {(calAppointmentsByDate.get(selectedCalDate) ?? []).map((appt) => (
                    <div
                      key={appt.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-gray-100 p-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{appt.time}</span>
                          <span className="text-gray-400">·</span>
                          <span className="text-sm text-gray-700">{appt.user_name || 'Unknown'}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              appt.status === 'Approved' ? 'bg-green-100 text-green-800' :
                              appt.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                              appt.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {appt.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {appt.service_name} · {appt.vehicle_name}
                          {appt.price != null && <> · ฿{appt.price}</>}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center">
                        {appt.status === 'Pending' && (
                          <Button size="sm" onClick={() => handleStatusChange(appt.id, 'Approved')} className="bg-green-600 hover:bg-green-700 text-white">
                            Approve
                          </Button>
                        )}
                        {appt.status === 'Approved' && (
                          <Button size="sm" onClick={() => handleStatusChange(appt.id, 'Completed')} className="bg-blue-600 hover:bg-blue-700 text-white">
                            Complete
                          </Button>
                        )}
                        {(appt.status === 'Pending' || appt.status === 'Approved') && (
                          <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleStatusChange(appt.id, 'Cancelled')}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'vehicles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map((vehicle) => (
            <div key={vehicle.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-gray-900">{vehicle.name}</h3>
                <span className={`px-2 py-1 text-xs rounded font-bold ${vehicle.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {vehicle.is_available ? 'Active' : 'Maintenance'}
                </span>
              </div>
              <div className="space-y-2 text-gray-600 mb-6">
                <p className="flex items-center gap-2 text-sm"><MapPin size={16} /> {vehicle.location}</p>
                <p className="flex items-center gap-2 text-sm"><Clock size={16} /> 9AM - 5PM</p>
                {vehicle.latitude != null && vehicle.longitude != null && (
                  <p className="text-xs text-gray-400">
                    {vehicle.latitude}, {vehicle.longitude}
                  </p>
                )}
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVehicleForm({ vehicle })}
                >
                  Edit Details
                </Button>
                <div className="flex items-center gap-3">
                  <Link
                    to={`/calendar?vehicleId=${vehicle.id}`}
                    className="text-blue-600 text-sm font-medium hover:underline"
                  >
                    View Schedule
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDeletingVehicle(vehicle)}
                    className="text-red-600 text-sm font-medium hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setVehicleForm({ vehicle: null })}
            className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-all min-h-[200px]"
          >
            <div className="bg-gray-100 p-4 rounded-full mb-3">
              <Settings className="w-6 h-6" />
            </div>
            <span className="font-medium">+ Add New Vehicle</span>
          </button>
        </div>
      )}

      {activeTab === 'services' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div key={service.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-bold text-gray-900">{service.name}</h3>
                <span className="text-lg font-bold text-blue-600">฿{service.price ?? 0}</span>
              </div>
              <div className="space-y-2 text-gray-600 mb-6">
                <p className="flex items-center gap-2 text-sm"><Clock size={16} /> {service.duration_minutes} min</p>
                {service.description && (
                  <p className="text-sm text-gray-500">{service.description}</p>
                )}
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setServiceForm({ service })}
                >
                  Edit Details
                </Button>
                <button
                  type="button"
                  onClick={() => setDeletingService(service)}
                  className="text-red-600 text-sm font-medium hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setServiceForm({ service: null })}
            className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-all min-h-[200px]"
          >
            <div className="bg-gray-100 p-4 rounded-full mb-3">
              <Tag className="w-6 h-6" />
            </div>
            <span className="font-medium">+ Add New Service</span>
          </button>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Repeat size={20} className="text-blue-600" />
            <h3 className="font-bold text-gray-900">Recurring Appointment Requests</h3>
          </div>

          {recurringRequests.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
              No recurring requests yet.
            </div>
          ) : (
            [...recurringRequests]
              .sort((a, b) => {
                if (a.status === 'Pending' && b.status !== 'Pending') return -1;
                if (a.status !== 'Pending' && b.status === 'Pending') return 1;
                return b.created_at.localeCompare(a.created_at);
              })
              .map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900">{r.user_name || 'Unknown'}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          r.status === 'Pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : r.status === 'Approved'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {r.service_name} · {r.vehicle_name}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} /> starts {r.start_date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} /> {r.time}
                      </span>
                      <span>{r.months_requested} month(s)</span>
                      {r.agreed_price != null && (
                        <span className="font-semibold text-blue-600">฿{r.agreed_price}/month (special rate)</span>
                      )}
                    </div>
                    {r.admin_note && (
                      <p className="text-sm text-gray-500 italic">&quot;{r.admin_note}&quot;</p>
                    )}
                  </div>

                  {r.status === 'Pending' && (
                    <div className="flex gap-2 self-start md:self-center">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => setReviewTarget({ request: r, action: 'Approved' })}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => setReviewTarget({ request: r, action: 'Rejected' })}
                      >
                        Reject
                      </Button>
                    </div>
                  )}

                  {r.status === 'Approved' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="self-start md:self-center"
                      onClick={() => {
                        setBulkPriceTarget(r);
                        setBulkPriceInput(r.agreed_price != null ? String(r.agreed_price) : '');
                      }}
                    >
                      Edit price for all months
                    </Button>
                  )}
                </div>
              ))
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{u.role.replace('_', ' ')}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    {u.role === 'normal_user' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRoleChange({ user: u, nextRole: 'admin' })}
                      >
                        Promote to Admin
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={u.id === user?.id || adminCount <= 1}
                        title={
                          u.id === user?.id
                            ? "You can't change your own role"
                            : adminCount <= 1
                              ? 'Cannot remove the last admin'
                              : undefined
                        }
                        onClick={() => setRoleChange({ user: u, nextRole: 'normal_user' })}
                      >
                        Demote to Patient
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={u.is_active && u.id === user?.id}
                      title={u.is_active && u.id === user?.id ? "You can't deactivate your own account" : undefined}
                      onClick={() => (u.is_active ? setDeactivatingUser(u) : activateUser(u.id))}
                      className={u.is_active ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {vehicleForm && accessToken && (
        <VehicleFormModal
          vehicle={vehicleForm.vehicle}
          accessToken={accessToken}
          onClose={() => setVehicleForm(null)}
          onSaved={handleVehicleSaved}
        />
      )}

      {deletingVehicle && (
        <ConfirmDialog
          danger
          title="Delete this vehicle?"
          message={`"${deletingVehicle.name}" will be permanently removed. This can't be undone.`}
          confirmLabel="Delete"
          busy={deleteBusy}
          onConfirm={confirmDeleteVehicle}
          onCancel={() => setDeletingVehicle(null)}
        />
      )}

      {serviceForm && accessToken && (
        <ServiceFormModal
          service={serviceForm.service}
          accessToken={accessToken}
          onClose={() => setServiceForm(null)}
          onSaved={handleServiceSaved}
        />
      )}

      {deletingService && (
        <ConfirmDialog
          danger
          title="Delete this service?"
          message={`"${deletingService.name}" will be permanently removed. This can't be undone.`}
          confirmLabel="Delete"
          busy={deleteBusy}
          onConfirm={confirmDeleteService}
          onCancel={() => setDeletingService(null)}
        />
      )}

      {roleChange && (
        <ConfirmDialog
          danger={roleChange.nextRole !== 'admin'}
          title={roleChange.nextRole === 'admin' ? 'Promote to admin?' : 'Demote to patient?'}
          message={
            roleChange.nextRole === 'admin'
              ? `"${roleChange.user.name}" will get full admin access to this dashboard.`
              : `"${roleChange.user.name}" will lose admin access and become a regular patient.`
          }
          confirmLabel={roleChange.nextRole === 'admin' ? 'Promote' : 'Demote'}
          busy={roleBusy}
          onConfirm={confirmRoleChange}
          onCancel={() => setRoleChange(null)}
        />
      )}

      {deactivatingUser && (
        <ConfirmDialog
          danger
          title="Deactivate this user?"
          message={`"${deactivatingUser.name}" will be signed out everywhere and won't be able to log back in until reactivated.`}
          confirmLabel="Deactivate"
          busy={statusBusy}
          onConfirm={confirmDeactivateUser}
          onCancel={() => setDeactivatingUser(null)}
        />
      )}

      {reviewTarget && (
        <ConfirmDialog
          danger={reviewTarget.action === 'Rejected'}
          title={reviewTarget.action === 'Approved' ? 'Approve this request?' : 'Reject this request?'}
          message={
            reviewTarget.action === 'Approved'
              ? `Books ${reviewTarget.request.months_requested} month(s) of "${reviewTarget.request.service_name}" for ${reviewTarget.request.user_name}, starting ${reviewTarget.request.start_date}. Any month whose slot is already taken will be skipped.`
              : `"${reviewTarget.request.user_name}"'s request will be marked rejected. No appointments will be created.`
          }
          confirmLabel={reviewTarget.action === 'Approved' ? 'Approve' : 'Reject'}
          busy={reviewBusy}
          onConfirm={confirmReview}
          onCancel={() => {
            setReviewTarget(null);
            setAgreedPriceInput('');
          }}
        >
          {reviewTarget.action === 'Approved' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Special price per month{' '}
                <span className="font-normal text-gray-400">
                  (optional — leave blank to use the catalogue price
                  {(() => {
                    const svc = services.find(s => s.id === reviewTarget.request.service_id);
                    return svc?.price != null ? `, ฿${svc.price}` : '';
                  })()}
                  )
                </span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={agreedPriceInput}
                onChange={(e) => setAgreedPriceInput(e.target.value)}
                placeholder="e.g. 40"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                Applies to all {reviewTarget.request.months_requested} appointment(s) this creates.
              </p>
            </div>
          )}
        </ConfirmDialog>
      )}

      {bulkPriceTarget && (
        <ConfirmDialog
          title="Edit price for all months"
          message={`Sets the price for every appointment "${bulkPriceTarget.user_name}"'s "${bulkPriceTarget.service_name}" series generated (${bulkPriceTarget.months_requested} month(s)).`}
          confirmLabel="Update Price"
          busy={bulkPriceBusy}
          onConfirm={confirmBulkPrice}
          onCancel={() => {
            setBulkPriceTarget(null);
            setBulkPriceInput('');
          }}
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">New price per month</label>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={bulkPriceInput}
              onChange={(e) => setBulkPriceInput(e.target.value)}
              placeholder="e.g. 40"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Applies to every appointment linked to this request, whatever its current status.
            </p>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}