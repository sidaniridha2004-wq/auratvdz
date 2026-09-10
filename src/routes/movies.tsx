import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Captions, ChevronLeft, ChevronRight, Info, Play, Search, Server, Star, X } from "lucide-react";
import { z } from "zod";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/PageShell";
import { MediaGrid, MediaRow } from "@/components/MediaCard";
import {
  CATALOGUE_PAGE_SIZE,
  getCatalogue,
  getMediaHome,
  searchMedia,
  type CataloguePage,
  type MediaHome,
  type SearchResult,
  type TitleSummary,
} from "@/lib/media.functions";
import { pageHead } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/site";

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Movies & series", path: "/movies" },
];

const HERO_EVERY_MS = 7_000;
/** Never let a slow upstream kill the page render: cap the loader. */
const LOADER_BUDGET_MS = 12_000;

function withBudget<T>(p: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), LOADER_BUDGET_MS))]).catch(() => fallback);
}

const searchSchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  tab: z.enum(["movie", "tv"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(5000).optional().catch(undefined),
});

type LoaderData = {
  home: MediaHome | null;
  catalogue: CataloguePage | null;
  search: SearchResult | null;
  catalogueError: string | null;
};

export const Route = createFileRoute("/movies")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ q: search.q, tab: search.tab ?? "movie", page: search.page ?? 1 }),
  loader: async ({ deps }): Promise<LoaderData> => {
    if (deps.q) {
      const search = await withBudget(searchMedia({ data: { q: deps.q, page: 1 } }), null);
      return { home: null, catalogue: null, search, catalogueError: null };
    }
    const [home, catalogue] = await Promise.all([
      withBudget(getMediaHome(), null),
      withBudget(getCatalogue({ data: { kind: deps.tab, page: deps.page } }), null),
    ]);
    return {
      home,
      catalogue,
      search: null,
      catalogueError: catalogue === null ? "The catalogue is still loading — refresh in a few seconds." : null,
    };
  },
  head: ({ match }) => {
    const deps = (match?.loaderDeps ?? {}) as { q?: string; tab?: string; page?: number };
    const q = deps.q;
    return pageHead({
      title: q ? `Search results for “${q}”` : deps.tab === "tv" ? "TV series on demand" : "Movies and TV series on demand",
      description:
        "Over a hundred thousand films and series from two streaming servers, merged without duplicates. Arabic subtitles load automatically, and you can switch server or quality mid-film.",
      path: "/movies",
      noindex: Boolean(q) || (deps.page ?? 1) > 1,
      jsonLd: breadcrumbJsonLd(CRUMBS),
    });
  },
  component: MoviesPage,
});

// ------------------------------------------------------------------ pieces

function SearchBox({ initial, large }: { initial: string; large?: boolean }) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initial);
  return (
    <form
      role="search"
      className={`glass flex w-full items-center gap-2 rounded-full pl-4 pr-1.5 ${large ? "h-14 max-w-2xl" : "h-12 max-w-xl"}`}
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        navigate({ to: "/movies", search: q ? { q } : {} });
      }}
    >
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search a film, a series or an IMDb id (tt…)"
        aria-label="Search movies and series"
        autoComplete="off"
        className={`w-full bg-transparent outline-none placeholder:text-muted-foreground/70 ${large ? "text-[16px]" : "text-[15px]"}`}
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => setValue("")} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      )}
      <button type="submit" className={`btn btn-primary rounded-full ${large ? "h-11 px-5" : "btn-sm h-9 px-4"}`}>
        Search
      </button>
    </form>
  );
}

function NotConfigured() {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="kicker text-primary">Catalogue not configured</div>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Titles, artwork and episode lists come from TMDB. Add a <code className="mono">TMDB_API_KEY</code> environment variable on the server and
        reload this page.
      </p>
    </div>
  );
}

function Hero({ items, home }: { items: TitleSummary[]; home: MediaHome | null }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = items.length;

  useEffect(() => {
    if (paused || count < 2) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), HERO_EVERY_MS);
    return () => window.clearInterval(t);
  }, [count, paused]);

  const current = items[index] ?? items[0];
  if (!current) return null;
  const playTo = current.kind === "movie" ? "/play/movie/$id" : "/title/$kind/$id";
  const playParams = current.kind === "movie" ? { id: String(current.id) } : { kind: current.kind, id: String(current.id) };

  return (
    <section
      className="relative -mt-px min-h-[72vh] overflow-hidden bg-black text-white sm:min-h-[78vh]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      {items.map((t, i) => (
        <img
          key={`${t.kind}-${t.id}`}
          src={t.backdrop ?? t.poster ?? ""}
          alt=""
          aria-hidden
          decoding="async"
          loading={i === 0 ? "eager" : "lazy"}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${i === index ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="hero-grain absolute inset-0 opacity-40" aria-hidden />

      <div className="wrap relative flex min-h-[72vh] flex-col justify-end pb-12 pt-28 sm:min-h-[78vh] sm:pb-16">
        <div className="mb-6 text-white/70">
          <Breadcrumbs items={CRUMBS} />
        </div>
        <div key={`${current.kind}-${current.id}`} className="hero-in max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="rounded-md bg-primary px-2 py-0.5 font-semibold uppercase tracking-[.14em] text-primary-foreground">
              {current.kind === "movie" ? "Film" : "Series"}
            </span>
            {current.year && <span className="text-white/75">{current.year}</span>}
            {current.rating !== null && current.rating > 0 && (
              <span className="inline-flex items-center gap-1 text-accent">
                <Star className="h-3.5 w-3.5 fill-current" aria-hidden /> {current.rating.toFixed(1)}
              </span>
            )}
          </div>
          <h1 className="mt-3 font-display text-[2.4rem] leading-[1.02] drop-shadow-lg sm:text-[4rem]" dir="auto">
            {current.title}
          </h1>
          {current.overview && <p className="mt-4 line-clamp-3 max-w-xl text-[15px] leading-relaxed text-white/80 sm:text-[17px]">{current.overview}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to={playTo} params={playParams} className="btn btn-primary glow-primary h-12 rounded-full px-6 text-[15px]">
              <Play className="h-4 w-4 fill-current" aria-hidden /> {current.kind === "movie" ? "Play now" : "Episodes"}
            </Link>
            <Link to="/title/$kind/$id" params={{ kind: current.kind, id: String(current.id) }} className="glass inline-flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-semibold hover:bg-white/15">
              <Info className="h-4 w-4" aria-hidden /> More info
            </Link>
          </div>
        </div>

        <div className="mt-10">
          <SearchBox initial="" large />
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-white/65">
            {home && home.counts.movies > 0 && (
              <span>
                <strong className="text-white">{home.counts.movies.toLocaleString()}</strong> films · <strong className="text-white">{home.counts.shows.toLocaleString()}</strong> series
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5" aria-hidden /> 2 servers, automatic switch
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Captions className="h-3.5 w-3.5" aria-hidden /> Arabic subtitles on by default
            </span>
          </div>
        </div>

        {count > 1 && (
          <div className="absolute bottom-12 right-4 hidden items-center gap-2 sm:right-6 sm:flex">
            <button type="button" onClick={() => setIndex((i) => (i - 1 + count) % count)} className="glass grid h-9 w-9 place-items-center rounded-full hover:bg-white/15" aria-label="Previous title">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Featured titles">
              {items.map((t, i) => (
                <button
                  key={`${t.kind}-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={t.title}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
                />
              ))}
            </div>
            <button type="button" onClick={() => setIndex((i) => (i + 1) % count)} className="glass grid h-9 w-9 place-items-center rounded-full hover:bg-white/15" aria-label="Next title">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Pager({ page, totalPages, tab }: { page: number; totalPages: number; tab: "movie" | "tv" }) {
  if (totalPages <= 1) return null;
  const link = (p: number, label: string, disabled: boolean) =>
    disabled ? (
      <span className="btn btn-ghost btn-sm opacity-50" aria-disabled>
        {label}
      </span>
    ) : (
      <Link to="/movies" search={{ tab, page: p }} hash="all" className="btn btn-ghost btn-sm">
        {label}
      </Link>
    );
  return (
    <nav aria-label="Catalogue pages" className="mt-6 flex items-center justify-between">
      {link(page - 1, "← Previous", page <= 1)}
      <span className="kicker text-muted-foreground">
        Page {page.toLocaleString()} of {totalPages.toLocaleString()}
      </span>
      {link(page + 1, "Next →", page >= totalPages)}
    </nav>
  );
}

// ------------------------------------------------------------------- page

function MoviesPage() {
  const { home, catalogue, search, catalogueError } = Route.useLoaderData();
  const { q, tab = "movie" } = Route.useSearch();
  const configured = search ? search.configured : home ? home.configured : true;
  const showHero = !search && configured && Boolean(home?.featured.length);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      {showHero && home && <Hero items={home.featured} home={home} />}

      <main className={`wrap ${showHero ? "pb-12 pt-4" : "py-8 sm:py-12"}`}>
        {!showHero && (
          <>
            <div className="mb-6">
              <Breadcrumbs items={CRUMBS} />
            </div>
            <header className="rule-heavy pt-4">
              <div className="kicker text-primary">On demand</div>
              <h1 className="mt-2 text-[2rem] sm:text-[2.75rem]">Movies &amp; series</h1>
              <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-muted-foreground">
                {home && home.counts.movies > 0
                  ? `${home.counts.movies.toLocaleString()} films and ${home.counts.shows.toLocaleString()} series, every one of them ready to play.`
                  : "Find a film or a series, read about it, pick an episode and press play."}
              </p>
              <div className="mt-5">
                <SearchBox initial={q ?? ""} />
              </div>
            </header>
          </>
        )}

        {!configured && (
          <div className="mt-8">
            <NotConfigured />
          </div>
        )}

        {search && configured && (
          <section className="mt-8" aria-live="polite">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[1.35rem]">
                {search.results.length ? `${search.results.length} result${search.results.length === 1 ? "" : "s"}` : "No results"} for “{search.query}”
              </h2>
              <Link to="/movies" className="kicker text-muted-foreground hover:text-foreground hover:underline">
                Back to browse
              </Link>
            </div>
            {search.results.length ? (
              <MediaGrid items={search.results} />
            ) : (
              <p className="text-[15px] text-muted-foreground">Nothing playable matched. Try the original title, a shorter phrase or the IMDb id.</p>
            )}
          </section>
        )}

        {!search && configured && (
          <>
            {home?.error && !home.rows.length && <p className="mt-8 text-[15px] text-destructive">{home.error}</p>}
            <div className="mt-8 space-y-10">
              {home?.rows.map((row, i) => (
                <MediaRow
                  key={row.key}
                  eyebrow={row.key.endsWith("-tv") ? "Series" : "Films"}
                  title={row.title}
                  items={row.items}
                  ranked={i === 0}
                  moreHref={{ to: "/movies", search: { tab: row.key.endsWith("-tv") ? "tv" : "movie" }, hash: "all" }}
                />
              ))}
            </div>

            <section id="all" className="mt-14 scroll-mt-24">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="kicker text-primary">Library</div>
                  <h2 className="text-[1.6rem] sm:text-[2rem]">Everything available</h2>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Both servers merged, duplicates removed · newest first · {CATALOGUE_PAGE_SIZE} per page
                  </p>
                </div>
                <div role="tablist" aria-label="Catalogue type" className="glass inline-flex rounded-full p-1">
                  {(
                    [
                      ["movie", "Films", home?.counts.movies],
                      ["tv", "Series", home?.counts.shows],
                    ] as const
                  ).map(([key, label, n]) => (
                    <Link
                      key={key}
                      role="tab"
                      aria-selected={tab === key}
                      to="/movies"
                      search={{ tab: key }}
                      hash="all"
                      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors ${tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {label}
                      {n ? <span className={`font-mono text-[11px] ${tab === key ? "text-primary-foreground/80" : "text-muted-foreground/70"}`}>{n.toLocaleString()}</span> : null}
                    </Link>
                  ))}
                </div>
              </div>
              {catalogue ? (
                <>
                  {catalogue.items.length ? <MediaGrid items={catalogue.items} /> : <p className="text-muted-foreground">Nothing on this page.</p>}
                  <Pager page={catalogue.page} totalPages={catalogue.totalPages} tab={tab} />
                </>
              ) : (
                <p className="text-[15px] text-destructive">{catalogueError ?? "The catalogue could not be loaded."}</p>
              )}
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
