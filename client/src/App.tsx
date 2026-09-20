import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import CheckIn from "./pages/CheckIn";
import Login from "./pages/Login";
import ForcePasswordChange from "./pages/ForcePasswordChange";
import ProtectedRoute from "./components/ProtectedRoute";
import ManagerLayout from "./pages/manager/Layout";
import Today from "./pages/manager/Today";
import Schedule from "./pages/manager/Schedule";
import Doctors from "./pages/manager/Doctors";
import Reports from "./pages/manager/Reports";
import AuditLog from "./pages/manager/AuditLog";
import Settings from "./pages/manager/Settings";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<CheckIn />} />
        <Route path="/login" element={<Login />} />
        <Route path="/force-password-change" element={<ForcePasswordChange />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/manager" element={<ManagerLayout />}>
            <Route index element={<Navigate to="today" replace />} />
            <Route path="today" element={<Today />} />
            <Route path="schedule" element={<Schedule />} />
            <Route path="doctors" element={<Doctors />} />
            <Route path="reports" element={<Reports />} />
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
