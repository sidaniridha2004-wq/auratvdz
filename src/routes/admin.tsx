import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Lock, LogOut, Plus, Trash2, Eye, EyeOff, ArrowLeft, Search, Pencil, X, Save } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { ChannelLogo } from "@/components/ChannelLogo";
import { useAdmin } from "@/lib/admin";
import { useCustomChannels } from "@/lib/custom-channels";
import { M3U_CHANNELS } from "@/lib/m3u-channels";
import { HIDDEN_KEY, OVERRIDES_KEY, OVERRIDES_EVENT, writeHidden, writeOverrides, type Override, type OverrideMap } from "@/lib/channel-overrides";

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
const OVERRIDES_KEY = "auratv:admin:overrides";
const PAGE_SIZE = 20;

// Full category list per spec
const ALL_CATEGORIES = [
  "beIN Sports MAX",
  "beIN Sports",
  "Canal+ France",
  "French TV",
  "Algeria TV",
  "MBC Entertainment",
  "MBC Movies",
  "MBC Drama",
  "MBC Kids",
  "MBC Regional",
  "OSN Movies",
  "Sports",
  "Movies",
  "Series",
  "Kids & Family",
  "News",
  "General",
  "Lifestyle & Doc",
  "Documentaries",
  "Maghreb",
];

interface Override {
  name?: string;
  category?: string;
  logo?: string;
  url?: string;
}
type OverrideMap = Record<string, Override>;

interface Row {
  id: string;           // stable id (slug for built-in, custom id for custom)
  name: string;
  category: string;
  logo?: string;
  url: string;
  builtin: boolean;
}

function useHidden() {
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      if (raw) setHidden(JSON.parse(raw));
    } catch {}
  }, []);
  const set = (next: string[]) => {
    setHidden(next);
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch {}
  };
  const toggle = (id: string) => {
    set(hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id]);
  };
  const setMany = (ids: string[], active: boolean) => {
    const s = new Set(hidden);
    if (active) ids.forEach((i) => s.delete(i));
    else ids.forEach((i) => s.add(i));
    set(Array.from(s));
  };
  return { hidden, toggle, setMany };
}

function useOverrides() {
  const [overrides, setOverrides] = useState<OverrideMap>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(OVERRIDES_KEY);
      if (raw) setOverrides(JSON.parse(raw));
    } catch {}
  }, []);
  const save = (id: string, patch: Override) => {
    const next = { ...overrides, [id]: { ...overrides[id], ...patch } };
    setOverrides(next);
    try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next)); } catch {}
  };
  return { overrides, save };
}

function AdminPage() {
  const { isAdmin, login, logout } = useAdmin();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const navigate = useNavigate();
  const { channels: customChannels, add, remove } = useCustomChannels();
  const { hidden, toggle: toggleHidden, setMany } = useHidden();
  const { overrides, save: saveOverride } = useOverrides();

  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [syncTick, setSyncTick] = useState(0);

  // "Sync on open" — resets pagination and reloads localStorage overrides/hidden
  useEffect(() => {
    if (!isAdmin) return;
    try {
      const rawH = localStorage.getItem(HIDDEN_KEY);
      const rawO = localStorage.getItem(OVERRIDES_KEY);
      // trigger re-render if raw exists
      if (rawH || rawO) setSyncTick((t) => t + 1);
    } catch {}
  }, [isAdmin]);

  const rows: Row[] = useMemo(() => {
    void syncTick;
    const builtin: Row[] = M3U_CHANNELS.map((c) => {
      const o = overrides[c.slug] ?? {};
      return {
        id: c.slug,
        name: o.name ?? c.name,
        category: o.category ?? c.group,
        logo: o.logo ?? c.logo,
        url: o.url ?? c.url,
        builtin: true,
      };
    });
    const custom: Row[] = customChannels.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      logo: c.logo,
      url: c.sources[0]?.url ?? "",
      builtin: false,
    }));
    return [...builtin, ...custom];
  }, [customChannels, overrides, syncTick]);

  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (catFilter !== "all" && r.category !== catFilter) return false;
      if (nq && !r.name.toLowerCase().includes(nq)) return false;
      return true;
    });
  }, [rows, q, catFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => { if (page >= pageCount) setPage(0); }, [pageCount, page]);

  const allChecked = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const togglePageSelected = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) pageRows.forEach((r) => next.delete(r.id));
      else pageRows.forEach((r) => next.add(r.id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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
          {err && <div className="mt-2 text-xs font-semibold text-red-400">❌ Access denied</div>}
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
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Restricted</div>
            <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-bold sm:text-4xl">
              Channel management <span className="text-yellow-400">🔒</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {rows.length} channels total · {rows.length - hidden.length} active · {hidden.length} hidden
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              <Plus className="h-4 w-4" /> Add new channel
            </button>
            <button
              onClick={() => { logout(); navigate({ to: "/" }); }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0); }}
              placeholder="Search channels…"
              className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm outline-none focus:border-primary"
            />
          </div>
          <select
            value={catFilter}
            onChange={(e) => { setCatFilter(e.target.value); setPage(0); }}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="all">All categories</option>
            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm">
            <span className="font-semibold">{selected.size} selected</span>
            <button
              onClick={() => { setMany(Array.from(selected), true); setSelected(new Set()); }}
              className="ml-auto rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"
            >Set active</button>
            <button
              onClick={() => { setMany(Array.from(selected), false); setSelected(new Set()); }}
              className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/30"
            >Set inactive</button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-full bg-white/5 px-3 py-1 text-xs text-muted-foreground hover:bg-white/10"
            >Clear</button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <div className="max-h-[65vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-black/80 backdrop-blur text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input type="checkbox" checked={allChecked} onChange={togglePageSelected} className="h-4 w-4 accent-primary" />
                  </th>
                  <th className="px-2 py-3 w-14">Logo</th>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3 hidden md:table-cell">Stream URL</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No channels match.</td></tr>
                ) : pageRows.map((r) => {
                  const isHidden = hidden.includes(r.id);
                  const isSel = selected.has(r.id);
                  return (
                    <tr key={r.id} className={`border-t border-white/5 ${isHidden ? "opacity-50 line-through" : ""}`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={isSel} onChange={() => toggleOne(r.id)} className="h-4 w-4 accent-primary" />
                      </td>
                      <td className="px-2 py-2">
                        <ChannelLogo src={r.logo} name={r.name} group={r.category} size={32} />
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {r.name}
                        {!r.builtin && <span className="ml-2 rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-primary">custom</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground uppercase">{r.category}</td>
                      <td className="px-3 py-2 hidden md:table-cell max-w-[260px] truncate text-xs text-muted-foreground" title={r.url}>{r.url}</td>
                      <td className="px-3 py-2">
                        {isHidden ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300">Inactive</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Active</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button onClick={() => setEditing(r)} className="mr-1 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] hover:bg-white/10">
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button onClick={() => toggleHidden(r.id)} className="mr-1 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] hover:bg-white/10">
                          {isHidden ? <><Eye className="h-3 w-3" /> Show</> : <><EyeOff className="h-3 w-3" /> Hide</>}
                        </button>
                        {!r.builtin && (
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to permanently delete ${r.name}? This cannot be undone.`)) remove(r.id);
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/20"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-white/10 bg-black/40 px-4 py-3 text-xs text-muted-foreground">
            <div>
              Showing {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min(filtered.length, (page + 1) * PAGE_SIZE)} of {filtered.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 disabled:opacity-40 hover:bg-white/10"
              >Previous</button>
              <span className="font-semibold text-foreground">{page + 1} / {pageCount}</span>
              <button
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 disabled:opacity-40 hover:bg-white/10"
              >Next</button>
            </div>
          </div>
        </div>
      </div>
      <Footer />

      {editing && (
        <EditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            saveOverride(editing.id, patch);
            setEditing(null);
          }}
        />
      )}
      {adding && (
        <EditModal
          row={{ id: "", name: "", category: "Sports", logo: "", url: "", builtin: false }}
          isNew
          onClose={() => setAdding(false)}
          onSave={(patch) => {
            if (!patch.name?.trim() || !patch.url?.trim()) return;
            add({
              name: patch.name.trim(),
              category: (patch.category ?? "general") as any,
              logo: patch.logo?.trim() || undefined,
              sources: [{ quality: "auto", url: patch.url.trim() }],
            });
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function EditModal({
  row,
  isNew,
  onClose,
  onSave,
}: {
  row: Row;
  isNew?: boolean;
  onClose: () => void;
  onSave: (patch: Override) => void;
}) {
  const [name, setName] = useState(row.name);
  const [category, setCategory] = useState(row.category);
  const [logo, setLogo] = useState(row.logo ?? "");
  const [url, setUrl] = useState(row.url);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-card p-6 shadow-glow">
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-display text-lg font-bold">{isNew ? "Add new channel" : `Edit · ${row.name}`}</h2>
          <button aria-label="Close" onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); onSave({ name, category, logo, url }); }}
          className="space-y-3"
        >
          <Field label="Channel name">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary" />
          </Field>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary">
              {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Logo URL">
              <input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…/logo.png" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary" />
            </Field>
            <div className="pb-1">
              <ChannelLogo src={logo || undefined} name={name || "?"} group={category} size={48} />
            </div>
          </div>
          <Field label="Stream URL (.m3u8)">
            <input value={url} onChange={(e) => setUrl(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">Cancel</button>
            <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow">
              <Save className="h-4 w-4" /> Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}
