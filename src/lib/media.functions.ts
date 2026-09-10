import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { MediaKind, MovieDetail, SeasonDetail, ShowDetail, TitleSummary } from "./tmdb.server";
import type { ServerId } from "./sources.server";
import type { SubtitleTrack } from "./subtitles.server";

// Movies & TV: TMDB supplies the metadata; two stream servers supply the
// video (Server 1 = VixSrc, direct HLS through our signed proxy; Server 2 =
// VidAPI, an embedded player). Their catalogues are merged and deduplicated.
// The browser only ever sees TMDB-derived JSON and signed proxy links.

export type { CastMember, Episode, Genre, MediaKind, MovieDetail, SeasonDetail, SeasonSummary, ShowDetail, TitleSummary } from "./tmdb.server";
export type { ServerId } from "./sources.server";
export type { SubtitleTrack } from "./subtitles.server";

const kindSchema = z.enum(["movie", "tv"]);
const idSchema = z.number().int().min(1).max(99_999_999);
const pageSchema = z.number().int().min(1).max(5_000).default(1);

export const CATALOGUE_PAGE_SIZE = 24;

export interface MediaRow {
  key: string;
  title: string;
  items: TitleSummary[];
}

export interface MediaHome {
  configured: boolean;
  filtered: boolean;
  counts: { movies: number; shows: number; servers: Record<ServerId, { movies: number; shows: number }> };
  /** A handful of big-backdrop titles for the hero. */
  featured: TitleSummary[];
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

export interface ServerOption {
  id: ServerId;
  name: string;
  /** direct = our own player over HLS; embed = third-party iframe. */
  kind: "direct" | "embed";
  /** Iframe URL for embed servers (and the direct server's own fallback). */
  embed: string;
}

export type StreamResolution = {
  /** Servers that carry this title, preferred first. */
  servers: ServerOption[];
  /** External subtitle tracks (Arabic first) for our own player. */
  subtitles: SubtitleTrack[];
  /** Signed proxy link to the HLS master on Server 1, when extractable. */
  direct:
    | { ok: true; src: string; heights: number[]; audio: string[]; subtitles: string[]; expiresAt: number }
    | { ok: false; reason: string };
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function filterAvailable(items: TitleSummary[]): Promise<{ items: TitleSummary[]; filtered: boolean }> {
  const { getMergedCatalogue, sourcesFor } = await import("./sources.server");
  const merged = await getMergedCatalogue();
  if (!merged.ready) return { items, filtered: false };
  const seen = new Set<string>();
  const out: TitleSummary[] = [];
  for (const t of items) {
    const k = `${t.kind}:${t.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (sourcesFor(merged, t.kind, t.id).length) out.push(t);
  }
  return { items: out, filtered: true };
}

/** Pull list pages until a row has enough playable titles (or we give up). */
async function playableRow(kind: MediaKind, name: "trending" | "popular" | "top_rated" | "now_playing" | "on_the_air", want = 12): Promise<TitleSummary[]> {
  const tmdb = await import("./tmdb.server");
  const out: TitleSummary[] = [];
  const seen = new Set<number>();
  for (let page = 1; page <= 2 && out.length < want; page++) {
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
  const { getMergedCatalogue } = await import("./sources.server");
  const merged = await getMergedCatalogue();
  const counts = { movies: merged.counts.movies, shows: merged.counts.shows, servers: merged.counts.perServer };

  if (!tmdb.tmdbConfigured()) {
    return { configured: false, filtered: merged.ready, counts, featured: [], rows: [], error: null };
  }

  const specs: Array<{ key: string; title: string; kind: MediaKind; name: "trending" | "popular" | "top_rated" | "now_playing" | "on_the_air" }> = [
    { key: "trending-movie", title: "Trending this week", kind: "movie", name: "trending" },
    { key: "trending-tv", title: "Series everyone is watching", kind: "tv", name: "trending" },
    { key: "now-movie", title: "Fresh from the cinema", kind: "movie", name: "now_playing" },
    { key: "popular-movie", title: "Popular movies", kind: "movie", name: "popular" },
    { key: "air-tv", title: "Airing now", kind: "tv", name: "on_the_air" },
    { key: "top-movie", title: "All-time greats", kind: "movie", name: "top_rated" },
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

  // Hero picks: trending titles that have a backdrop and a synopsis.
  const featured: TitleSummary[] = [];
  const seen = new Set<string>();
  for (const key of ["trending-movie", "trending-tv"]) {
    const row = rows.find((r) => r.key === key);
    for (const t of row?.items ?? []) {
      if (!t.backdrop || !t.overview || seen.has(`${t.kind}:${t.id}`)) continue;
      seen.add(`${t.kind}:${t.id}`);
      featured.push(t);
      if (featured.length >= 6) break;
    }
    if (featured.length >= 6) break;
  }

  return { configured: true, filtered: merged.ready, counts, featured, rows, error: rows.length ? null : error };
});

export const getCatalogue = createServerFn({ method: "GET" })
  .inputValidator(z.object({ kind: kindSchema, page: pageSchema }))
  .handler(async ({ data }): Promise<CataloguePage> => {
    const tmdb = await import("./tmdb.server");
    const { getMergedCatalogue } = await import("./sources.server");
    const merged = await getMergedCatalogue();
    if (!merged.ready) throw new Error("The catalogue is unavailable right now. Try again in a minute.");
    const ids = data.kind === "movie" ? merged.movies : merged.shows;
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
  .handler(async ({ data }): Promise<{ movie: MovieDetail; available: boolean; servers: ServerId[] }> => {
    const tmdb = await import("./tmdb.server");
    const { getMergedCatalogue, sourcesFor } = await import("./sources.server");
    const [movie, merged] = await Promise.all([tmdb.movie(data.id), getMergedCatalogue()]);
    const servers = sourcesFor(merged, "movie", data.id);
    return { movie, available: servers.length > 0, servers };
  });

export const getShow = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: idSchema, season: z.number().int().min(0).max(200).optional() }))
  .handler(async ({ data }): Promise<{ show: ShowDetail; season: SeasonDetail | null; available: boolean; servers: ServerId[] }> => {
    const tmdb = await import("./tmdb.server");
    const { getMergedCatalogue, sourcesFor } = await import("./sources.server");
    const [show, merged] = await Promise.all([tmdb.show(data.id), getMergedCatalogue()]);
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
    const servers = sourcesFor(merged, "tv", data.id);
    return { show, season, available: servers.length > 0, servers };
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
      title: z.string().trim().max(160).optional(),
      poster: z.string().url().max(400).optional(),
      startAt: z.number().min(0).max(360_000).optional(),
    }),
  )
  .handler(async ({ data }): Promise<StreamResolution> => {
    const vix = await import("./vixsrc.server");
    const vid = await import("./vidapi.server");
    const subs = await import("./subtitles.server");
    const { SITE } = await import("./site");
    const { signedProxyUrl } = await import("./stream-sign.server");
    const { getMergedCatalogue, sourcesFor, SERVER_LABELS, SERVER_ORDER } = await import("./sources.server");

    if (data.kind === "tv" && (data.season === undefined || data.episode === undefined)) {
      return { servers: [], subtitles: [], direct: { ok: false, reason: "Season and episode are required." } };
    }

    // Subtitles and catalogue lookups run alongside the slower stream extraction.
    const [merged, found, extracted] = await Promise.all([
      getMergedCatalogue(),
      subs.findSubtitles(data.kind, data.id, data.season, data.episode),
      vix.extractStream(data.kind, data.id, data.season, data.episode).then(
        (s) => ({ stream: s, error: null as string | null }),
        (e: unknown) => ({ stream: null, error: messageOf(e) }),
      ),
    ]);
    const subtitles = await subs.toTracks(found, SITE.url);
    const arabic = subtitles.find((s) => s.lang === "ar" && !s.hearingImpaired) ?? subtitles.find((s) => s.lang === "ar");

    let carriers = sourcesFor(merged, data.kind, data.id);
    // A title missing from both lists may still play (lists lag by a day), so
    // fall back to offering every server rather than a dead end.
    if (!carriers.length) carriers = [...SERVER_ORDER];
    // If Server 1 extraction succeeded, it is definitely playable there.
    if (extracted.stream && !carriers.includes("vixsrc")) carriers.unshift("vixsrc");

    const servers: ServerOption[] = carriers.map((id) => ({
      id,
      name: SERVER_LABELS[id].name,
      kind: SERVER_LABELS[id].kind,
      embed:
        id === "vixsrc"
          ? vix.embedUrl(data.kind, data.id, data.season, data.episode, data.startAt)
          : vid.vidEmbedUrl(data.kind, data.id, {
              season: data.season,
              episode: data.episode,
              startAt: data.startAt,
              title: data.title,
              poster: data.poster,
              subUrl: arabic?.absolute,
              subLang: "ar",
              subLabel: "Arabic",
            }),
    }));

    if (!extracted.stream) {
      return {
        servers,
        subtitles,
        direct: { ok: false, reason: extracted.error ?? "Server 1 has no direct stream for this title right now." },
      };
    }
    const stream = extracted.stream;
    const nowSec = Math.floor(Date.now() / 1000);
    const ttl = Math.max(600, Math.min(6 * 3600, stream.expires - nowSec));
    const src = await signedProxyUrl({ url: stream.master, referer: stream.referer, ua: stream.ua }, ttl);
    return {
      servers,
      subtitles,
      direct: { ok: true, src, heights: stream.heights, audio: stream.audio, subtitles: stream.subtitles, expiresAt: (nowSec + ttl) * 1000 },
    };
  });
