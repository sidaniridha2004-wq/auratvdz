import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lock, LogOut, Plus, Trash2, Eye, EyeOff, ArrowLeft, Search, Pencil, X, Save, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { ChannelLogo } from "@/components/ChannelLogo";
import { useAdmin } from "@/lib/admin";
import { useChannels, CHANNELS_QUERY_KEY } from "@/lib/channels-client";
import {
  adminUpdateChannel,
  adminSetActive,
  adminInsertChannel,
  adminDeleteChannel,
} from "@/lib/channels.functions";
import {
  adminInsertNowOnTv,
  adminUpdateNowOnTv,
  adminDeleteNowOnTv,
} from "@/lib/now-on-tv.functions";
import { useNowOnTv, NOW_ON_TV_QUERY_KEY } from "@/components/NowOnTvStrip";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin — AuraTV" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

// The password lives in the browser only long enough to authorize the current
// admin session's writes; we forward it to server fns that re-check it against
// process.env.ADMIN_PASSWORD before doing anything with the service-role key.
// No hardcoded fallback — an operator must set ADMIN_PASSWORD server-side.
const PW_KEY = "auratv:admin:pw";
const PAGE_SIZE = 20;

const ALL_CATEGORIES = [
  "beIN Sports MAX", "beIN Sports", "Canal+ France", "French TV", "Algeria TV",
  "MBC Entertainment", "MBC Movies", "MBC Drama", "MBC Kids", "MBC Regional",
  "OSN Movies", "Sports", "Movies", "Series", "Kids & Family", "News",
  "General", "Lifestyle & Doc", "Documentaries", "Maghreb",
];

interface Row {
  slug: string;
  name: string;
  category: string;
  logo_url: string;
  stream_url: string;
  is_active: boolean;
  is_custom: boolean;
}
type Patch = Partial<Pick<Row, "name" | "category" | "logo_url" | "stream_url" | "is_active">>;

function AdminPage() {
  const { isAdmin, login, logout } = useAdmin();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { rows: dbRows, isLoading, error } = useChannels();

  const updateFn = useServerFn(adminUpdateChannel);
  const bulkFn = useServerFn(adminSetActive);
  const insertFn = useServerFn(adminInsertChannel);
  const deleteFn = useServerFn(adminDeleteChannel);

  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  // Retain the password in sessionStorage so refresh doesn't drop it.
  const [adminPw, setAdminPw] = useState<string>("");
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(PW_KEY) ?? "";
      setAdminPw(stored);
      // If session says we're admin but the password is missing (stored
      // before PW_KEY existed, or cleared), force re-login so writes
      // don't fail with Unauthorized.
      if (isAdmin && !stored) logout();
    } catch {}
  }, [isAdmin, logout]);

  const rows: Row[] = useMemo(() => dbRows.map((r) => ({
    slug: r.slug,
    name: r.name,
    category: r.category,
    logo_url: r.logo_url,
    stream_url: r.stream_url,
    is_active: r.is_active,
    is_custom: r.is_custom,
  })), [dbRows]);

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

  const activeCount = rows.filter((r) => r.is_active).length;
  const hiddenCount = rows.length - activeCount;

  const allChecked = pageRows.length > 0 && pageRows.every((r) => selected.has(r.slug));
  const togglePageSelected = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) pageRows.forEach((r) => next.delete(r.slug));
      else pageRows.forEach((r) => next.add(r.slug));
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

  const invalidate = () => qc.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY });
  const getAdminPassword = () => {
    try {
      return adminPw || sessionStorage.getItem(PW_KEY) || "";
    } catch {
      return adminPw;
    }
  };

  const doSave = async (slug: string, patch: Patch) => {
    setBusy(true);
    try {
      await updateFn({ data: { password: getAdminPassword(), slug, patch } });
      await invalidate();
    } catch (e) {
      alert(`Save failed: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };
  const doToggle = async (r: Row) => {
    await doSave(r.slug, { is_active: !r.is_active });
  };
  const doBulk = async (active: boolean) => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await bulkFn({ data: { password: getAdminPassword(), slugs: Array.from(selected), is_active: active } });
      setSelected(new Set());
      await invalidate();
    } catch (e) {
      alert(`Bulk update failed: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };
  const doDelete = async (r: Row) => {
    if (!confirm(`Delete ${r.name}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteFn({ data: { password: getAdminPassword(), slug: r.slug } });
      await invalidate();
    } catch (e) {
      alert(`Delete failed: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };
  const doInsert = async (patch: Patch & { slug?: string }) => {
    const slug = (patch.slug || patch.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (!slug || !patch.name || !patch.stream_url) return alert("Name, stream URL, and slug are required.");
    setBusy(true);
    try {
      await insertFn({ data: { password: getAdminPassword(), channel: {
        slug,
        name: patch.name,
        category: patch.category ?? "General",
        logo_url: patch.logo_url ?? "",
        stream_url: patch.stream_url,
      } } });
      setAdding(false);
      await invalidate();
    } catch (e) {
      alert(`Insert failed: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-hero flex items-center justify-center px-4">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await login(pw)) {
              try { sessionStorage.setItem(PW_KEY, pw); } catch {}
              setAdminPw(pw);
              setErr(false);
            } else setErr(true);
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
              {rows.length} channels total · {activeCount} active · {hiddenCount} hidden {busy && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
            </p>
            {error && <p className="text-xs text-red-400">Load error: {error.message}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              <Plus className="h-4 w-4" /> Add new channel
            </button>
            <button
              onClick={() => { try { sessionStorage.removeItem(PW_KEY); } catch {}; logout(); navigate({ to: "/" }); }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>

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

        {selected.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm">
            <span className="font-semibold">{selected.size} selected</span>
            <button
              onClick={() => doBulk(true)}
              className="ml-auto rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"
            >Set active</button>
            <button
              onClick={() => doBulk(false)}
              className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/30"
            >Set inactive</button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-full bg-white/5 px-3 py-1 text-xs text-muted-foreground hover:bg-white/10"
            >Clear</button>
          </div>
        )}

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
                {isLoading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Loading channels…</td></tr>
                ) : pageRows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No channels match.</td></tr>
                ) : pageRows.map((r) => {
                  const isSel = selected.has(r.slug);
                  return (
                    <tr key={r.slug} className={`border-t border-white/5 ${!r.is_active ? "opacity-50 line-through" : ""}`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={isSel} onChange={() => toggleOne(r.slug)} className="h-4 w-4 accent-primary" />
                      </td>
                      <td className="px-2 py-2">
                        <ChannelLogo src={r.logo_url} name={r.name} group={r.category} size={32} />
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {r.name}
                        {r.is_custom && <span className="ml-2 rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-primary">custom</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground uppercase">{r.category}</td>
                      <td className="px-3 py-2 hidden md:table-cell max-w-[260px] truncate text-xs text-muted-foreground" title={r.stream_url}>{r.stream_url}</td>
                      <td className="px-3 py-2">
                        {r.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Active</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300">Inactive</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button onClick={() => setEditing(r)} disabled={busy} className="mr-1 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] hover:bg-white/10 disabled:opacity-40">
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button onClick={() => doToggle(r)} disabled={busy} className="mr-1 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] hover:bg-white/10 disabled:opacity-40">
                          {r.is_active ? <><EyeOff className="h-3 w-3" /> Hide</> : <><Eye className="h-3 w-3" /> Show</>}
                        </button>
                        {r.is_custom && (
                          <button
                            onClick={() => doDelete(r)}
                            disabled={busy}
                            className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/20 disabled:opacity-40"
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
      <NowOnTvEditor getPassword={getAdminPassword} channelRows={rows} />
      <Footer />

      {editing && (
        <EditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => { await doSave(editing.slug, patch); setEditing(null); }}
        />
      )}
      {adding && (
        <EditModal
          row={{ slug: "", name: "", category: "Sports", logo_url: "", stream_url: "", is_active: true, is_custom: true }}
          isNew
          onClose={() => setAdding(false)}
          onSave={(patch) => doInsert(patch)}
        />
      )}
    </div>
  );
}

function EditModal({
  row, isNew, onClose, onSave,
}: {
  row: Row;
  isNew?: boolean;
  onClose: () => void;
  onSave: (patch: Patch) => void;
}) {
  const [name, setName] = useState(row.name);
  const [category, setCategory] = useState(row.category);
  const [logo, setLogo] = useState(row.logo_url ?? "");
  const [url, setUrl] = useState(row.stream_url);

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
          onSubmit={(e) => { e.preventDefault(); onSave({ name, category, logo_url: logo, stream_url: url }); }}
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

// ---------- Now on TV editor ----------

interface NowRow {
  slug: string;
  name: string;
  logo_url: string;
  category: string;
}

function NowOnTvEditor({
  getPassword,
  channelRows,
}: {
  getPassword: () => string;
  channelRows: NowRow[];
}) {
  const qc = useQueryClient();
  const { rows, isLoading } = useNowOnTv();
  const insertFn = useServerFn(adminInsertNowOnTv);
  const updateFn = useServerFn(adminUpdateNowOnTv);
  const deleteFn = useServerFn(adminDeleteNowOnTv);

  const [busy, setBusy] = useState(false);
  const [newSlug, setNewSlug] = useState<string>(channelRows[0]?.slug ?? "");
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");

  useEffect(() => {
    if (!newSlug && channelRows[0]) setNewSlug(channelRows[0].slug);
  }, [channelRows, newSlug]);

  const invalidate = () => qc.invalidateQueries({ queryKey: NOW_ON_TV_QUERY_KEY });

  const doInsert = async () => {
    if (!newSlug || !newTitle.trim()) {
      alert("Pick a channel and enter a title.");
      return;
    }
    setBusy(true);
    try {
      const nextOrder = (rows[rows.length - 1]?.sort_order ?? 0) + 10;
      await insertFn({
        data: {
          password: getPassword(),
          item: {
            channel_slug: newSlug,
            title: newTitle.trim(),
            subtitle: newSubtitle.trim(),
            sort_order: nextOrder,
            is_active: true,
          },
        },
      });
      setNewTitle("");
      setNewSubtitle("");
      await invalidate();
    } catch (e) {
      alert(`Add failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const doPatch = async (id: string, patch: Partial<{ title: string; subtitle: string; sort_order: number; is_active: boolean; channel_slug: string }>) => {
    setBusy(true);
    try {
      await updateFn({ data: { password: getPassword(), id, patch } });
      await invalidate();
    } catch (e) {
      alert(`Update failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (id: string) => {
    if (!confirm("Remove this item from the Now on TV strip?")) return;
    setBusy(true);
    try {
      await deleteFn({ data: { password: getPassword(), id } });
      await invalidate();
    } catch (e) {
      alert(`Delete failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Homepage</div>
          <h2 className="mt-1 font-display text-2xl font-bold">Now on TV strip</h2>
          <p className="text-sm text-muted-foreground">
            Curate what visitors see at the top of the homepage.
            {busy && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
          </p>
        </div>
      </div>

      {/* Add form */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="grid gap-3 md:grid-cols-[220px_1fr_1fr_auto]">
          <select
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {channelRows.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title (e.g. Real Madrid vs Barcelona)"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            value={newSubtitle}
            onChange={(e) => setNewSubtitle(e.target.value)}
            placeholder="Subtitle (optional)"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={doInsert}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-muted-foreground">Loading strip…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-muted-foreground">
          Nothing on the strip yet — add your first item above.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const ch = channelRows.find((c) => c.slug === r.channel_slug);
            return (
              <div
                key={r.id}
                className={`grid grid-cols-1 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[auto_180px_1fr_1fr_90px_auto] ${r.is_active ? "" : "opacity-50"}`}
              >
                <ChannelLogo src={ch?.logo_url} name={ch?.name ?? r.channel_slug} group={ch?.category} size={36} />
                <select
                  value={r.channel_slug}
                  onChange={(e) => doPatch(r.id, { channel_slug: e.target.value })}
                  disabled={busy}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs outline-none focus:border-primary"
                >
                  {channelRows.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.name}</option>
                  ))}
                </select>
                <input
                  defaultValue={r.title}
                  onBlur={(e) => e.target.value !== r.title && doPatch(r.id, { title: e.target.value })}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm outline-none focus:border-primary"
                />
                <input
                  defaultValue={r.subtitle}
                  onBlur={(e) => e.target.value !== r.subtitle && doPatch(r.id, { subtitle: e.target.value })}
                  placeholder="Subtitle"
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm outline-none focus:border-primary"
                />
                <input
                  type="number"
                  defaultValue={r.sort_order}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v !== r.sort_order) doPatch(r.id, { sort_order: v });
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm outline-none focus:border-primary"
                  title="Sort order (lower first)"
                />
                <div className="flex items-center gap-1 justify-self-end">
                  <button
                    onClick={() => doPatch(r.id, { is_active: !r.is_active })}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] hover:bg-white/10 disabled:opacity-40"
                  >
                    {r.is_active ? <><EyeOff className="h-3 w-3" /> Hide</> : <><Eye className="h-3 w-3" /> Show</>}
                  </button>
                  <button
                    onClick={() => doDelete(r.id)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/20 disabled:opacity-40"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
