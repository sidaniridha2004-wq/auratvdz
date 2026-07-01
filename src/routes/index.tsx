import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { Search, Radio, Calendar, Flame, Star, Sparkles } from "lucide-react";
import { getMatches } from "@/lib/matches.functions";
import { M3U_CHANNELS, findChannelBySlug, channelsByGroup } from "@/lib/m3u-channels";
import { categoryFor } from "@/lib/channel-category";
import { SiteHeader } from "@/components/SiteHeader";
import { MatchCard } from "@/components/MatchCard";
import { ChannelCard } from "@/components/ChannelCard";
import { Footer } from "@/components/Footer";
import { useFavorites } from "@/lib/favorites";
import { useCustomChannels } from "@/lib/custom-channels";
import { useI18n } from "@/lib/i18n";
import stadiumBg from "@/assets/stadium-night.jpg";

export const Route = createFileRoute("/")({
  component: Home,
  errorComponent: ({ error, reset }) => <ErrorView message={error.message} reset={reset} />,
});

function ErrorView({ message, reset }: { message: string; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <p className="text-destructive">{message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

type Day = "yesterday" | "today" | "tomorrow";

const BEIN_MAX_SLUGS = ["bein-max-1", "bein-max-2", "bein-max-3", "bein-max-4", "bein-max-5", "bein-max-6"];

function Home() {
  const { t } = useI18n();
  const fetchMatches = useServerFn(getMatches);
  const { favorites } = useFavorites();
  const { channels: customChannels } = useCustomChannels();

  const [day, setDay] = useState<Day>("today");
  const { data: rawMatches, isLoading: matchesLoading } = useQuery({
    queryKey: ["matches", day],
    queryFn: () => fetchMatches({ data: { day } }),
    staleTime: 2 * 60_000,
  });

  // Filter by USER's LOCAL calendar day so TODAY/YESTERDAY/TOMORROW never mix.
  const matches = useMemo(() => {
    const list = rawMatches ?? [];
    const now = new Date();
    const target = new Date(now);
    if (day === "yesterday") target.setDate(target.getDate() - 1);
    if (day === "tomorrow") target.setDate(target.getDate() + 1);
    const targetKey = target.toLocaleDateString();
    return list.filter((m) => {
      if (!m.kickoffIso) return true; // keep entries without a parseable kickoff
      const d = new Date(m.kickoffIso);
      if (Number.isNaN(d.getTime())) return true;
      return d.toLocaleDateString() === targetKey;
    });
  }, [rawMatches, day]);

  const liveMatches = useMemo(() => matches.filter((m) => m.status === "live"), [matches]);
  const otherMatches = useMemo(() => matches.filter((m) => m.status !== "live"), [matches]);
  // Hero card shows the next upcoming match (soonest kickoff still ahead).
  // Falls back to null so the floating card hides when nothing's upcoming —
  // never duplicates a card that already appears in the schedule below.
  const featured = useMemo(() => {
    const upcoming = matches
      .filter((m) => m.status === "soon" && m.kickoffIso && new Date(m.kickoffIso).getTime() > Date.now())
      .sort((a, b) => new Date(a.kickoffIso!).getTime() - new Date(b.kickoffIso!).getTime());
    return upcoming[0] ?? null;
  }, [matches]);
  const totalMatches = matches.length;

  const nextMatch = useMemo(() => {
    return matches
      .filter((m) => m.status === "soon" && m.kickoffIso)
      .sort((a, b) => new Date(a.kickoffIso!).getTime() - new Date(b.kickoffIso!).getTime())[0];
  }, [matches]);

  // Live countdown to next kickoff (updates every 30s). Always renders "Xh Xm"
  // or "Xm" — never blank colons.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const nextCountdown = useMemo(() => {
    if (!nextMatch?.kickoffIso) return null;
    const diff = new Date(nextMatch.kickoffIso).getTime() - nowMs;
    if (!Number.isFinite(diff) || diff <= 0) return null;
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${Math.max(m, 1)}m`;
  }, [nextMatch, nowMs]);

  // Channel groups (excluding beIN MAX — has its own dedicated section)
  const groups = useMemo(() => {
    const g = channelsByGroup();
    delete g["beIN Sports MAX"];
    return g;
  }, []);
  const groupNames = useMemo(() => Object.keys(groups).sort(), [groups]);
  const [activeGroup, setActiveGroup] = useState<string>("");
  const currentGroup = activeGroup || groupNames[0] || "";
  const [q, setQ] = useState("");
  const [beinQ, setBeinQ] = useState("");

  const beinChannels = useMemo(() => {
    const list = BEIN_MAX_SLUGS.map(findChannelBySlug).filter(Boolean) as NonNullable<ReturnType<typeof findChannelBySlug>>[];
    if (!beinQ.trim()) return list;
    const n = beinQ.toLowerCase();
    return list.filter((c) => c.name.toLowerCase().includes(n));
  }, [beinQ]);

  const filteredChannels = useMemo(() => {
    const src = groups[currentGroup] ?? [];
    if (!q.trim()) return src;
    const n = q.toLowerCase();
    return src.filter((c) => c.name.toLowerCase().includes(n) || c.slug.toLowerCase().includes(n));
  }, [groups, currentGroup, q]);

  const favoriteChannels = useMemo(() => {
    return favorites
      .map((slug) => findChannelBySlug(slug))
      .filter(Boolean) as NonNullable<ReturnType<typeof findChannelBySlug>>[];
  }, [favorites]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-hero">
      <SiteHeader />

      {/* Live ticker bar */}
      <div className="sticky top-[65px] z-30 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-11 max-w-7xl items-center gap-4 overflow-hidden px-4 text-xs sm:px-6">
          {liveMatches.length === 0 && !nextMatch ? (
            <div className="flex w-full items-center justify-center gap-2 font-semibold uppercase tracking-widest text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
              No streams live right now — check back later
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-2 font-bold uppercase tracking-widest text-red-400">
                <span className="live-dot" />
                {liveMatches.length > 0 ? `${t("ticker.live")} ${liveMatches.length}` : "No live matches"}
              </div>
              <div className="hidden h-4 w-px shrink-0 bg-white/10 sm:block" />
              <div className="hidden shrink-0 text-muted-foreground sm:block">
                <span className="font-bold text-foreground">{totalMatches}</span> {t("ticker.today_matches")}
              </div>
              <div className="ml-auto flex min-w-0 shrink items-center gap-2 text-muted-foreground">
                <span className="shrink-0 uppercase tracking-widest">{t("ticker.next")}:</span>
                {nextMatch ? (
                  <span className="truncate">
                    <span className="font-semibold text-foreground">{nextMatch.homeTeam}</span> vs{" "}
                    <span className="font-semibold text-foreground">{nextMatch.awayTeam}</span>
                    <span className="ml-2 font-bold text-primary tabular-nums">
                      {nextCountdown ?? nextMatch.time ?? "soon"}
                    </span>
                  </span>
                ) : (
                  <span className="truncate">No upcoming matches</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>


      {/* HERO — left-aligned, stadium bg, floating match card right */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src={stadiumBg}
            alt=""
            aria-hidden
            width={1920}
            height={1024}
            className="h-full w-full object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-col items-start gap-6 text-left animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground backdrop-blur">
                <Sparkles className="h-3 w-3 text-accent" /> {t("hero.badge")}
              </div>
              <h1 className="font-display text-[2.75rem] font-black leading-[0.95] sm:text-6xl lg:text-7xl">
                Live sport,
                <br />
                <span className="text-aurora">every channel,</span>
                <br />
                <span className="text-foreground/90">one tap away.</span>
              </h1>
              <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
                {t("hero.tagline")}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/"
                  hash="matches"
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.03]"
                >
                  <Flame className="h-4 w-4 transition group-hover:rotate-12" /> {t("hero.today")}
                </Link>
                <Link
                  to="/"
                  hash="channels"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-foreground backdrop-blur transition hover:bg-white/10"
                >
                  <Radio className="h-4 w-4" /> {t("hero.browse")}
                </Link>
              </div>
            </div>

            {matchesLoading ? (
              <div className="relative conic-border rounded-3xl">
                <div className="relative rounded-3xl bg-card/70 p-2 backdrop-blur-xl">
                  <div className="h-80 animate-pulse rounded-2xl bg-card/70" />
                </div>
              </div>
            ) : featured ? (
              <div className="relative conic-border rounded-3xl">
                <div className="relative rounded-3xl bg-card/70 p-2 backdrop-blur-xl">
                  <MatchCard match={featured} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* MATCHES */}
      <section id="matches" className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
              <Calendar className="h-3.5 w-3.5" /> {t("section.fixtures")}
            </div>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{t("section.schedule")}</h2>
          </div>
          <div className="flex rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
            {(["yesterday", "today", "tomorrow"] as Day[]).map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest transition sm:px-4 ${
                  day === d ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`day.${d}`)}
              </button>
            ))}
          </div>
        </div>

        {matchesLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-card" />)}
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-muted-foreground">
            No matches found for {t(`day.${day}`)}.
          </div>
        ) : (
          <>
            {liveMatches.length > 0 && (
              <>
                <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-emerald-300">
                  <span className="live-dot" /> Live now · {liveMatches.length}
                </div>
                <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {liveMatches.map((m) => <MatchCard key={m.id} match={m} />)}
                </div>
              </>
            )}
            {otherMatches.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {otherMatches.map((m) => <MatchCard key={m.id} match={m} />)}
              </div>
            )}
          </>
        )}
      </section>

      {/* FAVORITES */}
      <section id="favorites" className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-300">
          <Star className="h-3.5 w-3.5 fill-current" /> {t("section.favorites")}
        </div>
        <h2 className="mb-6 font-display text-3xl font-bold sm:text-4xl">{t("section.favorites")}</h2>
        {favoriteChannels.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-muted-foreground">
            {t("favorites.empty")}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {favoriteChannels.map((c) => (
              <ChannelCard key={c.slug} slug={c.slug} name={c.name} group={c.group} logo={c.logo}
                           href={{ to: "/watch/live/$slug", params: { slug: c.slug } }} />
            ))}
          </div>
        )}
      </section>

      {/* beIN SPORTS MAX — Primary (merged) */}
      <section className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-300">
              <Sparkles className="h-3.5 w-3.5" /> Featured · Primary server
            </div>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">{t("section.bein_primary")}</h2>
          </div>
          <div className="relative w-full shrink-0 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={beinQ} onChange={(e) => setBeinQ(e.target.value)} placeholder={t("search.channels")}
                   className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground transition focus:border-primary focus:bg-white/[0.08]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {beinChannels.map((c) => (
            <ChannelCard key={c.slug} slug={c.slug} name={c.name} group={c.group} logo={c.logo}
                         href={{ to: "/watch/live/$slug", params: { slug: c.slug } }} featured />
          ))}
        </div>
      </section>

      {/* CHANNELS */}
      <section id="channels" className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
          <Radio className="h-3.5 w-3.5" /> {t("section.live_tv")}
        </div>
        <h2 className="mb-6 font-display text-3xl font-bold sm:text-4xl">{t("section.channels")}</h2>

        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-2 pb-2">
            {groupNames.map((g) => {
              const active = g === currentGroup;
              return (
                <button key={g} onClick={() => setActiveGroup(g)}
                        className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                          active ? "bg-primary text-primary-foreground shadow-glow"
                                 : "border border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
                        }`}>
                  {g}
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-primary-foreground/20" : "bg-white/10"}`}>
                    {groups[g].length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-5 mt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold">{currentGroup}</h3>
            <p className="text-sm text-muted-foreground">
              {filteredChannels.length} channel{filteredChannels.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="relative w-full shrink-0 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search.channels")}
                   className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground transition focus:border-primary focus:bg-white/[0.08]" />
          </div>
        </div>

        {filteredChannels.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-muted-foreground">
            No channels found.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredChannels.map((c) => (
              <ChannelCard key={c.slug} slug={c.slug} name={c.name} group={c.group} logo={c.logo}
                           href={{ to: "/watch/live/$slug", params: { slug: c.slug } }}
                           category={categoryFor(c.group, c.name)} />
            ))}
          </div>
        )}

        {/* User's custom channels */}
        {customChannels.length > 0 && (
          <div className="mt-16">
            <h3 className="mb-4 font-display text-2xl font-bold">My Channels</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {customChannels.map((c) => (
                <ChannelCard key={c.id} slug={c.id} name={c.name} group="My Channels" logo={c.logo}
                             href={{ to: "/watch/tv/$key", params: { key: c.id }, search: { name: c.name } }}
                             category={c.category} />
              ))}
            </div>
          </div>
        )}

      </section>

      <Footer />
    </div>
  );
}

export { M3U_CHANNELS };
