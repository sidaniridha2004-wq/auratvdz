import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Eye, EyeOff, Search, Pencil, X, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { ChannelLogo } from "@/components/ChannelLogo";
import { Wordmark } from "@/components/Wordmark";
import { useAdmin } from "@/lib/admin";
import { useChannels, CHANNELS_QUERY_KEY } from "@/lib/channels-client";
import { adminUpdateChannel, adminSetActive, adminInsertChannel, adminDeleteChannel, type ChannelRow } from "@/lib/channels.functions";
import { adminInsertNowOnTv, adminUpdateNowOnTv, adminDeleteNowOnTv } from "@/lib/now-on-tv.functions";
import { useNowOnTv, NOW_ON_TV_QUERY_KEY } from "@/components/NowOnTvStrip";
import { getMatches, type Match } from "@/lib/matches.functions";
import { adminSetMatchOverride } from "@/lib/match-override.functions";
import { getSetting, updateSetting } from "@/lib/settings.functions";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [{ title: "Admin — AuraTV" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

// The browser never holds the admin password after sign-in. `useAdmin()` keeps
// a short-lived signed session token and every write sends that token, which
// the server verifies before touching the service-role client.

const PAGE_SIZE = 20;
const ALL_CATEGORIES = [
  "beIN Sports MAX", "beIN Sports", "Canal+ France", "French TV", "Algeria TV",
  "MBC Entertainment", "MBC Movies", "MBC Drama", "MBC Kids", "MBC Regional",
  "OSN Movies", "Sports", "Movies", "Series", "Kids & Family", "News",
  "General", "Lifestyle & Doc", "Documentaries", "Maghreb",
];

type Row = Pick<ChannelRow, "slug" | "name" | "category" | "logo_url" | "stream_url" | "is_active" | "is_custom" | "match_alias">;
type Patch = Partial<Pick<Row, "name" | "category" | "logo_url" | "stream_url" | "is_active">>;

const errText = (e: unknown) => (e instanceof Error ? e.message : "Unknown error");

function AdminPage() {
  const { isAdmin, ready, token, login, logout } = useAdmin();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { rows: dbRows, isLoading, error } = useChannels();

  const updateFn = useServerFn(adminUpdateChannel);
  const bulkFn = useServerFn(adminSetActive);
  const insertFn = useServerFn(adminInsertChannel);
  const deleteFn = useServerFn(adminDeleteChannel);

  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const rows: Row[] = useMemo(
    () =>
      dbRows.map((r) => ({
        slug: r.slug,
        name: r.name,
        category: r.category,
        logo_url: r.logo_url,
        stream_url: r.stream_url,
        is_active: r.is_active,
        is_custom: r.is_custom,
        match_alias: r.match_alias,
      })),
    [dbRows],
  );

  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return rows.filter((r) => (catFilter === "all" || r.category === catFilter) && (!nq || r.name.toLowerCase().includes(nq)));
  }, [rows, q, catFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => {
    if (page >= pageCount) setPage(0);
  }, [pageCount, page]);

  const activeCount = rows.filter((r) => r.is_active).length;
  const allChecked = pageRows.length > 0 && pageRows.every((r) => selected.has(r.slug));
  const togglePageSelected = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      pageRows.forEach((r) => (allChecked ? next.delete(r.slug) : next.add(r.slug)));
      return next;
    });
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const invalidate = () => qc.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY });
  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      await invalidate();
    } catch (e) {
      setNotice(`${label} failed: ${errText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const doSave = (slug: string, patch: Patch) => run("Save", () => updateFn({ data: { password: token, slug, patch } }));
  const doBulk = (active: boolean) => {
    if (selected.size === 0) return;
    return run("Bulk update", async () => {
      await bulkFn({ data: { password: token, slugs: Array.from(selected), is_active: active } });
      setSelected(new Set());
    });
  };
  const doDelete = (r: Row) => {
    if (!confirm(`Delete ${r.name}? This cannot be undone.`)) return;
    return run("Delete", () => deleteFn({ data: { password: token, slug: r.slug } }));
  };
  const doInsert = (patch: Patch & { slug?: string }) => {
    const slug = (patch.slug || patch.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (!slug || !patch.name || !patch.stream_url) return setNotice("Name and stream URL are required.");
    return run("Insert", async () => {
      await insertFn({
        data: {
          password: token,
          channel: { slug, name: patch.name!, category: patch.category ?? "General", logo_url: patch.logo_url ?? "", stream_url: patch.stream_url! },
        },
      });
      setAdding(false);
    });
  };

  if (!ready) return null;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            const ok = await login(pw);
            setPw("");
            if (!ok) setErr("Wrong password, or admin access is not configured on the server.");
          }}
          className="tile w-full max-w-sm p-6"
        >
          <Wordmark />
          <h1 className="mt-4 text-[1.4rem]">Editor sign-in</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Restricted area. Attempts are logged.</p>
          <label className="mt-4 block">
            <span className="kicker mb-1.5 block">Password</span>
            <input type="password" autoFocus autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} className="field" />
          </label>
          {err && (
            <p role="alert" className="mt-2 text-[13px] text-primary">
              {err}
            </p>
          )}
          <button type="submit" className="btn btn-primary mt-4 w-full">
            Sign in
          </button>
          <div className="mt-4 text-center text-[13px]">
            <Link to="/" className="text-muted-foreground underline">
              Back to the site
            </Link>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <div className="wrap space-y-12 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="kicker text-primary">Editor</div>
            <h1 className="mt-1 text-[1.75rem]">Site administration</h1>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              void navigate({ to: "/" });
            }}
            className="btn btn-outline btn-sm"
          >
            Sign out
          </button>
        </div>

        {notice && (
          <p role="alert" className="tile border-primary/40 p-3 text-[13px] text-primary">
            {notice}
          </p>
        )}

        <ScraperSettingsEditor token={token} />
        <MatchOverrides token={token} channelRows={rows} />
        <NowOnTvEditor token={token} channelRows={rows} />

        <section>
          <div className="rule-heavy mb-5 flex flex-wrap items-end justify-between gap-3 pt-3">
            <div>
              <div className="kicker text-primary">Legacy channel list</div>
              <h2 className="mt-1 text-[1.4rem]">Channels in the database</h2>
              <p className="text-[13px] text-muted-foreground">
                {rows.length} total, {activeCount} shown to visitors, {rows.length - activeCount} hidden.
                {busy && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" aria-label="Working" />}
              </p>
              {error && <p className="text-[13px] text-primary">Could not load channels.</p>}
            </div>
            <button type="button" onClick={() => setAdding(true)} className="btn btn-primary btn-sm">
              <Plus className="h-4 w-4" aria-hidden /> Add channel
            </button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
                placeholder="Search channels"
                aria-label="Search channels"
                className="field pl-9"
              />
            </div>
            <select
              value={catFilter}
              onChange={(e) => {
                setCatFilter(e.target.value);
                setPage(0);
              }}
              aria-label="Filter by category"
              className="field w-auto"
            >
              <option value="all">All categories</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {selected.size > 0 && (
            <div className="tile mb-3 flex flex-wrap items-center gap-2 p-3 text-[13px]">
              <span className="font-semibold">{selected.size} selected</span>
              <button type="button" onClick={() => doBulk(true)} className="btn btn-outline btn-sm ml-auto">
                Show
              </button>
              <button type="button" onClick={() => doBulk(false)} className="btn btn-outline btn-sm">
                Hide
              </button>
              <button type="button" onClick={() => setSelected(new Set())} className="btn btn-ghost btn-sm">
                Clear
              </button>
            </div>
          )}

          <div className="tile overflow-hidden p-0">
            <div className="max-h-[65vh] overflow-y-auto">
              <table className="w-full text-[13px]">
                <caption className="sr-only">Channels stored in the database</caption>
                <thead className="sticky top-0 z-10 bg-card text-left">
                  <tr className="rule-b">
                    <th scope="col" className="w-8 px-3 py-3">
                      <input type="checkbox" checked={allChecked} onChange={togglePageSelected} aria-label="Select all on this page" />
                    </th>
                    <th scope="col" className="w-14 px-2 py-3 kicker">Logo</th>
                    <th scope="col" className="px-3 py-3 kicker">Name</th>
                    <th scope="col" className="px-3 py-3 kicker">Category</th>
                    <th scope="col" className="hidden px-3 py-3 kicker md:table-cell">Stream</th>
                    <th scope="col" className="px-3 py-3 kicker">Status</th>
                    <th scope="col" className="px-3 py-3 text-right kicker">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Loading</td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No channels match.</td>
                    </tr>
                  ) : (
                    pageRows.map((r) => (
                      <tr key={r.slug} className={`rule-b ${r.is_active ? "" : "opacity-50"}`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selected.has(r.slug)} onChange={() => toggleOne(r.slug)} aria-label={`Select ${r.name}`} />
                        </td>
                        <td className="px-2 py-2">
                          <ChannelLogo src={r.logo_url} name={r.name} group={r.category} size={32} />
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {r.name}
                          {r.is_custom && <span className="badge ml-2">custom</span>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{r.category}</td>
                        <td className="mono hidden max-w-[260px] truncate px-3 py-2 text-muted-foreground md:table-cell" title={r.stream_url}>
                          {r.stream_url}
                        </td>
                        <td className="px-3 py-2">{r.is_active ? <span className="badge badge-live">Shown</span> : <span className="badge badge-ft">Hidden</span>}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <button type="button" onClick={() => setEditing(r)} disabled={busy} className="btn btn-ghost btn-sm" aria-label={`Edit ${r.name}`}>
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button type="button" onClick={() => doSave(r.slug, { is_active: !r.is_active })} disabled={busy} className="btn btn-ghost btn-sm" aria-label={r.is_active ? `Hide ${r.name}` : `Show ${r.name}`}>
                            {r.is_active ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
                          </button>
                          <button type="button" onClick={() => doDelete(r)} disabled={busy} className="btn btn-ghost btn-sm text-primary" aria-label={`Delete ${r.name}`}>
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="rule flex items-center justify-between px-4 py-3 text-[12px] text-muted-foreground">
              <span>
                {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min(filtered.length, (page + 1) * PAGE_SIZE)} of {filtered.length}
              </span>
              <span className="flex items-center gap-2">
                <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="btn btn-ghost btn-sm">
                  Previous
                </button>
                <span className="mono">
                  {page + 1} / {pageCount}
                </span>
                <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} className="btn btn-ghost btn-sm">
                  Next
                </button>
              </span>
            </div>
          </div>
        </section>
      </div>
      <Footer />

      {editing && (
        <EditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await doSave(editing.slug, patch);
            setEditing(null);
          }}
        />
      )}
      {adding && (
        <EditModal
          row={{ slug: "", name: "", category: "Sports", logo_url: "", stream_url: "", is_active: true, is_custom: true, match_alias: null }}
          isNew
          onClose={() => setAdding(false)}
          onSave={(patch) => doInsert(patch)}
        />
      )}
    </div>
  );
}

function EditModal({ row, isNew, onClose, onSave }: { row: Row; isNew?: boolean; onClose: () => void; onSave: (patch: Patch) => void }) {
  const [name, setName] = useState(row.name);
  const [category, setCategory] = useState(row.category);
  const [logo, setLogo] = useState(row.logo_url ?? "");
  const [url, setUrl] = useState(row.stream_url);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="edit-title" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4">
      <div className="tile w-full max-w-lg p-6">
        <div className="mb-4 flex items-start justify-between">
          <h2 id="edit-title" className="text-[1.2rem]">
            {isNew ? "Add channel" : `Edit ${row.name}`}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="btn btn-ghost btn-sm px-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ name, category, logo_url: logo, stream_url: url });
          }}
          className="space-y-3"
        >
          <Field label="Channel name">
            <input required value={name} onChange={(e) => setName(e.target.value)} className="field" />
          </Field>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="field">
              {ALL_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Logo URL">
              <input type="url" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://" className="field" />
            </Field>
            <div className="pb-1">
              <ChannelLogo src={logo || undefined} name={name || "?"} group={category} size={48} />
            </div>
          </div>
          <Field label="Stream URL (.m3u8)">
            <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} className="field mono" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="kicker mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

// ---------- Now on TV editor ----------

function NowOnTvEditor({ token, channelRows }: { token: string; channelRows: Row[] }) {
  const qc = useQueryClient();
  const { rows, isLoading } = useNowOnTv();
  const insertFn = useServerFn(adminInsertNowOnTv);
  const updateFn = useServerFn(adminUpdateNowOnTv);
  const deleteFn = useServerFn(adminDeleteNowOnTv);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [newSlug, setNewSlug] = useState(channelRows[0]?.slug ?? "");
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");

  useEffect(() => {
    if (!newSlug && channelRows[0]) setNewSlug(channelRows[0].slug);
  }, [channelRows, newSlug]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: NOW_ON_TV_QUERY_KEY });
    } catch (e) {
      setNotice(`${label} failed: ${errText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const doInsert = () => {
    if (!newSlug || !newTitle.trim()) return setNotice("Pick a channel and enter a title.");
    return run("Add", async () => {
      const nextOrder = (rows[rows.length - 1]?.sort_order ?? 0) + 10;
      await insertFn({
        data: { password: token, item: { channel_slug: newSlug, title: newTitle.trim(), subtitle: newSubtitle.trim(), sort_order: nextOrder, is_active: true } },
      });
      setNewTitle("");
      setNewSubtitle("");
    });
  };
  const doPatch = (id: string, patch: Partial<{ title: string; subtitle: string; sort_order: number; is_active: boolean; channel_slug: string }>) =>
    run("Update", () => updateFn({ data: { password: token, id, patch } }));
  const doDelete = (id: string) => {
    if (!confirm("Remove this item from the strip?")) return;
    return run("Delete", () => deleteFn({ data: { password: token, id } }));
  };

  return (
    <section>
      <div className="rule-heavy mb-5 pt-3">
        <div className="kicker text-primary">Front page</div>
        <h2 className="mt-1 text-[1.4rem]">Now on TV strip</h2>
        <p className="text-[13px] text-muted-foreground">
          What visitors see first under the header.
          {busy && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" aria-label="Working" />}
        </p>
      </div>
      {notice && (
        <p role="alert" className="mb-3 text-[13px] text-primary">
          {notice}
        </p>
      )}

      <div className="tile mb-4 grid gap-3 p-4 md:grid-cols-[220px_1fr_1fr_auto]">
        <select value={newSlug} onChange={(e) => setNewSlug(e.target.value)} aria-label="Channel" className="field">
          {channelRows.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Title, e.g. Real Madrid v Barcelona" aria-label="Title" className="field" />
        <input value={newSubtitle} onChange={(e) => setNewSubtitle(e.target.value)} placeholder="Subtitle (optional)" aria-label="Subtitle" className="field" />
        <button type="button" onClick={doInsert} disabled={busy} className="btn btn-primary btn-sm">
          <Plus className="h-4 w-4" aria-hidden /> Add
        </button>
      </div>

      {isLoading ? (
        <div className="tile p-8 text-center text-[13px] text-muted-foreground">Loading</div>
      ) : rows.length === 0 ? (
        <div className="tile p-8 text-center text-[13px] text-muted-foreground">Nothing on the strip yet.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const ch = channelRows.find((c) => c.slug === r.channel_slug);
            return (
              <li key={r.id} className={`tile grid grid-cols-1 items-center gap-3 p-3 md:grid-cols-[auto_200px_1fr_1fr_90px_auto] ${r.is_active ? "" : "opacity-50"}`}>
                <ChannelLogo src={ch?.logo_url} name={ch?.name ?? r.channel_slug} group={ch?.category} size={36} />
                <select value={r.channel_slug} onChange={(e) => doPatch(r.id, { channel_slug: e.target.value })} disabled={busy} aria-label="Channel" className="field">
                  {channelRows.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input defaultValue={r.title} onBlur={(e) => e.target.value !== r.title && doPatch(r.id, { title: e.target.value })} aria-label="Title" className="field" />
                <input defaultValue={r.subtitle} onBlur={(e) => e.target.value !== r.subtitle && doPatch(r.id, { subtitle: e.target.value })} placeholder="Subtitle" aria-label="Subtitle" className="field" />
                <input
                  type="number"
                  defaultValue={r.sort_order}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v !== r.sort_order) doPatch(r.id, { sort_order: v });
                  }}
                  aria-label="Sort order"
                  className="field mono"
                />
                <span className="flex items-center gap-1 justify-self-end">
                  <button type="button" onClick={() => doPatch(r.id, { is_active: !r.is_active })} disabled={busy} className="btn btn-ghost btn-sm" aria-label={r.is_active ? "Hide" : "Show"}>
                    {r.is_active ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
                  </button>
                  <button type="button" onClick={() => doDelete(r.id)} disabled={busy} className="btn btn-ghost btn-sm text-primary" aria-label="Remove">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------- Match to channel overrides ----------

function MatchOverrides({ token, channelRows }: { token: string; channelRows: Row[] }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const setOverrideFn = useServerFn(adminSetMatchOverride);
  const fetchMatches = useServerFn(getMatches);

  const { data: matches, isLoading } = useQuery<Match[]>({
    queryKey: ["matches", "today"],
    queryFn: () => fetchMatches({ data: { day: "today" } }),
  });

  const doOverride = async (matchId: string, channelSlug: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await setOverrideFn({ data: { password: token, matchId, channelSlug } });
      await qc.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY });
    } catch (e) {
      setNotice(`Update failed: ${errText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="rule-heavy mb-5 pt-3">
        <div className="kicker text-primary">Today's fixtures</div>
        <h2 className="mt-1 text-[1.4rem]">Match to channel overrides</h2>
        <p className="text-[13px] text-muted-foreground">
          Force a fixture to open a specific database channel instead of the automatic match.
          {busy && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" aria-label="Working" />}
        </p>
      </div>
      {notice && (
        <p role="alert" className="mb-3 text-[13px] text-primary">
          {notice}
        </p>
      )}

      {isLoading ? (
        <div className="tile p-8 text-center text-[13px] text-muted-foreground">Loading</div>
      ) : !matches || matches.length === 0 ? (
        <div className="tile p-8 text-center text-[13px] text-muted-foreground">No fixtures today.</div>
      ) : (
        <ul className="space-y-2">
          {matches.map((m) => {
            const overrideChannel = channelRows.find((c) =>
              (c.match_alias ?? "")
                .split(",")
                .map((a) => a.trim())
                .includes(m.id),
            );
            return (
              <li key={m.id} className="tile grid grid-cols-1 items-center gap-3 p-3 md:grid-cols-[1fr_auto_280px]">
                <div className="flex items-center gap-2 text-[13px]">
                  {m.homeLogo ? <img src={m.homeLogo} alt="" width={28} height={28} className="h-7 w-7 object-contain" /> : <span className="h-7 w-7 rounded-full bg-muted" />}
                  <span className="font-semibold">{m.homeTeam}</span>
                  <span className="text-muted-foreground">v</span>
                  <span className="font-semibold">{m.awayTeam}</span>
                  {m.awayLogo ? <img src={m.awayLogo} alt="" width={28} height={28} className="h-7 w-7 object-contain" /> : <span className="h-7 w-7 rounded-full bg-muted" />}
                </div>
                <div className="flex flex-wrap gap-2 text-[12px]">
                  <span className="mono">{m.time}</span>
                  <span className={`badge ${m.status === "live" ? "badge-live" : m.status === "soon" ? "badge-soon" : "badge-ft"}`}>{m.statusLabel}</span>
                  <span className="text-muted-foreground">{m.channel}</span>
                </div>
                <select value={overrideChannel?.slug ?? ""} onChange={(e) => doOverride(m.id, e.target.value)} disabled={busy} aria-label={`Channel for ${m.homeTeam} v ${m.awayTeam}`} className="field">
                  <option value="">Automatic</option>
                  {channelRows.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------- Settings ----------

function ScraperSettingsEditor({ token }: { token: string }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fetchSetting = useServerFn(getSetting);
  const saveSetting = useServerFn(updateSetting);

  useEffect(() => {
    fetchSetting({ data: "scraper_url" })
      .then((val) => {
        if (val) setUrl(val);
      })
      .catch(() => setNotice("Could not load the current value."))
      .finally(() => setLoading(false));
  }, [fetchSetting]);

  const handleSave = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await saveSetting({ data: { password: token, key: "scraper_url", value: url } });
      setNotice("Saved.");
    } catch (e) {
      setNotice(`Save failed: ${errText(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="rule-heavy mb-5 pt-3">
        <div className="kicker text-primary">Settings</div>
        <h2 className="mt-1 text-[1.4rem]">Fixture source</h2>
        <p className="text-[13px] text-muted-foreground">Fixtures come from the live API. This legacy field is kept for the fallback scraper only.</p>
      </div>
      <div className="tile flex flex-wrap gap-2 p-4">
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" aria-label="Fallback source URL" className="field mono flex-1" disabled={loading || saving} />
        <button type="button" onClick={handleSave} disabled={loading || saving} className="btn btn-primary btn-sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Save
        </button>
        {notice && (
          <p role="status" className="w-full text-[13px] text-muted-foreground">
            {notice}
          </p>
        )}
      </div>
    </section>
  );
}
