import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { adminVerifyPassword } from "@/lib/channels.functions";

// Session-scoped admin flag. Uses sessionStorage so it survives navigation
// within the same tab but resets on close/refresh-to-new-tab. The password
// itself is validated server-side against process.env.ADMIN_PASSWORD — we
// never hardcode it in client-bundled source.
const KEY = "auratv:admin";
const PW_KEY = "auratv:admin:pw";

interface Ctx {
  isAdmin: boolean;
  login: (pw: string) => Promise<boolean>;
  logout: () => void;
}
const AdminCtx = createContext<Ctx | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    try {
      // Only trust the admin flag if the password is still cached — otherwise
      // subsequent write calls would fail with Unauthorized.
      if (sessionStorage.getItem(KEY) === "1" && sessionStorage.getItem(PW_KEY)) {
        setIsAdmin(true);
      } else {
        sessionStorage.removeItem(KEY);
        sessionStorage.removeItem(PW_KEY);
      }
    } catch {}
  }, []);
  const login = useCallback(async (pw: string) => {
    try {
      const res = await adminVerifyPassword({ data: { password: pw } });
      if (res.ok) {
        setIsAdmin(true);
        try {
          sessionStorage.setItem(KEY, "1");
          sessionStorage.setItem(PW_KEY, pw);
        } catch {}
        return true;
      }
    } catch {}
    return false;
  }, []);
  const logout = useCallback(() => {
    setIsAdmin(false);
    try {
      sessionStorage.removeItem(KEY);
      sessionStorage.removeItem(PW_KEY);
    } catch {}
  }, []);
  const value = useMemo(() => ({ isAdmin, login, logout }), [isAdmin, login, logout]);
  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}

export function useAdmin(): Ctx {
  const c = useContext(AdminCtx);
  if (!c) return { isAdmin: false, login: async () => false, logout: () => {} };
  return c;
}
