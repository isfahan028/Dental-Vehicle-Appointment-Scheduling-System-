import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';

interface RequireAuthProps {
  children: ReactNode;
  /** Also require the logged-in user to be an admin. */
  requireAdmin?: boolean;
}

/**
 * Route guard for pages that require a logged-in user (e.g. the booking flow),
 * optionally an admin (`requireAdmin`).
 *
 * While the session is still being validated we show a spinner — this is what
 * stops a hard refresh on a guarded page from bouncing the user out before
 * AuthContext has restored their session from localStorage. Once we know there
 * is no user we redirect to /login, remembering where they were heading so they
 * can be sent back after a successful login. A logged-in non-admin hitting an
 * admin-only page is sent home.
 */
export default function RequireAuth({ children, requireAdmin = false }: RequireAuthProps) {
  const { user, isAdmin, loading } = useAuth();
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
        state={{
          from: location.pathname + location.search,
          reason: requireAdmin ? 'admin' : 'booking',
        }}
      />
    );
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
