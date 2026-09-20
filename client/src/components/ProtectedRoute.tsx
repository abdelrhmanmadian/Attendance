import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function ProtectedRoute() {
  const { manager, loading } = useAuth();

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading...</div>;
  }
  if (!manager) {
    return <Navigate to="/login" replace />;
  }
  if (manager.mustChangePassword) {
    return <Navigate to="/force-password-change" replace />;
  }
  return <Outlet />;
}
