// VidAPI (vaplayer.ru) integration — second stream server (server only).
//
// VidAPI is embed-only: there is no documented direct-stream endpoint, so
// playback goes through their iframe player. What we do get from them:
//  - daily ID lists of every movie / show they can play, used to widen the
//    catalogue and to mark which servers a title is available on;
//  - a player that auto-searches OpenSubtitles (ds_lang) and accepts an
//    explicit subtitle file (sub_url), which we use for Arabic subtitles;
//  - postMessage PLAYER_EVENT updates for progress / completion.

import type { MediaKind } from "./tmdb.server";

const LIST_BASE = "https://vidapi.ru";
const PLAYER_BASE = "https://vaplayer.ru";
export const VIDAPI_PLAYER_ORIGIN = PLAYER_BASE;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const LIST_TIMEOUT_MS = 60_000;
const LIST_TTL_MS = 6 * 60 * 60_000; // lists are regenerated daily upstream
const LIST_STALE_MS = 48 * 60 * 60_000;
const MAX_LIST_BYTES = 12 * 1024 * 1024;

export interface VidCatalogue {
  movies: number[];
  shows: number[];
  movieSet: Set<number>;
  showSet: Set<number>;
  fetchedAt: number;
}

let catalogue: VidCatalogue | null = null;
let inflight: Promise<VidCatalogue> | null = null;

async function fetchText(url: string, timeoutMs: number): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/plain,*/*", "accept-language": "en-US,en;q=0.9" },
      signal: controller.signal,
      redirect: "follow",
    });
    const length = Number(r.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_LIST_BYTES) throw new Error("list too large");
    const text = await r.text();
    if (text.length > MAX_LIST_BYTES) throw new Error("list too large");
    return { status: r.status, text };
  } finally {
    clearTimeout(timer);
  }
}

/** Parse a one-id-per-line list; tolerates CRLF, blanks and stray `tt` ids. */
export function parseIdList(text: string): number[] {
  const out = new Set<number>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !/^\d+$/.test(line)) continue;
    const n = Number(line);
    if (Number.isSafeInteger(n) && n > 0) out.add(n);
  }
  return [...out];
}

async function loadList(kind: MediaKind): Promise<number[]> {
  const file = kind === "movie" ? "movie_list_tmdb.txt" : "tv_list_tmdb.txt";
  const { status, text } = await fetchText(`${LIST_BASE}/ids/${file}`, LIST_TIMEOUT_MS);
  if (status !== 200) throw new Error(`VidAPI list ${file}: HTTP ${status}`);
  return parseIdList(text);
}

async function refresh(): Promise<VidCatalogue> {
  const [moviesR, showsR] = await Promise.allSettled([loadList("movie"), loadList("tv")]);
  const movies = moviesR.status === "fulfilled" ? moviesR.value : [];
  const shows = showsR.status === "fulfilled" ? showsR.value : [];
  if (!movies.length && !shows.length) throw new Error("VidAPI catalogue unavailable");
  movies.sort((a, b) => b - a);
  shows.sort((a, b) => b - a);
  return { movies, shows, movieSet: new Set(movies), showSet: new Set(shows), fetchedAt: Date.now() };
}

/** Cached VidAPI id lists; stale-while-revalidate, null when never loaded. */
export async function getVidCatalogue(): Promise<VidCatalogue | null> {
  const age = catalogue ? Date.now() - catalogue.fetchedAt : Infinity;
  if (catalogue && age < LIST_TTL_MS) return catalogue;
  if (!inflight) {
    inflight = refresh()
      .then((c) => {
        catalogue = c;
        return c;
      })
      .finally(() => {
        inflight = null;
      });
  }
  if (catalogue && age < LIST_STALE_MS) return catalogue;
  try {
    return await inflight;
  } catch {
    return catalogue;
  }
}

export function vidAvailable(cat: VidCatalogue | null, kind: MediaKind, id: number): boolean {
  if (!cat) return false;
  return kind === "movie" ? cat.movieSet.has(id) : cat.showSet.has(id);
}

export interface VidEmbedOptions {
  season?: number;
  episode?: number;
  startAt?: number;
  title?: string;
  poster?: string | null;
  /** Absolute URL of a subtitle file (.srt/.vtt) to preload as the default track. */
  subUrl?: string;
  subLang?: string;
  subLabel?: string;
}

/** Build the vaplayer.ru iframe URL. Arabic subtitles are requested by default. */
export function vidEmbedUrl(kind: MediaKind, id: number, opts: VidEmbedOptions = {}): string {
  const path = kind === "movie" ? `/embed/movie/${id}` : `/embed/tv/${id}/${opts.season ?? 1}/${opts.episode ?? 1}`;
  const url = new URL(PLAYER_BASE + path);
  url.searchParams.set("primaryColor", "#d9272f");
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("ds_lang", opts.subLang ?? "ar");
  if (opts.title) url.searchParams.set("title", opts.title.slice(0, 120));
  if (opts.poster && /^https:\/\//i.test(opts.poster)) url.searchParams.set("poster", opts.poster);
  if (opts.startAt && opts.startAt > 0) url.searchParams.set("resumeAt", String(Math.floor(opts.startAt)));
  if (opts.subUrl && /^https?:\/\//i.test(opts.subUrl)) {
    url.searchParams.set("sub_url", opts.subUrl);
    url.searchParams.set("sub_lang", opts.subLang ?? "ar");
    url.searchParams.set("sub_label", opts.subLabel ?? "Arabic");
    url.searchParams.set("sub_default", "true");
  }
  return url.toString();
}
