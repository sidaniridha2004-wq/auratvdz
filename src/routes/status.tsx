import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { PageShell, SideNote } from "@/components/PageShell";
import { getChannelStatus } from "@/lib/status.functions";
import { useI18n } from "@/lib/i18n";
import { pageHead } from "@/lib/seo";
import { SITE, breadcrumbJsonLd } from "@/lib/site";

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Channel status", path: "/status" },
];

export const Route = createFileRoute("/status")({
  component: StatusPage,
  head: () =>
    pageHead({
      title: "Channel status",
      description: "Automated uptime checks for every AuraTV channel: which streams are online, how fast they respond, and when they were last tested.",
      path: "/status",
      jsonLd: breadcrumbJsonLd(CRUMBS),
    }),
});

function relativeTime(ms: number): string {
  if (!ms) return "never";
  const diff = Math.max(0, Date.now() - ms);
  if (diff < 60_000) return `${Math.round(diff / 1000)} s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  return `${Math.round(diff / 3_600_000)} h ago`;
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

  const down = data?.down ?? 0;
  const checked = data?.checked ?? 0;

  return (
    <PageShell
      crumbs={CRUMBS}
      kicker="Uptime"
      title={t("status.title")}
      lede={t("status.subtitle")}
      aside={
        <>
          <SideNote title="How this works">
            A server job requests each stream's playlist on a schedule and records the response time. "Unstable" means the channel has not been
            checked yet in this cycle.
          </SideNote>
          <SideNote title="Still broken?">
            <Link to="/contact" className="underline">
              Send us the channel name
            </Link>
            . {SITE.responseTime}
          </SideNote>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
        <Stat label="Total" value={data?.total ?? 0} />
        <Stat label="Checked" value={checked} />
        <Stat label={t("status.up")} value={data?.up ?? 0} tone="ok" />
        <Stat label={t("status.down")} value={down} tone="bad" />
      </div>

      {checked > 0 && (
        <p className={`mt-4 flex items-center gap-2 text-[14px] font-semibold ${down === 0 ? "text-live" : "text-accent"}`} role="status">
          <span className={down === 0 ? "live-dot" : "inline-block h-2 w-2 rounded-full bg-accent"} aria-hidden />
          {down === 0 ? "All checked channels are online." : `${down} channel${down === 1 ? " is" : "s are"} currently offline.`}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Search channel</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search channel" type="search" className="field pl-9" />
        </label>
        <div role="tablist" aria-label="Filter" className="rule-b flex">
          {(["all", "up", "down"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`kicker -mb-px border-b-2 px-3 py-2 ${filter === f ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
            >
              {f === "all" ? "All" : f === "up" ? t("status.up") : t("status.down")}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn btn-outline btn-sm">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} aria-hidden /> {t("status.refresh")}
        </button>
      </div>

      <div className="tile mt-4 overflow-x-auto p-0">
        <table className="w-full text-[13px]">
          <caption className="sr-only">Channel uptime results</caption>
          <thead className="rule-b text-left">
            <tr>
              <th scope="col" className="kicker px-3 py-2.5">Channel</th>
              <th scope="col" className="kicker px-3 py-2.5">State</th>
              <th scope="col" className="kicker px-3 py-2.5">{t("status.response")}</th>
              <th scope="col" className="kicker px-3 py-2.5">{t("status.last_check")}</th>
              <th scope="col" className="kicker px-3 py-2.5">{t("status.reason")}</th>
              <th scope="col" className="kicker px-3 py-2.5 text-right">Report</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Loading...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No channels match.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.slug} className="rule-b">
                  <td className="px-3 py-2.5 font-medium" dir="auto">{r.name}</td>
                  <td className="px-3 py-2.5">
                    {r.ok ? <span className="badge badge-live">Online</span> : r.checkedAt === 0 ? <span className="badge badge-soon">Unstable</span> : <span className="badge badge-ft">Offline</span>}
                  </td>
                  <td className="mono px-3 py-2.5 text-muted-foreground">{r.ms} ms</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{relativeTime(r.checkedAt)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.reason ?? "-"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Link to="/contact" search={{ subject: `Channel not working: ${r.name}` }} className="kicker text-primary hover:underline">
                      Report
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "bad" }) {
  const c = tone === "ok" ? "text-live" : tone === "bad" ? "text-primary" : "text-foreground";
  return (
    <div className="bg-background p-4">
      <div className="kicker">{label}</div>
      <div className={`mt-1 font-display text-[2rem] leading-none ${c}`}>{value}</div>
    </div>
  );
}
