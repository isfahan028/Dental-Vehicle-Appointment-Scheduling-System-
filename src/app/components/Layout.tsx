import React from 'react';
import { Outlet } from 'react-router';
import Navbar from './Navbar';
import { AuthProvider } from '../context/AuthContext';
import { Toaster } from 'sonner';

export default function Layout() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-8">
          <Outlet />
        </main>
        <footer className="bg-gray-800 text-gray-300 py-6">
          <div className="container mx-auto px-4 text-center">
            <p>&copy; {new Date().getFullYear()} Dental Vehicle Appointment Scheduling System.</p>
          </div>
        </footer>
        <Toaster position="top-center" />
      </div>
    </AuthProvider>
  );
}
