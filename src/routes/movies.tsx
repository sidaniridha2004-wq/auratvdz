import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, X } from "lucide-react";
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
} from "@/lib/media.functions";
import { pageHead } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/site";

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Movies & series", path: "/movies" },
];

const searchSchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  tab: z.enum(["movie", "tv"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(2000).optional().catch(undefined),
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
      const search = await searchMedia({ data: { q: deps.q, page: 1 } });
      return { home: null, catalogue: null, search, catalogueError: null };
    }
    const [home, catalogue] = await Promise.allSettled([
      getMediaHome(),
      getCatalogue({ data: { kind: deps.tab, page: deps.page } }),
    ]);
    return {
      home: home.status === "fulfilled" ? home.value : null,
      catalogue: catalogue.status === "fulfilled" ? catalogue.value : null,
      search: null,
      catalogueError: catalogue.status === "rejected" ? (catalogue.reason instanceof Error ? catalogue.reason.message : "Unavailable") : null,
    };
  },
  head: ({ match }) => {
    const deps = (match?.loaderDeps ?? {}) as { q?: string; tab?: string; page?: number };
    const q = deps.q;
    return pageHead({
      title: q ? `Search results for “${q}”` : deps.tab === "tv" ? "TV series on demand" : "Movies and TV series on demand",
      description:
        "Search tens of thousands of films and series, read the synopsis and cast, pick a season and episode, and press play. Every title listed is available to stream.",
      path: "/movies",
      noindex: Boolean(q) || (deps.page ?? 1) > 1,
      jsonLd: breadcrumbJsonLd(CRUMBS),
    });
  },
  component: MoviesPage,
});

function SearchBox({ initial }: { initial: string }) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initial);
  return (
    <form
      role="search"
      className="flex w-full max-w-xl items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        navigate({ to: "/movies", search: q ? { q } : {} });
      }}
    >
      <label className="field flex flex-1 items-center gap-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search a film, a series or an IMDb id (tt…)"
          aria-label="Search movies and series"
          autoComplete="off"
          className="w-full bg-transparent outline-none"
        />
        {value && (
          <button type="button" aria-label="Clear search" onClick={() => setValue("")} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </label>
      <button type="submit" className="btn btn-primary">
        Search
      </button>
    </form>
  );
}

function NotConfigured() {
  return (
    <div className="tile p-6">
      <div className="kicker text-primary">Catalogue not configured</div>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Titles, artwork and episode lists come from TMDB. Add a <code className="mono">TMDB_API_KEY</code> environment variable on the
        server and reload this page.
      </p>
    </div>
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
      <Link to="/movies" search={{ tab, page: p }} className="btn btn-ghost btn-sm">
        {label}
      </Link>
    );
  return (
    <nav aria-label="Catalogue pages" className="mt-6 flex items-center justify-between">
      {link(page - 1, "← Previous", page <= 1)}
      <span className="kicker text-muted-foreground">
        Page {page} of {totalPages.toLocaleString()}
      </span>
      {link(page + 1, "Next →", page >= totalPages)}
    </nav>
  );
}

function MoviesPage() {
  const { home, catalogue, search, catalogueError } = Route.useLoaderData();
  const { q, tab = "movie" } = Route.useSearch();
  const configured = search ? search.configured : home ? home.configured : true;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="wrap py-8 sm:py-12">
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
              <p className="text-[15px] text-muted-foreground">
                Nothing playable matched. Try the original title, a shorter phrase or the IMDb id.
              </p>
            )}
          </section>
        )}

        {!search && configured && (
          <>
            {home?.error && !home.rows.length && (
              <p className="mt-8 text-[15px] text-destructive">{home.error}</p>
            )}
            <div className="mt-8 space-y-10">
              {home?.rows.map((row) => (
                <MediaRow
                  key={row.key}
                  title={row.title}
                  items={row.items}
                  moreHref={{ to: "/movies", search: { tab: row.key.endsWith("-tv") ? "tv" : "movie" } }}
                />
              ))}
            </div>

            <section id="all" className="rule-heavy mt-12 pt-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[1.35rem]">Everything available</h2>
                <div role="tablist" aria-label="Catalogue type" className="flex gap-1">
                  {(
                    [
                      ["movie", `Films${home ? ` (${home.counts.movies.toLocaleString()})` : ""}`],
                      ["tv", `Series${home ? ` (${home.counts.shows.toLocaleString()})` : ""}`],
                    ] as const
                  ).map(([key, label]) => (
                    <Link
                      key={key}
                      role="tab"
                      aria-selected={tab === key}
                      to="/movies"
                      search={{ tab: key }}
                      hash="all"
                      className={`btn btn-sm ${tab === key ? "btn-primary" : "btn-ghost"}`}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
              <p className="kicker mb-4 text-muted-foreground">Newest first · {CATALOGUE_PAGE_SIZE} per page</p>
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
