import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { Search, Radio, ChevronRight, Calendar, Flame } from "lucide-react";
import {
  getCategories,
  getCategoryChannels,
  getSubCategories,
} from "@/lib/yacine.functions";
import { getMatches } from "@/lib/matches.functions";
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
    <div className="min-h-screen bg-hero">
      <SiteHeader />

      {/* Hero / featured match */}
      <section className="relative mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Headline */}
          <div className="flex flex-col justify-center gap-5">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
              <span className="live-dot" /> {liveMatches.length} live matches now
            </div>
            <h1 className="text-5xl font-bold leading-[0.95] sm:text-6xl">
              The match.
              <br />
              <span className="text-primary">The channel.</span>
              <br />
              One click.
            </h1>
            <p className="max-w-xl text-base text-muted-foreground">
              Live sports, scores, and HD channels in one place. Real-time fixtures from syrlive,
              streamed via beIN SPORTS, MBC, France TV and more.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="#matches"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90"
              >
                <Flame className="h-4 w-4" /> Today's matches
              </a>
              <a
                href="#channels"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                <Radio className="h-4 w-4" /> Browse channels
              </a>
            </div>
          </div>

          {/* Featured match card */}
          <div className="rounded-3xl border border-border bg-card/40 p-2 backdrop-blur">
            {matchesLoading ? (
              <div className="h-72 animate-pulse rounded-2xl bg-card" />
            ) : featured ? (
              <MatchCard match={featured} />
            ) : (
              <div className="flex h-72 items-center justify-center rounded-2xl bg-card text-sm text-muted-foreground">
                No matches scheduled.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Matches */}
      <section id="matches" className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
              <Calendar className="h-3.5 w-3.5" /> Fixtures
            </div>
            <h2 className="mt-1 text-3xl font-bold">Matches</h2>
          </div>
          <div className="flex rounded-full border border-border bg-card/60 p-1">
            {(["yesterday", "today", "tomorrow"] as Day[]).map((d) => (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest transition ${
                  day === d
                    ? "bg-primary text-primary-foreground"
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
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            No matches found for {day}.
          </div>
        ) : (
          <>
            {liveMatches.length > 0 && (
              <>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <span className="live-dot" /> Live now
                </div>
                <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {liveMatches.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </div>
              </>
            )}
            {otherMatches.length > 0 && (
              <>
                {liveMatches.length > 0 && (
                  <div className="mb-3 text-sm font-semibold text-muted-foreground">
                    Upcoming & finished
                  </div>
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

      {/* Channels */}
      <section id="channels" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
          <Radio className="h-3.5 w-3.5" /> Live TV
        </div>
        <h2 className="mb-5 text-3xl font-bold">Channels</h2>

        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-2 pb-2">
            {catsLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 w-32 animate-pulse rounded-full bg-secondary" />
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
                      : "border border-border bg-card/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat.name}
                  {cat.child_count > 0 && (
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                        active ? "bg-primary-foreground/20" : "bg-secondary"
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
              <span className="mr-1 text-xs uppercase tracking-widest text-muted-foreground">
                Quality
              </span>
              {subsLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 w-28 animate-pulse rounded-full bg-secondary" />
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
                        : "border border-border bg-card/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-bold">{channelsTitle}</h3>
            <p className="text-sm text-muted-foreground">
              {filteredChannels.length} channel{filteredChannels.length === 1 ? "" : "s"} available
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search channels…"
              className="w-full rounded-full border border-border bg-card/60 py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
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
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
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
                className="group relative flex aspect-video flex-col justify-between overflow-hidden rounded-xl bg-card-gradient p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-glow"
              >
                <div className="flex items-start justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-destructive">
                    <span className="live-dot" /> Live
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
                </div>
                <div className="flex items-end justify-between gap-2">
                  {ch.logo ? (
                    <img
                      src={ch.logo}
                      alt={ch.name}
                      loading="lazy"
                      className="h-10 w-10 rounded-md bg-black/30 object-contain p-1"
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

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        AuraTV · live sports & TV streaming · fixtures by syrlive
      </footer>
    </div>
  );
}
