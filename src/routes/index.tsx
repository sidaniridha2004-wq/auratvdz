import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, type ReactNode } from "react";
import { Search, RefreshCw, X } from "lucide-react";
import { getMatches } from "@/lib/matches.functions";
import { useChannels, CHANNELS_QUERY_KEY } from "@/lib/channels-client";
import { categoryFor } from "@/lib/channel-category";
import { SiteHeader } from "@/components/SiteHeader";
import { MatchCard } from "@/components/MatchCard";
import { ChannelCard } from "@/components/ChannelCard";
import { NowOnTvStrip } from "@/components/NowOnTvStrip";
import { Footer } from "@/components/Footer";
import { AdSlot } from "@/components/AdSlot";
import { useFavorites } from "@/lib/favorites";
import { useCustomChannels } from "@/lib/custom-channels";
import { useI18n } from "@/lib/i18n";
import { pageHead } from "@/lib/seo";
import { SITE, faqJsonLd } from "@/lib/site";
import { HOME_FAQ } from "@/content/faq";
import type { M3uChannel } from "@/lib/m3u-channels";

const homeSearchSchema = z.object({
  group: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/")({
  component: Home,
  validateSearch: homeSearchSchema,
  head: () =>
    pageHead({
      title: SITE.name,
      description: SITE.description,
      path: "/",
      jsonLd: faqJsonLd(HOME_FAQ),
    }),
  errorComponent: ({ error, reset }) => <ErrorView message={error.message} reset={reset} />,
});

function ErrorView({ message, reset }: { message: string; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <p className="text-destructive">{message}</p>
        <button
          type="button"
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="btn btn-primary mt-4"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

type Day = "yesterday" | "today" | "tomorrow";

function SectionHead({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="rule-heavy mb-5 flex flex-wrap items-end justify-between gap-3 pt-3">
      <div>
        <div className="kicker text-primary">{kicker}</div>
        <h2 className="mt-1 text-[1.6rem] sm:text-[2rem]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Home() {
  const { t } = useI18n();
  const fetchMatches = useServerFn(getMatches);
  const { favorites } = useFavorites();
  const { channels: customChannels } = useCustomChannels();
  const search = Route.useSearch();

  const [day, setDay] = useState<Day>("today");
  const { data: rawMatches, isLoading: matchesLoading } = useQuery({
    queryKey: ["matches", day],
    queryFn: () => fetchMatches({ data: { day } }),
    staleTime: 2 * 60_000,
  });

  const matches = useMemo(() => {
    const list = rawMatches ?? [];
    const sourceNow = new Date(Date.now() + 3 * 3600_000);
    const offset = day === "yesterday" ? -1 : day === "tomorrow" ? 1 : 0;
    sourceNow.setUTCDate(sourceNow.getUTCDate() + offset);
    const pad = (n: number) => String(n).padStart(2, "0");
    const targetKey = `${sourceNow.getUTCFullYear()}-${pad(sourceNow.getUTCMonth() + 1)}-${pad(sourceNow.getUTCDate())}`;
    return list.filter((m) => !m.kickoffIso || m.kickoffIso.slice(0, 10) === targetKey);
  }, [rawMatches, day]);

  const liveMatches = useMemo(() => matches.filter((m) => m.status === "live"), [matches]);
  const otherMatches = useMemo(() => matches.filter((m) => m.status !== "live"), [matches]);
  const nextMatch = useMemo(
    () =>
      matches
        .filter((m) => m.status === "soon" && m.kickoffIso)
        .sort((a, b) => new Date(a.kickoffIso!).getTime() - new Date(b.kickoffIso!).getTime())[0],
    [matches],
  );

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
    return `${Math.max(m, 1)} min`;
  }, [nextMatch, nowMs]);

  const qc = useQueryClient();
  const refreshChannels = () => qc.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY });

  const { channels: resolved, bySlug: resolvedBySlug, isLoading: channelsLoading, error: channelsError } = useChannels();

  const groups = useMemo(() => {
    const g: Record<string, M3uChannel[]> = {};
    for (const c of resolved) (g[c.group] ??= []).push(c);
    return g;
  }, [resolved]);
  const groupNames = useMemo(() => Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length), [groups]);
  const [activeGroup, setActiveGroup] = useState<string>(search.group ?? "");
  const currentGroup = groups[activeGroup] ? activeGroup : groupNames[0] || "";
  const [q, setQ] = useState(search.q ?? "");

  const isSearching = q.trim().length > 0;
  const filteredChannels = useMemo(() => {
    if (isSearching) {
      const n = q.toLowerCase();
      return resolved.filter(
        (c) => c.name.toLowerCase().includes(n) || c.slug.toLowerCase().includes(n) || c.group.toLowerCase().includes(n),
      );
    }
    return groups[currentGroup] ?? [];
  }, [resolved, groups, currentGroup, q, isSearching]);

  const favoriteChannels = useMemo(
    () => favorites.map((slug) => resolvedBySlug.get(slug)).filter(Boolean) as M3uChannel[],
    [favorites, resolvedBySlug],
  );

  const featuredSports = useMemo(
    () => resolved.filter((c) => /bein/i.test(c.name) || /bein/i.test(c.group)).slice(0, 8),
    [resolved],
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Ticker */}
      <div className="rule-b">
        <div className="wrap flex h-9 items-center gap-4 overflow-hidden text-[12px]">
          {liveMatches.length > 0 ? (
            <span className="badge badge-live shrink-0">
              <span className="live-dot" aria-hidden /> {liveMatches.length} live now
            </span>
          ) : (
            <span className="kicker shrink-0 text-muted-foreground">No match live right now</span>
          )}
          {nextMatch && (
            <span className="min-w-0 truncate text-muted-foreground">
              <span className="kicker">Next · </span>
              <span className="text-foreground" dir="auto">
                {nextMatch.homeTeam} v {nextMatch.awayTeam}
              </span>{" "}
              <span className="mono text-accent">{nextCountdown ?? nextMatch.time ?? ""}</span>
            </span>
          )}
          <span className="ml-auto hidden shrink-0 text-muted-foreground sm:inline">
            {channelsLoading ? "Loading channel list…" : channelsError ? "Channel list unavailable" : `${resolved.length} channels listed`}
          </span>
        </div>
      </div>

      <NowOnTvStrip />

      {/* Above the fold: headline + single clear CTA */}
      <section className="wrap grid gap-8 py-10 sm:py-14 lg:grid-cols-[1.1fr_1fr] lg:items-end">
        <div>
          <div className="kicker text-primary">Free live TV guide · Algeria</div>
          <h1 className="mt-3 text-[2.4rem] leading-[1.02] sm:text-[3.6rem]">
            Find the match.
            <br />
            Press play.
          </h1>
          <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
            Today’s fixtures, the channel showing them, and a working stream — beIN Sports, Algerian, French and Arabic TV, on any device, no account.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/" hash="channels" className="btn btn-primary">
              Watch live TV now
            </Link>
            <Link to="/" hash="matches" className="btn btn-outline">
              {t("hero.today")}
            </Link>
          </div>
          <p className="kicker mt-5 text-muted-foreground">
            No sign-up · Works on phone, PC and Android TV · {SITE.responseTime.replace("We answer every message ", "Support replies ")}
          </p>
        </div>

        {/* Right column: the next / current fixture as a listings box */}
        <div className="tile p-0">
          <div className="rule-b flex items-center justify-between px-4 py-2">
            <span className="kicker">{liveMatches.length > 0 ? "On air" : "Up next"}</span>
            <Link to="/" hash="matches" className="kicker text-primary hover:underline">
              Full schedule →
            </Link>
          </div>
          <div className="p-3">
            {matchesLoading ? (
              <div className="skeleton h-40" />
            ) : liveMatches[0] || nextMatch ? (
              <MatchCard match={(liveMatches[0] ?? nextMatch)!} />
            ) : (
              <div className="p-6 text-center text-[14px] text-muted-foreground">
                Nothing scheduled right now.{" "}
                <Link to="/" hash="channels" className="underline">
                  Browse channels
                </Link>
                .
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Featured sports row */}
      {featuredSports.length > 0 && (
        <section className="wrap pb-10">
          <SectionHead kicker="Most watched" title="Sports channels" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {featuredSports.map((c) => (
              <ChannelCard key={c.slug} slug={c.slug} name={c.name} group={c.group} logo={c.logo} href={{ to: "/watch/live/$slug", params: { slug: c.slug } }} featured />
            ))}
          </div>
        </section>
      )}

      <AdSlot id="top-banner-ad" />

      {/* Fixtures */}
      <section id="matches" className="wrap scroll-mt-20 py-10">
        <SectionHead kicker={t("section.fixtures")} title={t("section.schedule")}>
          <div role="tablist" aria-label="Day" className="flex rule-b">
            {(["yesterday", "today", "tomorrow"] as Day[]).map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={day === d}
                onClick={() => setDay(d)}
                className={`kicker -mb-px border-b-2 px-3 py-2 ${day === d ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {t(`day.${d}`)}
              </button>
            ))}
          </div>
        </SectionHead>

        {matchesLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-44" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="tile p-10 text-center text-[14px] text-muted-foreground">
            No matches listed for {t(`day.${day}`)}.{" "}
            <Link to="/" hash="channels" className="underline">
              Browse channels instead
            </Link>
            .
          </div>
        ) : (
          <>
            {liveMatches.length > 0 && (
              <>
                <div className="kicker mb-3 text-live">Live · {liveMatches.length}</div>
                <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {liveMatches.map((m) => (
                    <MatchCard key={m.id} match={m} />
                  ))}
                </div>
              </>
            )}
            {otherMatches.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {otherMatches.map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </div>
            )}
          </>
        )}
        <p className="mt-4 text-[12px] text-muted-foreground">
          Times shown in your device’s timezone. Fixtures update every two minutes.{" "}
          <Link to="/live" className="underline">
            See live events
          </Link>
          .
        </p>
      </section>

      {/* Favourites */}
      <section id="favorites" className="wrap scroll-mt-20 py-10">
        <SectionHead kicker="Saved on this device" title={t("section.favorites")} />
        {favoriteChannels.length === 0 ? (
          <div className="tile p-8 text-center text-[14px] text-muted-foreground">{t("favorites.empty")}</div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {favoriteChannels.map((c) => (
              <ChannelCard key={c.slug} slug={c.slug} name={c.name} group={c.group} logo={c.logo} href={{ to: "/watch/live/$slug", params: { slug: c.slug } }} />
            ))}
          </div>
        )}
      </section>

      <AdSlot id="mid-page-ad" />

      {/* Channel guide */}
      <section id="channels" className="wrap scroll-mt-20 py-10">
        <SectionHead kicker={t("section.live_tv")} title={t("section.channels")}>
          <label className="relative block w-full sm:w-80">
            <span className="sr-only">Search channels</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("search.channels")}
              type="search"
              className="field pl-9 pr-9"
            />
            {isSearching && (
              <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
        </SectionHead>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* Category list */}
          {!isSearching && (
            <nav aria-label="Channel categories" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
              <ul className="flex gap-1 lg:flex-col lg:gap-0">
                {groupNames.map((g) => {
                  const active = g === currentGroup;
                  return (
                    <li key={g} className="shrink-0 lg:rule-b">
                      <button
                        type="button"
                        onClick={() => setActiveGroup(g)}
                        aria-current={active ? "true" : undefined}
                        className={`flex w-full items-center justify-between gap-3 whitespace-nowrap px-3 py-2 text-left text-[14px] lg:px-0 ${active ? "font-semibold text-foreground underline lg:no-underline" : "text-muted-foreground hover:text-foreground"}`}
                        dir="auto"
                      >
                        <span>{g}</span>
                        <span className="mono text-[11px] text-muted-foreground">{groups[g].length}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}

          <div className={isSearching ? "lg:col-span-2" : ""}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-sans text-[15px] font-semibold" dir="auto">
                {isSearching ? `Results for “${q}”` : currentGroup}
              </h3>
              <span className="kicker">{filteredChannels.length} channels</span>
            </div>

            {channelsLoading && !channelsError ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="skeleton h-[70px]" />
                ))}
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="tile p-8 text-center text-[14px] text-muted-foreground">
                {isSearching ? `Nothing matches “${q}”.` : "The channel list is temporarily unavailable."}
                <div className="mt-4 flex justify-center gap-2">
                  {isSearching && (
                    <button type="button" onClick={() => setQ("")} className="btn btn-ghost btn-sm">
                      Clear search
                    </button>
                  )}
                  <button type="button" onClick={refreshChannels} className="btn btn-outline btn-sm">
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Reload list
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {filteredChannels.map((c) => (
                  <ChannelCard
                    key={c.slug}
                    slug={c.slug}
                    name={c.name}
                    group={c.group}
                    logo={c.logo}
                    href={{ to: "/watch/live/$slug", params: { slug: c.slug } }}
                    category={categoryFor(c.group, c.name)}
                  />
                ))}
              </div>
            )}

            {customChannels.length > 0 && (
              <div className="mt-10">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-sans text-[15px] font-semibold">My channels</h3>
                  <Link to="/settings/channels" className="kicker text-primary hover:underline">
                    Manage →
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {customChannels.map((c) => (
                    <ChannelCard key={c.id} slug={c.id} name={c.name} group="My channels" logo={c.logo} href={{ to: "/watch/tv/$key", params: { key: c.id }, search: { name: c.name } }} category={c.category} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* How it works + trust */}
      <section className="wrap py-10">
        <SectionHead kicker="How it works" title="Three steps, no account" />
        <ol className="grid gap-px bg-border sm:grid-cols-3">
          {[
            ["01", "Pick a match or channel", "Fixtures list the broadcaster; every channel is one tap away."],
            ["02", "Press play", "Streams start in a few seconds and adapt to your connection."],
            ["03", "Save what you watch", "Star channels to keep them at the top. Nothing leaves your device."],
          ].map(([n, h, p]) => (
            <li key={n} className="bg-background p-5">
              <div className="mono text-[12px] text-primary">{n}</div>
              <h3 className="mt-2 font-sans text-[16px] font-semibold">{h}</h3>
              <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{p}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ excerpt */}
      <section className="wrap py-10">
        <SectionHead kicker="Questions" title="Before you ask">
          <Link to="/faq" className="kicker text-primary hover:underline">
            All questions →
          </Link>
        </SectionHead>
        <dl className="grid gap-6 md:grid-cols-2">
          {HOME_FAQ.slice(0, 4).map((f) => (
            <div key={f.q} className="rule-b pb-5">
              <dt className="font-sans text-[15px] font-semibold">{f.q}</dt>
              <dd className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* About strip with internal links */}
      <section className="wrap py-10">
        <div className="tile grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="kicker text-primary">Who runs this</div>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              AuraTV is built in Algiers by a small team who were tired of hunting for a working link at kick-off. We index publicly available
              streams, we don’t host video, and we answer every message within a day. Read{" "}
              <Link to="/about" className="underline">
                about the team
              </Link>
              , see{" "}
              <Link to="/case-studies" className="underline">
                what we’ve fixed
              </Link>{" "}
              or{" "}
              <Link to="/contact" className="underline">
                get in touch
              </Link>
              .
            </p>
          </div>
          <Link to="/download" className="btn btn-outline">
            Get the Android app
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
