// Merged availability across stream servers (server only).
//
// Each server publishes the TMDB ids it can play. We union them, dedupe, and
// remember which servers carry each title so the UI can offer a server
// switch and never show a Play button that leads nowhere.

import type { MediaKind } from "./tmdb.server";
import { getCatalogue as getVixCatalogue, type Catalogue as VixCatalogue } from "./vixsrc.server";
import { getVidCatalogue, type VidCatalogue } from "./vidapi.server";

export type ServerId = "vixsrc" | "vidapi";

export const SERVER_ORDER: ServerId[] = ["vixsrc", "vidapi"];

export const SERVER_LABELS: Record<ServerId, { name: string; short: string; kind: "direct" | "embed" }> = {
  vixsrc: { name: "Server 1 · Vix", short: "S1", kind: "direct" },
  vidapi: { name: "Server 2 · Vid", short: "S2", kind: "embed" },
};

export interface Merged {
  /** Every playable movie id, newest TMDB id first. */
  movies: number[];
  shows: number[];
  movieSources: Map<number, ServerId[]>;
  showSources: Map<number, ServerId[]>;
  counts: {
    movies: number;
    shows: number;
    perServer: Record<ServerId, { movies: number; shows: number }>;
  };
  /** True when at least one server list loaded. */
  ready: boolean;
}

let cached: { value: Merged; at: number } | null = null;
/** Serve a stale merge for this long while refreshing in the background. */
const CACHE_TTL_MS = 30 * 60_000;

/** Hard cap so a slow upstream can never stall page rendering. */
const LOAD_BUDGET_MS = 9_000;
/** After a failed/slow load, do not block requests again for this long. The
 *  upstream fetch keeps running in the background and fills the cache. */
const RETRY_AFTER_MS = 5 * 60_000;
let failedAt = 0;

const EMPTY: Merged = {
  movies: [],
  shows: [],
  movieSources: new Map(),
  showSources: new Map(),
  counts: { movies: 0, shows: 0, perServer: { vixsrc: { movies: 0, shows: 0 }, vidapi: { movies: 0, shows: 0 } } },
  ready: false,
};

function merge(vix: VixCatalogue | null, vid: VidCatalogue | null): Merged {
  const movieSources = new Map<number, ServerId[]>();
  const showSources = new Map<number, ServerId[]>();
  const add = (map: Map<number, ServerId[]>, ids: number[] | undefined, server: ServerId) => {
    if (!ids) return;
    for (const id of ids) {
      const list = map.get(id);
      if (list) {
        if (!list.includes(server)) list.push(server);
      } else {
        map.set(id, [server]);
      }
    }
  };
  add(movieSources, vix?.movies, "vixsrc");
  add(showSources, vix?.shows, "vixsrc");
  add(movieSources, vid?.movies, "vidapi");
  add(showSources, vid?.shows, "vidapi");

  const movies = [...movieSources.keys()].sort((a, b) => b - a);
  const shows = [...showSources.keys()].sort((a, b) => b - a);
  return {
    movies,
    shows,
    movieSources,
    showSources,
    counts: {
      movies: movies.length,
      shows: shows.length,
      perServer: {
        vixsrc: { movies: vix?.movies.length ?? 0, shows: vix?.shows.length ?? 0 },
        vidapi: { movies: vid?.movies.length ?? 0, shows: vid?.shows.length ?? 0 },
      },
    },
    ready: Boolean(vix || vid),
  };
}

function refreshInBackground(): void {
  void Promise.all([getVixCatalogue().catch(() => null), getVidCatalogue().catch(() => null)]).then(([vix, vid]) => {
    if (!vix && !vid) return;
    cached = { value: merge(vix, vid), at: Date.now() };
    failedAt = 0;
  });
}

/**
 * Union of all server catalogues. Never blocks longer than LOAD_BUDGET_MS:
 * if the upstream lists are slow the page renders unfiltered and the
 * background fetch fills the cache for the next request.
 */
export async function getMergedCatalogue(): Promise<Merged> {
  if (cached) {
    if (Date.now() - cached.at > CACHE_TTL_MS) refreshInBackground();
    return cached.value;
  }
  if (failedAt && Date.now() - failedAt < RETRY_AFTER_MS) return EMPTY;

  const load = Promise.all([getVixCatalogue().catch(() => null), getVidCatalogue().catch(() => null)]);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), LOAD_BUDGET_MS));
  const result = await Promise.race([load, timeout]);
  if (result === null || (!result[0] && !result[1])) {
    failedAt = Date.now();
    void load.then(([vix, vid]) => {
      if (!vix && !vid) return;
      cached = { value: merge(vix, vid), at: Date.now() };
      failedAt = 0;
    });
    return EMPTY;
  }
  const [vix, vid] = result;
  const value = merge(vix, vid);
  cached = { value, at: Date.now() };
  return value;
}

/**
 * Servers that carry a title. When no list has loaded yet we cannot know, so
 * every server is offered and the player sorts it out at play time.
 */
export function sourcesFor(m: Merged, kind: MediaKind, id: number): ServerId[] {
  if (!m.ready) return [...SERVER_ORDER];
  const list = (kind === "movie" ? m.movieSources : m.showSources).get(id);
  return list ? SERVER_ORDER.filter((s) => list.includes(s)) : [];
}
