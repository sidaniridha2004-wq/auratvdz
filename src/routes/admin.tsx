import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, LogOut, Plus, Trash2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { useAdmin } from "@/lib/admin";
import { useCustomChannels } from "@/lib/custom-channels";
import type { ChannelCategory } from "@/lib/channel-category";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin — AuraTV" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const HIDDEN_KEY = "auratv:admin:hidden";

function useHidden() {
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      if (raw) setHidden(JSON.parse(raw));
    } catch {}
  }, []);
  const toggle = (id: string) => {
    setHidden((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  return { hidden, toggle };
}

function AdminPage() {
  const { isAdmin, login, logout } = useAdmin();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const navigate = useNavigate();
  const { channels, add, remove } = useCustomChannels();
  const { hidden, toggle: toggleHidden } = useHidden();

  const [form, setForm] = useState({
    name: "",
    category: "sports" as ChannelCategory,
    logo: "",
    url: "",
    quality: "auto",
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-hero flex items-center justify-center px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (login(pw)) { setErr(false); } else setErr(true);
          }}
          className="w-full max-w-sm rounded-2xl border border-white/10 bg-card p-6 shadow-glow"
        >
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-5 w-5 text-primary" />
            <h1 className="font-display text-xl font-bold">Admin sign-in</h1>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Enter the admin password to continue.</p>
          <input
            type="password"
            autoFocus
            value={pw}
            onChange={(e) => { setPw(e.target.value); setErr(false); }}
            placeholder="Password"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {err && <div className="mt-2 text-xs font-semibold text-red-400">Access denied</div>}
          <button className="mt-4 w-full rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground">
            Sign in
          </button>
          <div className="mt-4 text-center">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Back to home
            </Link>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hero">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Restricted</div>
            <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-bold sm:text-4xl">
              Channel management <span className="text-yellow-400">🔒</span>
            </h1>
            <p className="text-sm text-muted-foreground">Add, edit, hide or delete channels. Public visitors cannot see this page.</p>
          </div>
          <button
            onClick={() => { logout(); navigate({ to: "/" }); }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>

        <section className="rounded-2xl border border-white/10 bg-card/60 p-5 mb-8">
          <h2 className="font-display text-lg font-bold mb-4 inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add new channel
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim() || !form.url.trim()) return;
              add({ name: form.name.trim(), category: form.category, logo: form.logo.trim() || undefined, sources: [{ quality: form.quality, url: form.url.trim() }] });
              setForm({ name: "", category: "sports", logo: "", url: "", quality: "auto" });
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <Field label="Name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary" />
            </Field>
            <Field label="Category">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ChannelCategory })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary">
                <option value="sports">Sports</option>
                <option value="movies">Movies</option>
                <option value="kids">Kids</option>
                <option value="news">News</option>
                <option value="general">General</option>
              </select>
            </Field>
            <Field label="Logo URL (optional)">
              <input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary" />
            </Field>
            <Field label="Quality">
              <select value={form.quality} onChange={(e) => setForm({ ...form, quality: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary">
                {["auto", "1080p", "720p", "480p", "360p"].map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </Field>
            <Field label="Stream URL (.m3u8)" full>
              <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://.../index.m3u8" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary" />
            </Field>
            <div className="sm:col-span-2">
              <button className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Save channel</button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold mb-3">Your channels ({channels.length})</h2>
          {channels.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-muted-foreground text-sm">
              No custom channels yet.
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                  <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Sources</th><th className="px-4 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody>
                  {channels.map((c) => {
                    const isHidden = hidden.includes(c.id);
                    return (
                      <tr key={c.id} className={`border-t border-white/5 ${isHidden ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-muted-foreground uppercase text-xs">{c.category}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.sources.length}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => toggleHidden(c.id)} className="mr-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10">
                            {isHidden ? <><Eye className="h-3 w-3" /> Show</> : <><EyeOff className="h-3 w-3" /> Hide</>}
                          </button>
                          <button onClick={() => remove(c.id)} className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/20">
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <Footer />
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}
