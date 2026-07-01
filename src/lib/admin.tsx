import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// Session-scoped admin flag. Uses sessionStorage so it survives navigation
// within the same tab but resets on close/refresh-to-new-tab.
const KEY = "auratv:admin";
const PASSWORD = "AuraTV@2026!";

interface Ctx {
  isAdmin: boolean;
  login: (pw: string) => boolean;
  logout: () => void;
}
const AdminCtx = createContext<Ctx | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    try { if (sessionStorage.getItem(KEY) === "1") setIsAdmin(true); } catch {}
  }, []);
  const login = useCallback((pw: string) => {
    if (pw === PASSWORD) {
      setIsAdmin(true);
      try { sessionStorage.setItem(KEY, "1"); } catch {}
      return true;
    }
    return false;
  }, []);
  const logout = useCallback(() => {
    setIsAdmin(false);
    try { sessionStorage.removeItem(KEY); } catch {}
  }, []);
  const value = useMemo(() => ({ isAdmin, login, logout }), [isAdmin, login, logout]);
  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}

export function useAdmin(): Ctx {
  const c = useContext(AdminCtx);
  if (!c) return { isAdmin: false, login: () => false, logout: () => {} };
  return c;
}
