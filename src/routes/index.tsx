import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { Search, Radio, Calendar, Flame, Star, Sparkles, RefreshCw, CalendarClock, MousePointerClick, PlayCircle, Info } from "lucide-react";
import { getMatches } from "@/lib/matches.functions";
import { findChannelBySlug } from "@/lib/m3u-channels";
import { useChannels, CHANNELS_QUERY_KEY } from "@/lib/channels-client";
import { categoryFor } from "@/lib/channel-category";
import { SiteHeader } from "@/components/SiteHeader";
import { MatchCard } from "@/components/MatchCard";
import { ChannelCard } from "@/components/ChannelCard";
import { NowOnTvStrip } from "@/components/NowOnTvStrip";
import { Footer } from "@/components/Footer";
import { AdSlot } from "@/components/AdSlot";
import { LegalModal } from "@/components/LegalModal";
import { useFavorites } from "@/lib/favorites";
import { useCustomChannels } from "@/lib/custom-channels";
import { useI18n } from "@/lib/i18n";
import stadiumBg from "@/assets/stadium-night.jpg";
import type { M3uChannel } from "@/lib/m3u-channels";

const homeSearchSchema = z.object({
  group: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/")({
  component: Home,
  validateSearch: homeSearchSchema,
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
    if (liveMatches.length > 0) return liveMatches[0];
    const upcoming = matches
      .filter((m) => m.status === "soon" && m.kickoffIso && new Date(m.kickoffIso).getTime() > Date.now())
      .sort((a, b) => new Date(a.kickoffIso!).getTime() - new Date(b.kickoffIso!).getTime());
    return upcoming[0] ?? null;
  }, [matches, liveMatches]);
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
  const [dataLoadedAt, setDataLoadedAt] = useState<number>(() => Date.now());
  const qc = useQueryClient();
  const refreshChannels = () => {
    qc.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY });
    setDataLoadedAt(Date.now());
  };
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

  // Channels come from Supabase as the single source of truth.
  // useChannels() subscribes to realtime + refetches on window focus, so
  // admin edits show up here immediately without a page reload. If the
  // fetch hasn't landed yet we fall back to the static M3U catalogue so
  // the homepage never renders empty on first paint.
  // Supabase is the single source of truth — no static fallback, so logo
  // edits from /admin are always what the homepage renders. While the first
  // fetch is in flight the sections below render skeletons instead.
  const { channels: dbChannels, bySlug: dbBySlug, isLoading: channelsLoading, error: channelsError } = useChannels();
  const resolved: M3uChannel[] = dbChannels;
  const resolvedBySlug = dbBySlug;

  // Channel groups (excluding beIN MAX — has its own dedicated section)
  const groups = useMemo(() => {
    const g: Record<string, M3uChannel[]> = {};
    for (const c of resolved) (g[c.group] ??= []).push(c);
    delete g["beIN Sports MAX"];
    return g;
  }, [resolved]);
  const groupNames = useMemo(() => Object.keys(groups).sort(), [groups]);
  const [activeGroup, setActiveGroup] = useState<string>("");
  const currentGroup = activeGroup || groupNames[0] || "";
  const [q, setQ] = useState("");
  const [beinQ, setBeinQ] = useState("");

  const beinChannels = useMemo(() => {
    const list = BEIN_MAX_SLUGS.map((s) => resolvedBySlug.get(s)).filter(Boolean) as M3uChannel[];
    if (!beinQ.trim()) return list;
    const n = beinQ.toLowerCase();
    return list.filter((c) => c.name.toLowerCase().includes(n));
  }, [beinQ, resolvedBySlug]);

  // When the user types a query, we search across EVERY channel (excluding
  // the beIN MAX row which has its own section) — not just the active
  // category chip. When the query is empty, we show the active category only.
  const isSearching = q.trim().length > 0;
  const filteredChannels = useMemo(() => {
    if (isSearching) {
      const n = q.toLowerCase();
      const all = Object.values(groups).flat() as M3uChannel[];
      return all.filter(
        (c) => c.name.toLowerCase().includes(n) || c.slug.toLowerCase().includes(n) || c.group.toLowerCase().includes(n),
      );
    }
    return groups[currentGroup] ?? [];
  }, [groups, currentGroup, q, isSearching]);

  const favoriteChannels = useMemo(() => {
    return favorites
      .map((slug) => resolvedBySlug.get(slug))
      .filter(Boolean) as M3uChannel[];
  }, [favorites, resolvedBySlug]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-hero">
      <SiteHeader />

      {/* Live ticker bar */}
      <div className="sticky top-[65px] z-30 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-11 max-w-7xl items-center gap-4 overflow-hidden px-4 text-xs sm:px-6">
          {liveMatches.length === 0 && !nextMatch ? (
            <div className="flex w-full items-center justify-center gap-2 font-semibold uppercase tracking-widest text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
              No live matches at this moment — browse channels below
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

      <NowOnTvStrip />


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
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-24">
          <div className="grid items-center gap-6 sm:gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-col items-start gap-4 text-left animate-fade-up sm:gap-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 backdrop-blur">
                {liveMatches.length > 0 ? (
                  <>
                    <span className="live-dot" />
                    <span className="eyebrow !text-red-300">On air · {liveMatches.length} live</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 text-accent" />
                    <span className="eyebrow">{t("hero.badge")}</span>
                  </>
                )}
              </div>
              <h1 className="font-display text-[2rem] font-black leading-[0.95] sm:text-6xl lg:text-[5.25rem]">
                The stadium,
                <br />
                <span className="text-signal">on your screen.</span>
              </h1>
              <p className="max-w-lg text-[13px] leading-relaxed text-muted-foreground sm:text-[17px]">
                Fast access to live sports, TV channels, and match-day updates.
                <br className="hidden sm:block" />
                Simple, fast, and built for real football fans.
              </p>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <Link
                  to="/"
                  hash="matches"
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-glow transition hover:brightness-110 sm:px-6 sm:py-3.5 sm:text-sm"
                >
                  <Flame className="h-4 w-4 transition group-hover:rotate-12" /> {t("hero.today")}
                </Link>
                <Link
                  to="/"
                  hash="channels"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-foreground backdrop-blur transition hover:bg-white/[0.09] sm:px-6 sm:py-3.5 sm:text-sm"
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

      {/* LIVE STATUS STRIP — trust signal that data is current */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] text-muted-foreground sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_theme(colors.emerald.400)]" />
            <span>
              {channelsLoading ? (
                "Loading channel list…"
              ) : channelsError || resolved.length === 0 ? (
                "Channels are loading or temporarily unavailable"
              ) : (
                <>
                  <span className="font-bold text-foreground">{resolved.length}</span> channels available
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span>
              Last updated{" "}
              <span className="font-semibold text-foreground">
                {(() => {
                  const mins = Math.max(0, Math.floor((nowMs - dataLoadedAt) / 60_000));
                  return mins === 0 ? "just now" : `${mins}m ago`;
                })()}
              </span>
            </span>
            <button
              type="button"
              onClick={refreshChannels}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-semibold text-foreground transition hover:bg-white/10"
              aria-label="Refresh channel data"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ABOUT — honest, plain-language intro */}
      <section id="about" className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="grid gap-6 rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
              <Info className="h-3.5 w-3.5" /> About
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">About AuraTV</h2>
          </div>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            <p>
              AuraTV is a lightweight platform that brings live sports fixtures, TV channels, and
              match-day updates together in one clean, fast place.
            </p>
            <p>
              Stream links may come from third-party sources, and availability can change without
              notice. We do not host or broadcast any of the video content ourselves.
            </p>
            <p>
              Reliability and user experience are our top priorities. Feedback is always welcome —
              reach us on the{" "}
              <LegalModal kind="contact" className="text-primary hover:underline">
                Contact page
              </LegalModal>
              .
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — 3 quick steps */}
      <section id="how" className="relative mx-auto max-w-7xl px-4 pb-6 sm:px-6 sm:pb-10">
        <h2 className="sr-only">How it works</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { n: 1, icon: Search, title: "Browse matches or channels" },
            { n: 2, icon: MousePointerClick, title: "Tap play" },
            { n: 3, icon: PlayCircle, title: "Watch instantly" },
          ].map(({ n, icon: Icon, title }) => (
            <div
              key={n}
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                {n}
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Icon className="h-4 w-4 text-accent" />
                {title}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AD SLOT — top banner, non-intrusive, reserved height */}
      <div className="py-6 sm:py-8">
        <AdSlot id="top-banner-ad" />
      </div>

      {/* MATCHES */}
      <section id="matches" className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-20">

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
              <Calendar className="h-3.5 w-3.5" /> {t("section.fixtures")}
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold sm:text-4xl">{t("section.schedule")}</h2>
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
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
              <CalendarClock className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="max-w-md text-sm text-muted-foreground">
              No matches scheduled for {t(`day.${day}`)} — check back soon
            </p>
            <Link
              to="/"
              hash="channels"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-white/[0.08]"
            >
              <Radio className="h-3.5 w-3.5" /> Browse channels instead
            </Link>
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
      <section id="favorites" className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-20">
        <div className="mb-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-300">
          <Star className="h-3.5 w-3.5 fill-current" /> {t("section.favorites")}
        </div>
        <h2 className="mb-6 font-display text-2xl font-bold sm:text-4xl">{t("section.favorites")}</h2>
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

      {/* AD SLOT — mid-page, sits between Favorites and Channel Universe */}
      <div className="py-6 sm:py-8">
        <AdSlot id="mid-page-ad" />
      </div>

      {/* beIN SPORTS MAX — Primary (merged) */}
      <section className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-20">

        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-yellow-300">
              <Sparkles className="h-3.5 w-3.5" /> Featured · Primary server
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold sm:text-4xl">{t("section.bein_primary")}</h2>
          </div>
          <div className="relative w-full shrink-0 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={beinQ} onChange={(e) => setBeinQ(e.target.value)} placeholder={t("search.channels")}
                   className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground transition focus:border-primary focus:bg-white/[0.08]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {channelsLoading && beinChannels.length === 0
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/[0.03]" />
              ))
            : beinChannels.map((c) => (
                <ChannelCard key={c.slug} slug={c.slug} name={c.name} group={c.group} logo={c.logo}
                             href={{ to: "/watch/live/$slug", params: { slug: c.slug } }} featured />
              ))}
        </div>
      </section>

      {/* CHANNELS */}
      <section id="channels" className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-20">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
          <Radio className="h-3.5 w-3.5" /> {t("section.live_tv")}
        </div>
        <h2 className="mb-6 font-display text-2xl font-bold sm:text-4xl">{t("section.channels")}</h2>

        {/* Persistent global search — searches ALL channels regardless of category */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative w-full flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search.channels") + " — searches all categories"}
                   className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 pl-9 pr-9 text-sm outline-none placeholder:text-muted-foreground transition focus:border-primary focus:bg-white/[0.08]" />
            {isSearching && (
              <button
                onClick={() => setQ("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Category chips — hidden while searching so results feel truly global */}
        {!isSearching && (
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
        )}

        <div className="mb-5 mt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-bold">
              {isSearching ? `Search results` : currentGroup}
            </h3>
            <p className="text-sm text-muted-foreground">
              {filteredChannels.length} channel{filteredChannels.length === 1 ? "" : "s"}
              {isSearching && ` matching "${q}"`}
            </p>
          </div>
        </div>

        {channelsLoading && !channelsError ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/[0.03]" />
            ))}
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
            <p className="max-w-md text-sm text-muted-foreground">
              {isSearching
                ? `No channels match "${q}". Try a different search.`
                : "Channels are loading or temporarily unavailable."}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {isSearching && (
                <button
                  onClick={() => setQ("")}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-white/[0.08]"
                >
                  Clear search
                </button>
              )}
              <button
                onClick={refreshChannels}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-110"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
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
