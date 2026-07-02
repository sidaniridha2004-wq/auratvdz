import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X, Lock } from "lucide-react";
import { useAdmin } from "@/lib/admin";

/**
 * Global hotkey (Ctrl+Shift+A) → open admin login modal.
 * Also renders the modal itself when open.
 */
export function AdminHotkey() {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const { login, isAdmin } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-card p-6 shadow-glow">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-bold">Admin access</h2>
          </div>
          <button aria-label="Close" onClick={() => { setOpen(false); setPw(""); setErr(false); }} className="rounded-full p-1 text-muted-foreground hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Enter the admin password to manage channels.</p>
        {isAdmin ? (
          <div className="mt-4 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">
            You're already signed in as admin.
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => { setOpen(false); navigate({ to: "/admin" }); }}
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >Open panel</button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await login(pw)) { setOpen(false); setPw(""); setErr(false); navigate({ to: "/admin" }); }
              else setErr(true);
            }}
            className="mt-4 space-y-3"
          >
            <input
              type="password"
              autoFocus
              value={pw}
              onChange={(e) => { setPw(e.target.value); setErr(false); }}
              placeholder="Password"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {err && <div className="text-xs font-semibold text-red-400">Access denied</div>}
            <button type="submit" className="w-full rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground">
              Sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
