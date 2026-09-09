import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { MediaKind, MovieDetail, SeasonDetail, ShowDetail, TitleSummary } from "./tmdb.server";

// Movies & TV: TMDB supplies the metadata, VixSrc supplies the streams. The
// browser only ever sees TMDB-derived JSON and signed proxy links.

export type { CastMember, Episode, Genre, MediaKind, MovieDetail, SeasonDetail, SeasonSummary, ShowDetail, TitleSummary } from "./tmdb.server";

const kindSchema = z.enum(["movie", "tv"]);
const idSchema = z.number().int().min(1).max(99_999_999);
const pageSchema = z.number().int().min(1).max(2_000).default(1);

export const CATALOGUE_PAGE_SIZE = 24;

export interface MediaRow {
  key: string;
  title: string;
  items: TitleSummary[];
}

export interface MediaHome {
  configured: boolean;
  filtered: boolean;
  counts: { movies: number; shows: number };
  rows: MediaRow[];
  error: string | null;
}

export interface CataloguePage {
  kind: MediaKind;
  page: number;
  totalPages: number;
  total: number;
  items: TitleSummary[];
}

export interface SearchResult {
  configured: boolean;
  filtered: boolean;
  query: string;
  results: TitleSummary[];
}

export type StreamResolution =
  | {
      ok: true;
      /** Signed proxy link to the HLS master. */
      src: string;
      heights: number[];
      audio: string[];
      subtitles: string[];
      expiresAt: number;
      embed: string;
    }
  | { ok: false; reason: string; embed: string };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function filterAvailable(items: TitleSummary[]): Promise<{ items: TitleSummary[]; filtered: boolean }> {
  const { getCatalogue, isAvailable } = await import("./vixsrc.server");
  const cat = await getCatalogue();
  if (!cat) return { items, filtered: false };
  return { items: items.filter((t) => isAvailable(cat, t.kind, t.id)), filtered: true };
}

/** Pull list pages until a row has enough playable titles (or we give up). */
async function playableRow(kind: MediaKind, name: "trending" | "popular" | "top_rated", want = 18): Promise<TitleSummary[]> {
  const tmdb = await import("./tmdb.server");
  const out: TitleSummary[] = [];
  const seen = new Set<number>();
  for (let page = 1; page <= 3 && out.length < want; page++) {
    const batch = await tmdb.list(kind, name, page);
    const { items } = await filterAvailable(batch);
    for (const t of items) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
      if (out.length >= want) break;
    }
    if (batch.length < 20) break;
  }
  return out;
}

export const getMediaHome = createServerFn({ method: "GET" }).handler(async (): Promise<MediaHome> => {
  const tmdb = await import("./tmdb.server");
  const { getCatalogue } = await import("./vixsrc.server");
  const cat = await getCatalogue();
  const counts = { movies: cat?.movies.length ?? 0, shows: cat?.shows.length ?? 0 };

  if (!tmdb.tmdbConfigured()) {
    return { configured: false, filtered: Boolean(cat), counts, rows: [], error: null };
  }

  const specs: Array<{ key: string; title: string; kind: MediaKind; name: "trending" | "popular" | "top_rated" }> = [
    { key: "trending-movie", title: "Trending movies", kind: "movie", name: "trending" },
    { key: "trending-tv", title: "Trending series", kind: "tv", name: "trending" },
    { key: "popular-movie", title: "Popular movies", kind: "movie", name: "popular" },
    { key: "popular-tv", title: "Popular series", kind: "tv", name: "popular" },
    { key: "top-movie", title: "Top rated movies", kind: "movie", name: "top_rated" },
    { key: "top-tv", title: "Top rated series", kind: "tv", name: "top_rated" },
  ];

  const settled = await Promise.allSettled(specs.map((s) => playableRow(s.kind, s.name)));
  const rows: MediaRow[] = [];
  let error: string | null = null;
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      if (r.value.length) rows.push({ key: specs[i].key, title: specs[i].title, items: r.value });
    } else if (!error) {
      error = messageOf(r.reason);
    }
  });
  return { configured: true, filtered: Boolean(cat), counts, rows, error: rows.length ? null : error };
});

export const getCatalogue = createServerFn({ method: "GET" })
  .inputValidator(z.object({ kind: kindSchema, page: pageSchema }))
  .handler(async ({ data }): Promise<CataloguePage> => {
    const tmdb = await import("./tmdb.server");
    const vix = await import("./vixsrc.server");
    const cat = await vix.getCatalogue();
    if (!cat) throw new Error("The catalogue is unavailable right now. Try again in a minute.");
    const ids = data.kind === "movie" ? cat.movies : cat.shows;
    const totalPages = Math.max(1, Math.ceil(ids.length / CATALOGUE_PAGE_SIZE));
    const page = Math.min(data.page, totalPages);
    const slice = ids.slice((page - 1) * CATALOGUE_PAGE_SIZE, page * CATALOGUE_PAGE_SIZE);
    const items = tmdb.tmdbConfigured() ? await tmdb.summaries(data.kind, slice) : [];
    return { kind: data.kind, page, totalPages, total: ids.length, items };
  });

export const searchMedia = createServerFn({ method: "GET" })
  .inputValidator(z.object({ q: z.string().trim().min(1).max(120), page: pageSchema }))
  .handler(async ({ data }): Promise<SearchResult> => {
    const tmdb = await import("./tmdb.server");
    if (!tmdb.tmdbConfigured()) return { configured: false, filtered: false, query: data.q, results: [] };
    // Two pages of TMDB results so that filtering to playable titles still
    // leaves a full screen.
    const first = await tmdb.searchMulti(data.q, data.page);
    const more = first.totalPages > data.page ? await tmdb.searchMulti(data.q, data.page + 1) : { results: [] };
    const { items, filtered } = await filterAvailable([...first.results, ...more.results]);
    return { configured: true, filtered, query: data.q, results: items.slice(0, 40) };
  });

export const getMovie = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: idSchema }))
  .handler(async ({ data }): Promise<{ movie: MovieDetail; available: boolean }> => {
    const tmdb = await import("./tmdb.server");
    const vix = await import("./vixsrc.server");
    const [movie, cat] = await Promise.all([tmdb.movie(data.id), vix.getCatalogue()]);
    return { movie, available: vix.isAvailable(cat, "movie", data.id) };
  });

export const getShow = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: idSchema, season: z.number().int().min(0).max(200).optional() }))
  .handler(async ({ data }): Promise<{ show: ShowDetail; season: SeasonDetail | null; available: boolean }> => {
    const tmdb = await import("./tmdb.server");
    const vix = await import("./vixsrc.server");
    const [show, cat] = await Promise.all([tmdb.show(data.id), vix.getCatalogue()]);
    const wanted = data.season ?? show.seasons[0]?.number;
    const exists = wanted !== undefined && show.seasons.some((s) => s.number === wanted);
    let season: SeasonDetail | null = null;
    if (exists) {
      try {
        season = await tmdb.season(data.id, wanted);
      } catch {
        season = null;
      }
    }
    return { show, season, available: vix.isAvailable(cat, "tv", data.id) };
  });

export const getSeason = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: idSchema, season: z.number().int().min(0).max(200) }))
  .handler(async ({ data }): Promise<SeasonDetail> => {
    const tmdb = await import("./tmdb.server");
    return tmdb.season(data.id, data.season);
  });

export const resolveStream = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      kind: kindSchema,
      id: idSchema,
      season: z.number().int().min(0).max(200).optional(),
      episode: z.number().int().min(1).max(2_000).optional(),
    }),
  )
  .handler(async ({ data }): Promise<StreamResolution> => {
    const vix = await import("./vixsrc.server");
    const { signedProxyUrl } = await import("./stream-sign.server");
    const embed = vix.embedUrl(data.kind, data.id, data.season, data.episode);
    if (data.kind === "tv" && (data.season === undefined || data.episode === undefined)) {
      return { ok: false, reason: "Season and episode are required.", embed };
    }
    try {
      const stream = await vix.extractStream(data.kind, data.id, data.season, data.episode);
      if (!stream) return { ok: false, reason: "This title is not available from the stream source right now.", embed };
      const nowSec = Math.floor(Date.now() / 1000);
      const ttl = Math.max(600, Math.min(6 * 3600, stream.expires - nowSec));
      const src = await signedProxyUrl({ url: stream.master, referer: stream.referer, ua: stream.ua }, ttl);
      return {
        ok: true,
        src,
        heights: stream.heights,
        audio: stream.audio,
        subtitles: stream.subtitles,
        expiresAt: (nowSec + ttl) * 1000,
        embed,
      };
    } catch (error) {
      return { ok: false, reason: messageOf(error), embed };
    }
  });
