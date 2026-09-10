// Server-side TMDB client. Gives every VixSrc id a title, artwork, overview,
// cast, seasons and episodes. All calls are cached in-process so browsing
// the catalogue does not hammer the API; the key never leaves the server.

export type MediaKind = "movie" | "tv";

const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const TIMEOUT_MS = 10_000;
const MAX_CACHE_ENTRIES = 8_000;
const CONCURRENCY = 8;

export type ImageSize = "w185" | "w342" | "w500" | "w780" | "w1280" | "original";

/** Accept a few common names so a misnamed variable still works. */
function readKey(): string {
  for (const name of ["TMDB_API_KEY", "TMDB_KEY", "TMDB_TOKEN", "TMDB_API_TOKEN"]) {
    const v = process.env[name]?.trim();
    if (v) return v;
  }
  return "";
}

export function tmdbConfigured(): boolean {
  return Boolean(readKey());
}

function apiKey(): string {
  const key = readKey();
  if (!key) throw new TmdbError("TMDB_API_KEY is not configured", 503);
  return key;
}

export class TmdbError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function image(path: string | null | undefined, size: ImageSize): string | null {
  if (!path) return null;
  return `${IMG}/${size}${path}`;
}

// ---------------------------------------------------------------------------
// Cache

const cache = new Map<string, { exp: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const p = load()
    .then((value) => {
      if (cache.size >= MAX_CACHE_ENTRIES) {
        // Drop the oldest quarter; Map iterates in insertion order.
        let n = Math.floor(MAX_CACHE_ENTRIES / 4);
        for (const k of cache.keys()) {
          if (n-- <= 0) break;
          cache.delete(k);
        }
      }
      cache.set(key, { exp: Date.now() + ttlMs, value });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

type Params = Record<string, string | number | boolean | undefined>;

async function get<T>(path: string, params: Params = {}, ttlMs = 30 * 60_000): Promise<T> {
  const url = new URL(API + path);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const cacheKey = url.pathname + url.search;
  url.searchParams.set("api_key", apiKey());

  return cached(cacheKey, ttlMs, async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url.toString(), { signal: controller.signal, headers: { accept: "application/json" } });
      if (r.status === 404) throw new TmdbError("Not found", 404);
      if (r.status === 401) throw new TmdbError("TMDB rejected the API key", 401);
      if (!r.ok) throw new TmdbError(`TMDB responded ${r.status}`, 502);
      return (await r.json()) as T;
    } catch (error) {
      if (error instanceof TmdbError) throw error;
      throw new TmdbError("TMDB is unreachable", 502);
    } finally {
      clearTimeout(timer);
    }
  });
}

// ---------------------------------------------------------------------------
// Public shapes (what the browser receives)

export interface TitleSummary {
  kind: MediaKind;
  id: number;
  title: string;
  year: number | null;
  poster: string | null;
  backdrop: string | null;
  rating: number | null;
  overview: string;
}

export interface CastMember {
  name: string;
  character: string;
  photo: string | null;
}

export interface Genre {
  id: number;
  name: string;
}

export interface MovieDetail extends TitleSummary {
  kind: "movie";
  imdbId: string | null;
  tagline: string;
  runtime: number | null;
  releaseDate: string | null;
  genres: Genre[];
  cast: CastMember[];
  trailer: string | null;
  certification: string | null;
  votes: number;
}

export interface SeasonSummary {
  number: number;
  name: string;
  episodeCount: number;
  poster: string | null;
  airDate: string | null;
}

export interface ShowDetail extends TitleSummary {
  kind: "tv";
  imdbId: string | null;
  tagline: string;
  genres: Genre[];
  cast: CastMember[];
  trailer: string | null;
  certification: string | null;
  status: string;
  firstAirDate: string | null;
  lastAirDate: string | null;
  seasons: SeasonSummary[];
  episodeRuntime: number | null;
  votes: number;
}

export interface Episode {
  season: number;
  number: number;
  name: string;
  overview: string;
  still: string | null;
  runtime: number | null;
  airDate: string | null;
  rating: number | null;
}

export interface SeasonDetail {
  number: number;
  name: string;
  overview: string;
  poster: string | null;
  episodes: Episode[];
}

// ---------------------------------------------------------------------------
// Raw TMDB shapes (only the fields we read)

interface RawTitle {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  overview?: string;
  adult?: boolean;
}

interface RawList {
  page: number;
  total_pages: number;
  total_results: number;
  results: RawTitle[];
}

interface RawCredits {
  cast?: Array<{ name: string; character?: string; profile_path?: string | null }>;
}

interface RawVideos {
  results?: Array<{ key: string; site: string; type: string; official?: boolean }>;
}

interface RawMovie extends RawTitle {
  tagline?: string;
  runtime?: number | null;
  genres?: Genre[];
  external_ids?: { imdb_id?: string | null };
  credits?: RawCredits;
  videos?: RawVideos;
  release_dates?: { results?: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }> };
}

interface RawShow extends RawTitle {
  tagline?: string;
  genres?: Genre[];
  status?: string;
  last_air_date?: string;
  episode_run_time?: number[];
  seasons?: Array<{ season_number: number; name: string; episode_count: number; poster_path?: string | null; air_date?: string | null }>;
  external_ids?: { imdb_id?: string | null };
  credits?: RawCredits;
  videos?: RawVideos;
  content_ratings?: { results?: Array<{ iso_3166_1: string; rating: string }> };
}

interface RawSeason {
  season_number: number;
  name: string;
  overview?: string;
  poster_path?: string | null;
  episodes?: Array<{
    season_number: number;
    episode_number: number;
    name: string;
    overview?: string;
    still_path?: string | null;
    runtime?: number | null;
    air_date?: string | null;
    vote_average?: number;
  }>;
}

// ---------------------------------------------------------------------------
// Mappers

function yearOf(date: string | undefined | null): number | null {
  if (!date) return null;
  const y = Number(date.slice(0, 4));
  return Number.isFinite(y) && y > 1800 ? y : null;
}

function rating(v: number | undefined): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  return Math.round(v * 10) / 10;
}

function toSummary(kind: MediaKind, raw: RawTitle): TitleSummary {
  return {
    kind,
    id: raw.id,
    title: (kind === "movie" ? raw.title : raw.name) || raw.title || raw.name || `#${raw.id}`,
    year: yearOf(kind === "movie" ? raw.release_date : raw.first_air_date),
    poster: image(raw.poster_path, "w342"),
    backdrop: image(raw.backdrop_path, "w1280"),
    rating: rating(raw.vote_average),
    overview: raw.overview ?? "",
  };
}

function castOf(credits: RawCredits | undefined): CastMember[] {
  return (credits?.cast ?? []).slice(0, 12).map((c) => ({
    name: c.name,
    character: c.character ?? "",
    photo: image(c.profile_path, "w185"),
  }));
}

function trailerOf(videos: RawVideos | undefined): string | null {
  const list = videos?.results ?? [];
  const pick =
    list.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ??
    list.find((v) => v.site === "YouTube" && v.type === "Trailer") ??
    list.find((v) => v.site === "YouTube" && v.type === "Teaser");
  return pick ? pick.key : null;
}

// ---------------------------------------------------------------------------
// Queries

export async function searchMulti(query: string, page = 1): Promise<{ results: TitleSummary[]; totalPages: number }> {
  const q = query.trim();
  if (!q) return { results: [], totalPages: 0 };

  // Direct IMDb id lookup (tt1234567).
  if (/^tt\d{5,10}$/i.test(q)) {
    const found = await get<{ movie_results?: RawTitle[]; tv_results?: RawTitle[] }>(`/find/${q.toLowerCase()}`, {
      external_source: "imdb_id",
    });
    const results = [
      ...(found.movie_results ?? []).map((r) => toSummary("movie", r)),
      ...(found.tv_results ?? []).map((r) => toSummary("tv", r)),
    ];
    return { results, totalPages: 1 };
  }

  const data = await get<RawList>("/search/multi", { query: q, page, include_adult: false }, 10 * 60_000);
  const results = data.results
    .filter((r) => (r.media_type === "movie" || r.media_type === "tv") && !r.adult)
    .map((r) => toSummary(r.media_type as MediaKind, r));
  return { results, totalPages: data.total_pages };
}

export type ListName = "trending" | "popular" | "top_rated" | "now_playing" | "on_the_air";

export async function list(kind: MediaKind, name: ListName, page = 1): Promise<TitleSummary[]> {
  const path = name === "trending" ? `/trending/${kind}/week` : `/${kind}/${name}`;
  const data = await get<RawList>(path, { page }, 60 * 60_000);
  return data.results.filter((r) => !r.adult).map((r) => toSummary(kind, r));
}

export async function genres(kind: MediaKind): Promise<Genre[]> {
  const data = await get<{ genres: Genre[] }>(`/genre/${kind}/list`, {}, 24 * 60 * 60_000);
  return data.genres;
}

export async function discover(kind: MediaKind, genreId: number, page = 1): Promise<TitleSummary[]> {
  const data = await get<RawList>(
    `/discover/${kind}`,
    { with_genres: genreId, sort_by: "popularity.desc", include_adult: false, page, "vote_count.gte": 50 },
    60 * 60_000,
  );
  return data.results.map((r) => toSummary(kind, r));
}

export async function movie(id: number): Promise<MovieDetail> {
  const raw = await get<RawMovie>(`/movie/${id}`, { append_to_response: "external_ids,credits,videos,release_dates" }, 6 * 60 * 60_000);
  const us = raw.release_dates?.results?.find((r) => r.iso_3166_1 === "US");
  const cert = us?.release_dates.find((d) => d.certification)?.certification ?? null;
  return {
    ...toSummary("movie", raw),
    kind: "movie",
    imdbId: raw.external_ids?.imdb_id || null,
    tagline: raw.tagline ?? "",
    runtime: raw.runtime ?? null,
    releaseDate: raw.release_date || null,
    genres: raw.genres ?? [],
    cast: castOf(raw.credits),
    trailer: trailerOf(raw.videos),
    certification: cert,
    votes: raw.vote_count ?? 0,
  };
}

export async function show(id: number): Promise<ShowDetail> {
  const raw = await get<RawShow>(`/tv/${id}`, { append_to_response: "external_ids,credits,videos,content_ratings" }, 6 * 60 * 60_000);
  const cert = raw.content_ratings?.results?.find((r) => r.iso_3166_1 === "US")?.rating ?? null;
  return {
    ...toSummary("tv", raw),
    kind: "tv",
    imdbId: raw.external_ids?.imdb_id || null,
    tagline: raw.tagline ?? "",
    genres: raw.genres ?? [],
    cast: castOf(raw.credits),
    trailer: trailerOf(raw.videos),
    certification: cert,
    status: raw.status ?? "",
    firstAirDate: raw.first_air_date || null,
    lastAirDate: raw.last_air_date || null,
    episodeRuntime: raw.episode_run_time?.[0] ?? null,
    votes: raw.vote_count ?? 0,
    seasons: (raw.seasons ?? [])
      .filter((s) => s.season_number > 0 && s.episode_count > 0)
      .map((s) => ({
        number: s.season_number,
        name: s.name,
        episodeCount: s.episode_count,
        poster: image(s.poster_path, "w342"),
        airDate: s.air_date ?? null,
      })),
  };
}

export async function season(id: number, number: number): Promise<SeasonDetail> {
  const raw = await get<RawSeason>(`/tv/${id}/season/${number}`, {}, 6 * 60 * 60_000);
  return {
    number: raw.season_number,
    name: raw.name,
    overview: raw.overview ?? "",
    poster: image(raw.poster_path, "w342"),
    episodes: (raw.episodes ?? []).map((e) => ({
      season: e.season_number,
      number: e.episode_number,
      name: e.name,
      overview: e.overview ?? "",
      still: image(e.still_path, "w500"),
      runtime: e.runtime ?? null,
      airDate: e.air_date ?? null,
      rating: rating(e.vote_average),
    })),
  };
}

/** Lightweight summary for a bare id; used to paint catalogue grids. */
export async function summary(kind: MediaKind, id: number): Promise<TitleSummary | null> {
  try {
    const raw = await get<RawTitle>(`/${kind}/${id}`, {}, 6 * 60 * 60_000);
    if (raw.adult) return null;
    return toSummary(kind, raw);
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) return null;
    throw error;
  }
}

/** Resolve many ids with bounded concurrency; ids TMDB no longer knows are skipped. */
export async function summaries(kind: MediaKind, ids: number[]): Promise<TitleSummary[]> {
  const out: Array<TitleSummary | null> = new Array(ids.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const i = next++;
      try {
        out[i] = await summary(kind, ids[i]);
      } catch {
        out[i] = null;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));
  return out.filter((s): s is TitleSummary => s !== null);
}
