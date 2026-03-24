import React from 'react';
import { NavLink } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';

function Navbar() {
  const { user, isAdmin, logout } = useAuth();

  return (
    <nav className="bg-blue-600 text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <NavLink to="/" className="text-xl font-bold flex items-center gap-2">
          <span>🦷</span>
          <span>DentalMove</span>
        </NavLink>
        <div className="flex gap-4 items-center">
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive ? "font-bold underline" : "hover:text-blue-100"
            }
          >
            Home
          </NavLink>
          {user && (
            <>
              <NavLink
                to="/appointments"
                className={({ isActive }) =>
                  isActive ? "font-bold underline" : "hover:text-blue-100"
                }
              >
                My Appointments
              </NavLink>
              <NavLink
                to="/book"
                className={({ isActive }) =>
                  isActive ? "font-bold underline" : "hover:text-blue-100"
                }
              >
                Book Now
              </NavLink>
            </>
          )}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                isActive ? "font-bold underline" : "hover:text-blue-100"
              }
            >
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
      </div>
    </nav>
  );
}

export default Navbar;