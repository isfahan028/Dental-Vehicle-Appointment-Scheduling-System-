import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';

/**
 * Route guard for pages that require a logged-in user (e.g. the booking flow).
 * While the session is still being validated we show a spinner; once we know
 * there is no user we redirect to /login, remembering where the user was
 * heading so they can be sent back after a successful login.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        <p className="text-gray-500 mt-4">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search, reason: 'booking' }}
      />
    );
  }

  return <>{children}</>;
}
