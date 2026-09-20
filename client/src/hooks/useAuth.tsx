import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "../api/client";

export interface Manager {
  id: string;
  email: string;
  mustChangePassword: boolean;
}

interface AuthContextValue {
  manager: Manager | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Manager>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [manager, setManager] = useState<Manager | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const me = await api.get<Manager>("/auth/me");
      setManager(me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setManager(null);
      } else {
        throw err;
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const me = await api.post<Manager>("/auth/login", { email, password });
    setManager(me);
    return me;
  }

  async function logout() {
    await api.post("/auth/logout");
    setManager(null);
  }

  return (
    <AuthContext.Provider value={{ manager, loading, login, logout, refresh }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
