import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { RefreshCw, CheckCircle2, XCircle, Search, MessageCircle } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { getChannelStatus } from "@/lib/status.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/status")({
  component: StatusPage,
  head: () => ({
    meta: [
      { title: "Channel Status — AuraTV" },
      { name: "description", content: "Live uptime status for every AuraTV channel." },
      { property: "og:title", content: "Channel Status — AuraTV" },
      { property: "og:description", content: "Live uptime status for every AuraTV channel." },
      { property: "og:url", content: "https://auratvdz.lovable.app/status" },
    ],
    links: [{ rel: "canonical", href: "https://auratvdz.lovable.app/status" }],
  }),
});

function relativeTime(ms: number): string {
  if (!ms) return "never";
  const diff = Math.max(0, Date.now() - ms);
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}

function StatusPage() {
  const { t } = useI18n();
  const fetchStatus = useServerFn(getChannelStatus);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["channel-status"],
    queryFn: () => fetchStatus(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "up" | "down">("all");

  const rows = useMemo(() => {
    const list = (data?.results ?? []).slice().sort((a, b) => Number(a.ok) - Number(b.ok));
    return list.filter((r) => {
      if (filter === "up" && !r.ok) return false;
      if (filter === "down" && r.ok) return false;
      if (q.trim() && !r.name.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [data, filter, q]);

  return (
    <div className="min-h-screen bg-hero">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
              Uptime
            </div>
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">{t("status.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("status.subtitle")}</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> {t("status.refresh")}
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Stat label="Total" value={data?.total ?? 0} />
          <Stat label="Checked" value={data?.checked ?? 0} />
          <Stat label={t("status.up")} value={data?.up ?? 0} tone="ok" />
          <Stat label={t("status.down")} value={data?.down ?? 0} tone="bad" />
        </div>

        {(() => {
          const down = data?.down ?? 0;
          const checked = data?.checked ?? 0;
          if (checked === 0) return null;
          const allOk = down === 0;
          return (
            <div className={`mt-6 rounded-2xl border p-4 text-sm font-semibold ${allOk ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-orange-500/30 bg-orange-500/10 text-orange-300"}`}>
              {allOk ? "🟢 All systems operational" : `🟡 Some streams may be unavailable — ${down} channel${down === 1 ? "" : "s"} down`}
            </div>
          );
        })()}


        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search channel…"
              className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm outline-none"
            />
          </div>
          <div className="flex rounded-full border border-white/10 bg-white/5 p-1">
            {(["all", "up", "down"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                  filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3">{t("status.response")}</th>
                <th className="px-4 py-3">{t("status.last_check")}</th>
                <th className="px-4 py-3">{t("status.reason")}</th>
                <th className="px-4 py-3 text-right">Report</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No channels match.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.slug} className="border-t border-white/5">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3">
                      {r.ok ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> 🟢 Online
                        </span>
                      ) : r.checkedAt === 0 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/15 px-2.5 py-1 text-[11px] font-semibold text-yellow-300">
                          🟡 Unstable
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-300">
                          <XCircle className="h-3 w-3" /> 🔴 Offline
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{r.ms}ms</td>
                    <td className="px-4 py-3 text-muted-foreground">{relativeTime(r.checkedAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.reason ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`https://t.me/Aura_TV?text=${encodeURIComponent(`Issue with channel: ${r.name} (${r.slug}) — ${r.reason ?? "not working"}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-primary hover:bg-white/10"
                      >
                        <MessageCircle className="h-3 w-3" /> Report
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "bad" }) {
  const c = tone === "ok" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : "text-foreground";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-3xl font-bold ${c}`}>{value}</div>
    </div>
  );
}
