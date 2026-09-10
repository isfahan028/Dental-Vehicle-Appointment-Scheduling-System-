import { createBrowserRouter } from "react-router";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Booking from "./pages/Booking";
import Appointments from "./pages/Appointments";
import AdminDashboard from "./pages/AdminDashboard";
import AvailabilityCalendar from "./pages/AvailabilityCalendar";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "calendar", Component: AvailabilityCalendar },
      { path: "login", Component: Login },
      { path: "register", Component: Register },
      {
        path: "book",
        element: (
          <RequireAuth>
            <Booking />
          </RequireAuth>
        ),
      },
      { path: "appointments", Component: Appointments },
      { path: "admin", Component: AdminDashboard },
      { path: "*", Component: () => <div className="p-8 text-center text-xl">404 - Page Not Found</div> },
    ],
  },
]);
