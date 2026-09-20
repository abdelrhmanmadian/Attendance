import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const navItems = [
  { to: "/manager/today", label: "Today" },
  { to: "/manager/schedule", label: "Schedule" },
  { to: "/manager/doctors", label: "Doctors" },
  { to: "/manager/reports", label: "Reports" },
  { to: "/manager/audit-log", label: "Audit Log" },
  { to: "/manager/settings", label: "Settings" },
];

export default function ManagerLayout() {
  const { manager, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <nav className="md:w-56 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex md:flex-col">
        <div className="p-4 font-bold text-slate-800 hidden md:block">Attendance</div>
        <ul className="flex md:flex-col overflow-x-auto md:overflow-visible flex-1">
          {navItems.map((item) => (
            <li key={item.to} className="flex-1 md:flex-none">
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `block px-4 py-3 text-sm text-center md:text-left whitespace-nowrap ${
                    isActive ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-600 hover:bg-slate-50"
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="hidden md:block p-4 border-t border-slate-200 text-xs text-slate-500">
          <div className="mb-2 truncate">{manager?.email}</div>
          <button onClick={logout} className="text-red-600 hover:underline">
            Log out
          </button>
        </div>
      </nav>
      <main className="flex-1 p-4 md:p-8 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
