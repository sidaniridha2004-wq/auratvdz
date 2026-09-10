import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Captions, Clock, ExternalLink, Play, Server, Star } from "lucide-react";
import { z } from "zod";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/PageShell";
import {
  getMovie,
  getShow,
  type CastMember,
  type Episode,
  type MovieDetail,
  type SeasonDetail,
  type ServerId,
  type ShowDetail,
} from "@/lib/media.functions";
import { episodeKey, formatClock, isFinished, movieKey, readProgress, resumePoint, showKey, type Progress } from "@/lib/resume";
import { pageHead } from "@/lib/seo";
import { SITE, absoluteUrl, breadcrumbJsonLd } from "@/lib/site";

const paramsSchema = z.object({
  kind: z.enum(["movie", "tv"]),
  id: z.coerce.number().int().min(1).max(99_999_999),
});

const searchSchema = z.object({
  season: z.coerce.number().int().min(0).max(200).optional().catch(undefined),
});

type LoaderData =
  | { kind: "movie"; movie: MovieDetail; available: boolean; servers: ServerId[] }
  | { kind: "tv"; show: ShowDetail; season: SeasonDetail | null; available: boolean; servers: ServerId[] };

const SERVER_NAMES: Record<ServerId, string> = { vixsrc: "Server 1", vidapi: "Server 2" };

function titleOf(data: LoaderData): string {
  return data.kind === "movie" ? data.movie.title : data.show.title;
}

function crumbsFor(data: LoaderData) {
  return [
    { name: "Home", path: "/" },
    { name: "Movies & series", path: "/movies" },
    { name: titleOf(data), path: `/title/${data.kind}/${data.kind === "movie" ? data.movie.id : data.show.id}` },
  ];
}

export const Route = createFileRoute("/title/$kind/$id")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ season: search.season }),
  loader: async ({ params, deps }): Promise<LoaderData> => {
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) throw notFound();
    const { kind, id } = parsed.data;
    try {
      if (kind === "movie") {
        const { movie, available, servers } = await getMovie({ data: { id } });
        return { kind, movie, available, servers };
      }
      const { show, season, available, servers } = await getShow({ data: { id, season: deps.season } });
      return { kind, show, season, available, servers };
    } catch (error) {
      if (error instanceof Error && /not found/i.test(error.message)) throw notFound();
      throw error;
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return pageHead({ title: "Title", description: "Movie or series details.", path: "/movies", noindex: true });
    const data = loaderData as LoaderData;
    const item = data.kind === "movie" ? data.movie : data.show;
    const label = data.kind === "movie" ? "film" : "series";
    const desc = item.overview || `Watch the ${label} ${item.title}${item.year ? ` (${item.year})` : ""} on ${SITE.name}.`;
    const path = `/title/${data.kind}/${item.id}`;
    const jsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": data.kind === "movie" ? "Movie" : "TVSeries",
      name: item.title,
      url: absoluteUrl(path),
      image: item.poster ?? undefined,
      description: item.overview || undefined,
      genre: item.genres.map((g) => g.name),
      actor: item.cast.slice(0, 6).map((c) => ({ "@type": "Person", name: c.name })),
    };
    if (item.rating !== null && item.votes > 0) {
      jsonLd.aggregateRating = { "@type": "AggregateRating", ratingValue: item.rating, bestRating: 10, ratingCount: item.votes };
    }
    if (data.kind === "movie" && data.movie.releaseDate) jsonLd.datePublished = data.movie.releaseDate;
    if (data.kind === "tv") jsonLd.numberOfSeasons = data.show.seasons.length;
    return pageHead({
      title: `${item.title}${item.year ? ` (${item.year})` : ""} — ${data.kind === "movie" ? "Film" : "Series"}`,
      description: desc,
      path,
      image: item.backdrop ?? item.poster ?? undefined,
      type: "article",
      jsonLd: [jsonLd, breadcrumbJsonLd(crumbsFor(data))],
    });
  },
  component: TitlePage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="wrap py-24 text-center">
          <p className="text-destructive">{error.message}</p>
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
  },
  notFoundComponent: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="wrap py-24 text-center text-muted-foreground">
        We could not find that title.{" "}
        <Link to="/movies" className="underline">
          Browse movies and series
        </Link>
        .
      </div>
    </div>
  ),
});

function minutes(n: number | null): string | null {
  if (!n) return null;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return h ? `${h}h ${m ? `${m}m` : ""}`.trim() : `${m}m`;
}

function Meta({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-[.12em] text-white/70">{children}</span>;
}

function ServerBadges({ servers }: { servers: ServerId[] }) {
  if (!servers.length) return null;
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Available servers">
      {servers.map((s) => (
        <li key={s} className="glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-live shadow-[0_0_8px_rgba(46,194,126,.9)]" aria-hidden />
          <Server className="h-3 w-3 opacity-70" aria-hidden /> {SERVER_NAMES[s]}
        </li>
      ))}
      <li className="glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] text-white/80">
        <Captions className="h-3 w-3 opacity-70" aria-hidden /> Arabic subtitles
      </li>
    </ul>
  );
}

function CastStrip({ cast }: { cast: CastMember[] }) {
  if (!cast.length) return null;
  return (
    <section className="mt-12">
      <div className="kicker text-primary">Cast</div>
      <h2 className="mb-4 text-[1.35rem] sm:text-[1.6rem]">Who is in it</h2>
      <ul className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        {cast.map((c) => (
          <li key={`${c.name}-${c.character}`} className="w-[110px] shrink-0">
            {c.photo ? (
              <img src={c.photo} alt={c.name} loading="lazy" decoding="async" width={185} height={278} className="aspect-[2/3] w-full rounded-xl object-cover ring-1 ring-white/10" />
            ) : (
              <div className="grid aspect-[2/3] w-full place-items-center rounded-xl bg-muted font-display text-2xl text-muted-foreground ring-1 ring-white/10" aria-hidden>
                {c.name.slice(0, 1)}
              </div>
            )}
            <div className="mt-2 line-clamp-1 text-[13px] font-semibold">{c.name}</div>
            <div className="line-clamp-1 text-[12px] text-muted-foreground">{c.character}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Play / Resume button. Progress lives in localStorage, so it renders after mount. */
function PlayButton({ movie }: { movie: MovieDetail }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  useEffect(() => setProgress(readProgress(movieKey(movie.id))), [movie.id]);
  const at = resumePoint(progress);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link to="/play/movie/$id" params={{ id: String(movie.id) }} className="btn btn-primary glow-primary h-12 rounded-full px-6 text-[15px]">
        <Play className="h-5 w-5 fill-current" aria-hidden />
        {at > 0 ? `Resume from ${formatClock(at)}` : isFinished(progress) ? "Watch again" : "Play now"}
      </Link>
      {at > 0 && (
        <Link to="/play/movie/$id" params={{ id: String(movie.id) }} search={{ t: 0 }} className="glass inline-flex h-12 items-center rounded-full px-5 text-[15px] font-semibold text-white hover:bg-white/15">
          Start over
        </Link>
      )}
    </div>
  );
}

function ContinueButton({ show }: { show: ShowDetail }) {
  const [pointer, setPointer] = useState<Progress | null>(null);
  useEffect(() => setPointer(readProgress(showKey(show.id))), [show.id]);
  const first = show.seasons[0];
  if (pointer && pointer.season !== undefined && pointer.episode !== undefined) {
    const ep = readProgress(episodeKey(show.id, pointer.season, pointer.episode));
    const at = resumePoint(ep);
    return (
      <Link
        to="/play/tv/$id/$season/$episode"
        params={{ id: String(show.id), season: String(pointer.season), episode: String(pointer.episode) }}
        className="btn btn-primary glow-primary h-12 rounded-full px-6 text-[15px]"
      >
        <Play className="h-5 w-5 fill-current" aria-hidden />
        {at > 0 ? `Resume S${pointer.season} E${pointer.episode} · ${formatClock(at)}` : `Continue S${pointer.season} E${pointer.episode}`}
      </Link>
    );
  }
  if (!first) return null;
  return (
    <Link
      to="/play/tv/$id/$season/$episode"
      params={{ id: String(show.id), season: String(first.number), episode: "1" }}
      className="btn btn-primary glow-primary h-12 rounded-full px-6 text-[15px]"
    >
      <Play className="h-5 w-5 fill-current" aria-hidden />
      Play S{first.number} E1
    </Link>
  );
}

function EpisodeRow({ showId, episode }: { showId: number; episode: Episode }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  useEffect(() => setProgress(readProgress(episodeKey(showId, episode.season, episode.number))), [showId, episode.season, episode.number]);
  const pct = progress && progress.d > 0 ? Math.min(100, Math.round((progress.t / progress.d) * 100)) : 0;
  return (
    <li>
      <Link
        to="/play/tv/$id/$season/$episode"
        params={{ id: String(showId), season: String(episode.season), episode: String(episode.number) }}
        className="group flex gap-4 rounded-2xl p-3 ring-1 ring-white/[.06] transition-all hover:bg-white/[.04] hover:ring-white/15"
      >
        <div className="relative w-[140px] shrink-0 overflow-hidden rounded-xl sm:w-[200px]">
          {episode.still ? (
            <img src={episode.still} alt="" loading="lazy" decoding="async" width={500} height={281} className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="grid aspect-video w-full place-items-center bg-muted font-display text-xl text-muted-foreground" aria-hidden>
              {episode.number}
            </div>
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_24px_rgba(217,39,47,.6)]">
              <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden />
            </span>
          </span>
          {pct > 0 && (
            <span className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
              <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="line-clamp-1 text-[15px] font-semibold">
              <span className="font-mono text-muted-foreground">{String(episode.number).padStart(2, "0")}</span> {episode.name}
            </h3>
            {episode.runtime ? <span className="shrink-0 font-mono text-[12px] text-muted-foreground">{minutes(episode.runtime)}</span> : null}
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground sm:line-clamp-3">{episode.overview || "No synopsis yet."}</p>
          <div className="mt-2 flex gap-3 font-mono text-[11px] text-muted-foreground">
            {episode.airDate && <span>{episode.airDate}</span>}
            {episode.rating !== null && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 fill-current text-accent" aria-hidden /> {episode.rating.toFixed(1)}
              </span>
            )}
            {pct > 0 && <span className="text-primary">{pct}% watched</span>}
          </div>
        </div>
      </Link>
    </li>
  );
}

function Seasons({ show, season }: { show: ShowDetail; season: SeasonDetail | null }) {
  if (!show.seasons.length) return <p className="mt-8 text-muted-foreground">No episodes listed yet.</p>;
  const current = season?.number ?? show.seasons[0].number;
  return (
    <section className="mt-12">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="kicker text-primary">Episodes</div>
          <h2 className="text-[1.35rem] sm:text-[1.6rem]">{season?.name ?? `Season ${current}`}</h2>
        </div>
        <label className="flex items-center gap-2">
          <span className="kicker text-muted-foreground">Season</span>
          <SeasonSelect show={show} current={current} />
        </label>
      </div>
      <div role="tablist" aria-label="Seasons" className="no-scrollbar -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {show.seasons.map((s) => (
          <Link
            key={s.number}
            role="tab"
            aria-selected={s.number === current}
            to="/title/$kind/$id"
            params={{ kind: "tv", id: String(show.id) }}
            search={{ season: s.number }}
            resetScroll={false}
            className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${s.number === current ? "bg-primary text-primary-foreground" : "glass text-white/80 hover:text-white"}`}
          >
            {s.name === `Season ${s.number}` ? `S${s.number}` : s.name}
            <span className="ml-1 opacity-70">· {s.episodeCount}</span>
          </Link>
        ))}
      </div>
      {season ? (
        <>
          {season.overview && <p className="mb-4 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">{season.overview}</p>}
          <ul className="grid gap-3">
            {season.episodes.map((ep) => (
              <EpisodeRow key={ep.number} showId={show.id} episode={ep} />
            ))}
          </ul>
        </>
      ) : (
        <p className="text-muted-foreground">This season could not be loaded.</p>
      )}
    </section>
  );
}

function SeasonSelect({ show, current }: { show: ShowDetail; current: number }) {
  const router = useRouter();
  return (
    <select
      className="field"
      value={current}
      aria-label="Choose a season"
      onChange={(e) =>
        router.navigate({
          to: "/title/$kind/$id",
          params: { kind: "tv", id: String(show.id) },
          search: { season: Number(e.target.value) },
          resetScroll: false,
        })
      }
    >
      {show.seasons.map((s) => (
        <option key={s.number} value={s.number}>
          {s.name} ({s.episodeCount})
        </option>
      ))}
    </select>
  );
}

function TitlePage() {
  const data = Route.useLoaderData();
  const item = data.kind === "movie" ? data.movie : data.show;
  const crumbs = crumbsFor(data);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Full-bleed backdrop */}
      <div className="relative overflow-hidden bg-black text-white">
        {item.backdrop ? (
          <img src={item.backdrop} alt="" aria-hidden decoding="async" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover object-top" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(217,39,47,.35),transparent_60%)]" aria-hidden />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/30" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" aria-hidden />
        <div className="hero-grain absolute inset-0 opacity-[.18] mix-blend-overlay" aria-hidden />

        <div className="wrap relative pb-10 pt-28 sm:pb-14">
          <div className="mb-8">
            <Breadcrumbs items={crumbs} />
          </div>
          <div className="grid items-end gap-8 md:grid-cols-[260px_1fr]">
            <div className="hero-in">
              {item.poster ? (
                <img
                  src={item.poster}
                  alt={`${item.title} poster`}
                  width={342}
                  height={513}
                  decoding="async"
                  className="mx-auto aspect-[2/3] w-[200px] rounded-2xl object-cover shadow-[0_30px_60px_-20px_rgba(0,0,0,.9)] ring-1 ring-white/15 md:w-full"
                />
              ) : (
                <div className="mx-auto grid aspect-[2/3] w-[200px] place-items-center rounded-2xl bg-muted p-4 text-center font-display text-2xl text-muted-foreground ring-1 ring-white/15 md:w-full">
                  {item.title}
                </div>
              )}
            </div>

            <div className="hero-in">
              <div className="flex flex-wrap items-center gap-2">
                <span className="kicker rounded-full bg-primary px-2.5 py-1 text-primary-foreground">{data.kind === "movie" ? "Film" : "Series"}</span>
                {item.year && <Meta>{item.year}</Meta>}
                {data.kind === "movie" && data.movie.runtime ? (
                  <Meta>
                    <Clock className="h-3 w-3" aria-hidden /> {minutes(data.movie.runtime)}
                  </Meta>
                ) : null}
                {data.kind === "tv" && (
                  <Meta>
                    {data.show.seasons.length} season{data.show.seasons.length === 1 ? "" : "s"}
                    {data.show.status ? ` · ${data.show.status}` : ""}
                  </Meta>
                )}
                {item.certification && <span className="rounded border border-white/30 px-1.5 py-0.5 font-mono text-[11px] text-white/85">{item.certification}</span>}
                {item.rating !== null && item.rating > 0 && (
                  <span className="inline-flex items-center gap-1 font-mono text-[12px] text-accent">
                    <Star className="h-3.5 w-3.5 fill-current" aria-hidden /> {item.rating.toFixed(1)}
                    <span className="text-white/50">/ 10</span>
                  </span>
                )}
              </div>

              <h1 className="mt-3 font-display text-[2.4rem] leading-[1.02] [text-shadow:0_2px_30px_rgba(0,0,0,.7)] sm:text-[3.6rem]" dir="auto">
                {item.title}
              </h1>
              {item.tagline && <p className="mt-2 text-[16px] italic text-white/70">{item.tagline}</p>}

              {item.genres.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2" aria-label="Genres">
                  {item.genres.map((g) => (
                    <li key={g.id} className="rounded-full border border-white/20 px-2.5 py-0.5 text-[12px] text-white/85">
                      {g.name}
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/85 sm:text-[17px]">{item.overview || "No synopsis available."}</p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {data.available ? (
                  data.kind === "movie" ? <PlayButton movie={data.movie} /> : <ContinueButton show={data.show} />
                ) : (
                  <span className="glass rounded-full px-4 py-2 text-[13px] text-white/80">Not available to stream yet</span>
                )}
                {item.trailer && (
                  <a
                    href={`https://www.youtube.com/watch?v=${item.trailer}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass inline-flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-semibold text-white hover:bg-white/15"
                  >
                    Trailer <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                )}
                {item.imdbId && (
                  <a
                    href={`https://www.imdb.com/title/${item.imdbId}/`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1 font-mono text-[12px] text-white/60 hover:text-white hover:underline"
                  >
                    IMDb {item.imdbId} <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </div>

              {data.available && (
                <div className="mt-5">
                  <ServerBadges servers={data.servers} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="wrap pb-16">
        {data.kind === "tv" && data.available && <Seasons show={data.show} season={data.season} />}
        <CastStrip cast={item.cast} />
      </main>
      <Footer />
    </div>
  );
}
