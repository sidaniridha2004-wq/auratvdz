import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { adminCheckSession, adminVerifyPassword } from "@/lib/channels.functions";

// The browser never stores the admin password. After sign-in it keeps a
// short-lived signed session token (sessionStorage, current tab only) and
// sends that token with each write. Rotating ADMIN_PASSWORD on the server
// invalidates all tokens immediately.
const TOKEN_KEY = "auratv:admin:token";

interface Ctx {
  isAdmin: boolean;
  ready: boolean;
  token: string;
  login: (pw: string) => Promise<boolean>;
  logout: () => void;
}
const AdminCtx = createContext<Ctx | null>(null);

function readToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readToken();
    if (!stored) {
      setReady(true);
      return;
    }
    let cancelled = false;
    adminCheckSession({ data: { token: stored } })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setToken(stored);
        else {
          try {
            sessionStorage.removeItem(TOKEN_KEY);
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (pw: string) => {
    try {
      const res = await adminVerifyPassword({ data: { password: pw } });
      if (res.ok) {
        setToken(res.token);
        try {
          sessionStorage.setItem(TOKEN_KEY, res.token);
        } catch {}
        return true;
      }
    } catch {}
    return false;
  }, []);

  const logout = useCallback(() => {
    setToken("");
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {}
  }, []);

  const value = useMemo<Ctx>(
    () => ({ isAdmin: token.length > 0, ready, token, login, logout }),
    [token, ready, login, logout],
  );
  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}

export function useAdmin(): Ctx {
  const c = useContext(AdminCtx);
  if (!c) return { isAdmin: false, ready: true, token: "", login: async () => false, logout: () => {} };
  return c;
}
