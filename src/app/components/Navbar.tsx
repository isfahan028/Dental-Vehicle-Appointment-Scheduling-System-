import { useState } from 'react';
import { NavLink } from 'react-router';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';

function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'font-bold underline' : 'hover:text-blue-100';

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block py-2 ${isActive ? 'font-bold underline' : 'hover:text-blue-100'}`;

  return (
    <nav className="bg-blue-600 text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <NavLink to="/" className="text-xl font-bold flex items-center gap-2" onClick={closeMobile}>
          <span>🦷</span>
          <span>DentalMove</span>
        </NavLink>

        {/* Desktop nav */}
        <div className="hidden lg:flex gap-4 items-center">
          <NavLink to="/" className={linkClass}>
            Home
          </NavLink>
          <NavLink to="/calendar" className={linkClass}>
            Availability
          </NavLink>
          {user && (
            <>
              <NavLink to="/appointments" className={linkClass}>
                My Appointments
              </NavLink>
              <NavLink to="/book" className={linkClass}>
                Book Now
              </NavLink>
              <NavLink to="/recurring" className={linkClass}>
                Recurring
              </NavLink>
            </>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={linkClass}>
              Admin Dashboard
            </NavLink>
          )}

          <div className="border-l border-blue-400 pl-4 flex gap-2">
            {!user ? (
              <>
                <NavLink to="/login">
                  <Button variant="ghost" className="text-white hover:bg-blue-700">Login</Button>
                </NavLink>
                <NavLink to="/register">
                  <Button variant="secondary" className="bg-white text-blue-600 hover:bg-blue-50">Register</Button>
                </NavLink>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-sm">Hi, {user.name}</span>
                  {isAdmin && <span className="text-xs bg-yellow-400 text-gray-900 px-2 py-0.5 rounded font-bold">Admin</span>}
                </div>
                <Button onClick={logout} variant="ghost" size="sm" className="text-white hover:bg-blue-700 border border-blue-400">
                  Logout
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile hamburger toggle */}
        <button
          type="button"
          className="lg:hidden p-2 -mr-2"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-blue-500 px-4 pb-4">
          <NavLink to="/" className={mobileLinkClass} onClick={closeMobile}>
            Home
          </NavLink>
          <NavLink to="/calendar" className={mobileLinkClass} onClick={closeMobile}>
            Availability
          </NavLink>
          {user && (
            <>
              <NavLink to="/appointments" className={mobileLinkClass} onClick={closeMobile}>
                My Appointments
              </NavLink>
              <NavLink to="/book" className={mobileLinkClass} onClick={closeMobile}>
                Book Now
              </NavLink>
              <NavLink to="/recurring" className={mobileLinkClass} onClick={closeMobile}>
                Recurring
              </NavLink>
            </>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={mobileLinkClass} onClick={closeMobile}>
              Admin Dashboard
            </NavLink>
          )}

          <div className="border-t border-blue-500 mt-2 pt-3">
            {!user ? (
              <div className="flex gap-2">
                <NavLink to="/login" className="flex-1" onClick={closeMobile}>
                  <Button variant="ghost" className="w-full text-white hover:bg-blue-700 border border-blue-400">Login</Button>
                </NavLink>
                <NavLink to="/register" className="flex-1" onClick={closeMobile}>
                  <Button variant="secondary" className="w-full bg-white text-blue-600 hover:bg-blue-50">Register</Button>
                </NavLink>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-sm">Hi, {user.name}</span>
                  {isAdmin && <span className="text-xs bg-yellow-400 text-gray-900 px-2 py-0.5 rounded font-bold w-fit mt-1">Admin</span>}
                </div>
                <Button
                  onClick={() => {
                    closeMobile();
                    logout();
                  }}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-blue-700 border border-blue-400"
                >
                  Logout
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
