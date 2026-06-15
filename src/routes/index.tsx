import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import {
  Search,
  Radio,
  ChevronRight,
  Calendar,
  Flame,
  Trophy,
  Tv2,
  Zap,
  Sparkles,
} from "lucide-react";
import {
  getCategories,
  getCategoryChannels,
  getSubCategories,
} from "@/lib/yacine.functions";
import { getMatches } from "@/lib/matches.functions";
import { getAuraChannels } from "@/lib/auratv-channels.functions";

import { SiteHeader } from "@/components/SiteHeader";
import { MatchCard } from "@/components/MatchCard";

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
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

type Day = "yesterday" | "today" | "tomorrow";

function Home() {
  const fetchCats = useServerFn(getCategories);
  const fetchMatches = useServerFn(getMatches);
  const fetchSubs = useServerFn(getSubCategories);
  const fetchChannels = useServerFn(getCategoryChannels);
  const fetchAura = useServerFn(getAuraChannels);

  const { data: auraChannels, isLoading: auraLoading } = useQuery({
    queryKey: ["aura-channels"],
    queryFn: () => fetchAura(),
    staleTime: 10 * 60_000,
  });
  const [auraQ, setAuraQ] = useState("");
  const filteredAura = useMemo(() => {
    const list = auraChannels ?? [];
    if (!auraQ.trim()) return list;
    const n = auraQ.toLowerCase();
    return list.filter((c) => c.name.toLowerCase().includes(n) || c.key.toLowerCase().includes(n));
  }, [auraChannels, auraQ]);


  const { data: categories, isLoading: catsLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCats(),
    staleTime: 5 * 60_000,
  });

  const [day, setDay] = useState<Day>("today");
  const { data: matches, isLoading: matchesLoading } = useQuery({
    queryKey: ["matches", day],
    queryFn: () => fetchMatches({ data: { day } }),
    staleTime: 2 * 60_000,
  });

  const liveMatches = useMemo(() => (matches ?? []).filter((m) => m.status === "live"), [matches]);
  const otherMatches = useMemo(() => (matches ?? []).filter((m) => m.status !== "live"), [matches]);
  const featured = liveMatches[0] ?? matches?.[0];
  const totalMatches = matches?.length ?? 0;

  const [selected, setSelected] = useState<number | null>(null);
  const [selectedSub, setSelectedSub] = useState<number | null>(null);
  const [q, setQ] = useState("");

  const activeTopId = selected ?? categories?.[0]?.id ?? null;
  const activeTop = categories?.find((c) => c.id === activeTopId);
  const hasChildren = (activeTop?.child_count ?? 0) > 0;
  useEffect(() => setSelectedSub(null), [activeTopId]);

  const { data: subs, isLoading: subsLoading } = useQuery({
    queryKey: ["subs", activeTopId],
    queryFn: () => fetchSubs({ data: { categoryId: activeTopId! } }),
    enabled: hasChildren && activeTopId != null,
    staleTime: 5 * 60_000,
  });

  const effectiveCategoryId = hasChildren
    ? (selectedSub ?? subs?.[0]?.id ?? null)
    : activeTopId;

  const { data: channels, isLoading: chLoading } = useQuery({
    queryKey: ["channels", effectiveCategoryId],
    queryFn: () => fetchChannels({ data: { categoryId: effectiveCategoryId! } }),
    enabled: effectiveCategoryId != null,
    staleTime: 60_000,
  });

  const filteredChannels = useMemo(() => {
    if (!channels) return [];
    const visible = channels.filter((c) => c.is_hide === 0);
    if (!q.trim()) return visible;
    const needle = q.toLowerCase();
    return visible.filter((c) => c.name.toLowerCase().includes(needle));
  }, [channels, q]);

  const activeSub = subs?.find((s) => s.id === effectiveCategoryId);
  const channelsTitle = hasChildren
    ? `${activeTop?.name} — ${activeSub?.name ?? "…"}`
    : activeTop?.name ?? "Channels";

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-hero">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[720px] grid-backdrop" />
      <SiteHeader />

      {/* HERO */}
      <section className="relative">
        <div className="ambient-orbs pointer-events-none absolute inset-0 -z-10 overflow-hidden" />
        <div className="relative mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-16">
          <div className="grid items-center gap-8 lg:grid-cols-[1.35fr_1fr]">
            {/* Headline */}
            <div className="relative z-10 flex flex-col gap-6 animate-fade-up">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground backdrop-blur">
                <Sparkles className="h-3 w-3 text-accent" /> AuraTV · Live in your timezone
              </div>
              <h1 className="font-display text-[2.6rem] font-bold leading-[0.95] sm:text-6xl lg:text-7xl">
                Every match.
                <br />
                <span className="text-aurora">Every channel.</span>
                <br />
                <span className="text-foreground/90">One tap away.</span>
              </h1>
              <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
                Live sports, fixtures and HD TV — synced from beIN SPORTS, MBC, France TV and more.
                Adaptive quality, zero ads, your local time.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#matches"
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.03]"
                >
                  <Flame className="h-4 w-4 transition group-hover:rotate-12" /> Today's matches
                </a>
                <a
                  href="#channels"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-foreground backdrop-blur transition hover:bg-white/10"
                >
                  <Radio className="h-4 w-4" /> Browse channels
                </a>
              </div>

              {/* Stat strip */}
              <div className="mt-2 grid max-w-lg grid-cols-3 gap-3">
                <Stat
                  icon={<Zap className="h-3.5 w-3.5" />}
                  label="Live now"
                  value={liveMatches.length}
                  accent
                />
                <Stat
                  icon={<Trophy className="h-3.5 w-3.5" />}
                  label="Today's matches"
                  value={totalMatches}
                />
                <Stat
                  icon={<Tv2 className="h-3.5 w-3.5" />}
                  label="Categories"
                  value={categories?.length ?? 0}
                />
              </div>
            </div>

            {/* Featured match card */}
            <div className="relative z-10 conic-border rounded-3xl">
              <div className="relative rounded-3xl bg-card/40 p-2 backdrop-blur-xl">
                {matchesLoading ? (
                  <div className="h-80 animate-pulse rounded-2xl bg-card/70" />
                ) : featured ? (
                  <MatchCard match={featured} />
                ) : (
                  <div className="flex h-80 items-center justify-center rounded-2xl bg-card text-sm text-muted-foreground">
                    No matches scheduled.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live ticker */}
          {liveMatches.length > 0 && (
            <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur animate-fade-up">
              <div className="flex items-stretch">
                <div className="flex shrink-0 items-center gap-2 border-r border-white/10 bg-destructive/15 px-4 text-[11px] font-bold uppercase tracking-[0.22em] text-destructive">
                  <span className="live-dot" /> Live
                </div>
                <div className="marquee min-w-0 flex-1 py-3">
                  <div className="marquee-track px-6 text-sm">
                    {[...liveMatches, ...liveMatches].map((m, i) => (
                      <span key={`${m.id}-${i}`} className="flex items-center gap-2 whitespace-nowrap">
                        <span className="text-muted-foreground">{m.competition}</span>
                        <span className="font-semibold">{m.homeTeam}</span>
                        <span className="rounded bg-white/10 px-1.5 py-0.5 font-display tabular-nums">
                          {m.score && m.score !== "0-0" ? m.score : "VS"}
                        </span>
                        <span className="font-semibold">{m.awayTeam}</span>
                        <span className="text-xs text-primary">· {m.channel}</span>
                        <span className="mx-2 text-white/20">•</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* MATCHES */}
      <section id="matches" className="relative mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
              <Calendar className="h-3.5 w-3.5" /> Fixtures
            </div>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Match Schedule</h2>
          </div>
          <div className="flex shrink-0 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
            {(["yesterday", "today", "tomorrow"] as Day[]).map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest transition sm:px-4 ${
                  day === d
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {matchesLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl bg-card" />
            ))}
          </div>
        ) : (matches?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-muted-foreground">
            No matches found for {day}.
          </div>
        ) : (
          <>
            {liveMatches.length > 0 && (
              <>
                <SectionLabel
                  icon={<span className="live-dot" />}
                  label={`Live now · ${liveMatches.length}`}
                  tone="destructive"
                />
                <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {liveMatches.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </div>
              </>
            )}
            {otherMatches.length > 0 && (
              <>
                {liveMatches.length > 0 && (
                  <SectionLabel
                    icon={<Calendar className="h-3 w-3" />}
                    label="Upcoming & finished"
                    tone="muted"
                  />
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {otherMatches.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>

      {/* CHANNELS */}
      <section id="channels" className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
          <Radio className="h-3.5 w-3.5" /> Live TV
        </div>
        <h2 className="mb-6 font-display text-3xl font-bold sm:text-4xl">Channel Universe</h2>

        {/* Top categories */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-2 pb-2">
            {catsLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 w-32 animate-pulse rounded-full bg-white/5" />
              ))}
            {categories?.map((cat) => {
              const active = cat.id === activeTopId;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelected(cat.id)}
                  className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "border border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
                  }`}
                >
                  {cat.name}
                  {cat.child_count > 0 && (
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                        active ? "bg-primary-foreground/20" : "bg-white/10"
                      }`}
                    >
                      {cat.child_count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {hasChildren && (
          <div className="mt-3 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="flex items-center gap-2 pb-2">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Quality
              </span>
              {subsLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 w-28 animate-pulse rounded-full bg-white/5" />
                ))}
              {subs?.map((s) => {
                const active = s.id === effectiveCategoryId;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSub(s.id)}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "bg-foreground text-background"
                        : "border border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-5 mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <h3 className="truncate font-display text-xl font-bold">{channelsTitle}</h3>
            <p className="text-sm text-muted-foreground">
              {filteredChannels.length} channel{filteredChannels.length === 1 ? "" : "s"} available
            </p>
          </div>
          <div className="relative w-full shrink-0 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search channels…"
              className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground transition focus:border-primary focus:bg-white/[0.08]"
            />
          </div>
        </div>

        {chLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-xl bg-card" />
            ))}
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-muted-foreground">
            No channels found.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredChannels.map((ch) => (
              <Link
                key={ch.id}
                to="/watch/$channelId"
                params={{ channelId: String(ch.id) }}
                search={{ name: ch.name, logo: ch.logo }}
                className="group relative flex aspect-video flex-col justify-between overflow-hidden rounded-xl border border-white/5 bg-card-gradient p-3 shadow-card transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-glow"
              >
                {/* hover sheen */}
                <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <div className="relative flex items-start justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-destructive">
                    <span className="live-dot" /> Live
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
                </div>
                <div className="relative flex items-end justify-between gap-2">
                  {ch.logo ? (
                    <img
                      src={ch.logo}
                      alt={ch.name}
                      loading="lazy"
                      className="h-10 w-10 rounded-md bg-black/30 object-contain p-1 transition group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-black/30 text-primary">
                      <Radio className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 text-right">
                    <div className="truncate text-sm font-semibold">{ch.name}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* AURATV CHANNELS (from pastebin manifest) */}
      <section id="auratv" className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
          <Tv2 className="h-3.5 w-3.5" /> AuraTV Direct
        </div>
        <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Premium Sports Channels</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {auraChannels?.length ?? 0} channels · adaptive quality, beIN MAX locked to 720p
            </p>
          </div>
          <div className="relative w-full shrink-0 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={auraQ}
              onChange={(e) => setAuraQ(e.target.value)}
              placeholder="Search AuraTV channels…"
              className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground transition focus:border-primary focus:bg-white/[0.08]"
            />
          </div>
        </div>

        {auraLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-xl bg-card" />
            ))}
          </div>
        ) : filteredAura.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-muted-foreground">
            No AuraTV channels available.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredAura.map((ch) => (
              <Link
                key={ch.key}
                to="/watch/tv/$key"
                params={{ key: ch.key }}
                search={{ name: ch.name }}
                className="group relative flex aspect-video flex-col justify-between overflow-hidden rounded-xl border border-white/5 bg-card-gradient p-3 shadow-card transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-glow"
              >
                <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <div className="relative flex items-start justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-destructive">
                    <span className="live-dot" /> Live
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
                </div>
                <div className="relative flex items-end justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-black/30 text-primary">
                    <Radio className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 text-right">
                    <div className="truncate text-sm font-semibold capitalize">{ch.name}</div>
                    <div className="mt-0.5 truncate text-[10px] uppercase tracking-widest text-muted-foreground">
                      {ch.qualities.slice(0, 4).join(" · ")}
                      {ch.qualities.length > 4 ? ` +${ch.qualities.length - 4}` : ""}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>


      <footer className="relative border-t border-white/10 py-10 text-center">
        <div className="mx-auto max-w-7xl px-6">
          <div className="font-display text-lg font-bold">
            <span className="text-aurora">AuraTV</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Live sports & TV streaming · fixtures by syrlive · adaptive HD with auto-switching
          </p>
        </div>
      </footer>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur">
      <div
        className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
          accent ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {icon} {label}
      </div>
      <div
        className={`mt-1 font-display text-2xl font-bold tabular-nums ${
          accent ? "number-glow text-foreground" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function SectionLabel({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "destructive" | "muted";
}) {
  return (
    <div
      className={`mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] ${
        tone === "destructive" ? "text-destructive" : "text-muted-foreground"
      }`}
    >
      {icon} {label}
    </div>
  );
}
