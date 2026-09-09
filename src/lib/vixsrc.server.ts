// VixSrc integration (server only).
//
// Two things live here:
//  1. The catalogue: /api/list/{movie,tv} lists every TMDB id VixSrc can
//     play. Cached for an hour and used to filter search/browse so the user
//     never lands on a dead Play button.
//  2. Stream extraction: /api/{movie,tv}/{id}[...] -> embed page -> tokenised
//     HLS master. We only ever hand the browser a signed proxy link, so the
//     upstream URL, token and headers stay on the server.

import type { MediaKind } from "./tmdb.server";

const BASE = "https://vixsrc.to";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TIMEOUT_MS = 12_000;
const LIST_TIMEOUT_MS = 60_000;
const LIST_TTL_MS = 60 * 60_000;
const LIST_STALE_MS = 24 * 60 * 60_000;
const MAX_HTML_BYTES = 3 * 1024 * 1024;

const HEADERS: Record<string, string> = {
  "user-agent": UA,
  accept: "application/json, text/javascript, */*; q=0.01",
  "accept-language": "en-US,en;q=0.9",
  referer: `${BASE}/`,
  origin: BASE,
};

async function fetchText(url: string, headers: Record<string, string>, timeoutMs = TIMEOUT_MS): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers, signal: controller.signal, redirect: "follow" });
    const length = Number(r.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_HTML_BYTES * 8) throw new Error("response too large");
    const text = await r.text();
    return { status: r.status, text };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Catalogue

export interface Catalogue {
  movies: number[];
  shows: number[];
  movieSet: Set<number>;
  showSet: Set<number>;
  fetchedAt: number;
}

let catalogue: Catalogue | null = null;
let catalogueInflight: Promise<Catalogue> | null = null;

export function parseIds(text: string): number[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const rows: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)
      ? ((data as { data: unknown[] }).data)
      : [];
  const out = new Set<number>();
  for (const row of rows) {
    let id: unknown = row;
    if (row && typeof row === "object") {
      const o = row as Record<string, unknown>;
      id = o.tmdb_id ?? o.tmdbId ?? o.id;
    }
    const n = typeof id === "string" ? Number(id) : id;
    if (typeof n === "number" && Number.isInteger(n) && n > 0) out.add(n);
  }
  return [...out];
}

async function loadList(kind: MediaKind): Promise<number[]> {
  // The documented form carries ?lang=it; try the bare list first in case it
  // is the superset, then fall back to the documented one.
  const candidates = [`${BASE}/api/list/${kind}`, `${BASE}/api/list/${kind}?lang=it`, `${BASE}/api/list/${kind}/?lang=it`];
  let best: number[] = [];
  for (const url of candidates) {
    try {
      const { status, text } = await fetchText(url, HEADERS, LIST_TIMEOUT_MS);
      if (status !== 200) continue;
      const ids = parseIds(text);
      if (ids.length > best.length) best = ids;
      if (best.length > 1000) break;
    } catch {
      // try the next form
    }
  }
  return best;
}

async function refreshCatalogue(): Promise<Catalogue> {
  const [movies, shows] = await Promise.all([loadList("movie"), loadList("tv")]);
  if (!movies.length && !shows.length) throw new Error("VixSrc catalogue unavailable");
  // Newest TMDB ids first: a fair proxy for "recently released".
  movies.sort((a, b) => b - a);
  shows.sort((a, b) => b - a);
  return { movies, shows, movieSet: new Set(movies), showSet: new Set(shows), fetchedAt: Date.now() };
}

/**
 * Returns the cached catalogue, refreshing it in the background once it is an
 * hour old. If VixSrc is down and we have nothing yet, resolves to null so
 * callers can degrade to "unfiltered" rather than fail.
 */
export async function getCatalogue(): Promise<Catalogue | null> {
  const age = catalogue ? Date.now() - catalogue.fetchedAt : Infinity;
  if (catalogue && age < LIST_TTL_MS) return catalogue;

  if (!catalogueInflight) {
    catalogueInflight = refreshCatalogue()
      .then((c) => {
        catalogue = c;
        return c;
      })
      .finally(() => {
        catalogueInflight = null;
      });
  }

  // Stale-while-revalidate: serve the old list while a fresh one loads.
  if (catalogue && age < LIST_STALE_MS) return catalogue;
  try {
    return await catalogueInflight;
  } catch {
    return catalogue;
  }
}

export function isAvailable(cat: Catalogue | null, kind: MediaKind, id: number): boolean {
  if (!cat) return true;
  return kind === "movie" ? cat.movieSet.has(id) : cat.showSet.has(id);
}

// ---------------------------------------------------------------------------
// Embed URL (iframe fallback)

export function embedUrl(kind: MediaKind, id: number, season?: number, episode?: number, startAt?: number): string {
  const path = kind === "movie" ? `/movie/${id}` : `/tv/${id}/${season ?? 1}/${episode ?? 1}`;
  const url = new URL(BASE + path);
  url.searchParams.set("primaryColor", "d9272f");
  url.searchParams.set("secondaryColor", "170000");
  url.searchParams.set("autoplay", "true");
  url.searchParams.set("lang", "en");
  if (startAt && startAt > 0) url.searchParams.set("startAt", String(Math.floor(startAt)));
  return url.toString();
}

export function pageUrl(kind: MediaKind, id: number, season?: number, episode?: number): string {
  return kind === "movie" ? `${BASE}/movie/${id}` : `${BASE}/tv/${id}/${season ?? 1}/${episode ?? 1}`;
}

// ---------------------------------------------------------------------------
// Stream extraction

export interface VixStream {
  /** Tokenised HLS master. Must be fetched with `referer` + our UA. */
  master: string;
  referer: string;
  ua: string;
  /** Unix seconds when the token stops working. */
  expires: number;
  heights: number[];
  audio: string[];
  subtitles: string[];
}

function pick(re: RegExp, html: string): string | null {
  const m = html.match(re);
  return m ? m[1] : null;
}

export function extractToken(html: string): { token: string; expires: number; url: string; fhd: boolean } | null {
  // Narrow to the masterPlaylist assignment when present so a stray `url:`
  // elsewhere in the document cannot be picked up by mistake.
  const start = html.indexOf("masterPlaylist");
  const scope = start >= 0 ? html.slice(start, start + 4000) : html;
  const token = pick(/['"]?token['"]?\s*:\s*['"](\w+)['"]/, scope);
  const expiresRaw = pick(/['"]?expires['"]?\s*:\s*['"]?(\d+)['"]?/, scope);
  const rawUrl = pick(/(?:['"]url['"]|\burl)\s*:\s*['"]([^'"]+)['"]/, scope);
  if (!token || !expiresRaw || !rawUrl) return null;
  const url = rawUrl.replace(/\\\//g, "/");
  if (!/^https?:\/\//i.test(url)) return null;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires)) return null;
  const fhd = /canPlayFHD\s*=\s*true/.test(html) || !/canPlayFHD/.test(html);
  return { token, expires, url, fhd };
}

export function parseMaster(text: string): { heights: number[]; audio: string[]; subtitles: string[] } {
  const heights = new Set<number>();
  const audio = new Set<string>();
  const subtitles = new Set<string>();
  for (const line of text.split("\n")) {
    if (line.startsWith("#EXT-X-STREAM-INF")) {
      const m = line.match(/RESOLUTION=\d+x(\d+)/);
      if (m) heights.add(Number(m[1]));
    } else if (line.startsWith("#EXT-X-MEDIA:TYPE=AUDIO")) {
      audio.add(line.match(/NAME="([^"]+)"/)?.[1] ?? line.match(/LANGUAGE="([^"]+)"/)?.[1] ?? "Audio");
    } else if (line.startsWith("#EXT-X-MEDIA:TYPE=SUBTITLES")) {
      subtitles.add(line.match(/NAME="([^"]+)"/)?.[1] ?? line.match(/LANGUAGE="([^"]+)"/)?.[1] ?? "Subtitles");
    }
  }
  return { heights: [...heights].sort((a, b) => b - a), audio: [...audio], subtitles: [...subtitles] };
}

async function embedHtml(kind: MediaKind, id: number, season?: number, episode?: number): Promise<{ html: string; page: string } | null> {
  const page = pageUrl(kind, id, season, episode);
  const api = kind === "movie" ? `${BASE}/api/movie/${id}` : `${BASE}/api/tv/${id}/${season ?? 1}/${episode ?? 1}`;

  // Preferred path: the JSON API points at the embed document.
  try {
    const { status, text } = await fetchText(api, HEADERS);
    if (status === 200) {
      let src: string | undefined;
      try {
        src = (JSON.parse(text) as { src?: string }).src;
      } catch {
        src = undefined;
      }
      if (src) {
        const target = new URL(src, BASE).toString();
        const embed = await fetchText(target, { ...HEADERS, accept: "text/html,*/*", referer: page });
        if (embed.status === 200 && embed.text.length <= MAX_HTML_BYTES) return { html: embed.text, page };
      }
    }
  } catch {
    // fall through to the legacy path
  }

  // Legacy path: the public page itself, following nested iframes.
  let url = page;
  let headers: Record<string, string> = { ...HEADERS, accept: "text/html,*/*" };
  for (let hop = 0; hop < 3; hop++) {
    const { status, text } = await fetchText(url, headers);
    if (status !== 200) return null;
    if (/['"]?token['"]?\s*:\s*['"]\w+['"]/.test(text)) return { html: text, page };
    const iframe = pick(/<iframe[^>]+src=["']([^"']+)["']/i, text);
    if (!iframe) return null;
    const version = pick(/data-page=["'].*?"version"\s*:\s*"([^"]+)"/, text);
    headers = { ...headers, referer: url };
    if (version) headers = { ...headers, "x-inertia": "true", "x-inertia-version": version };
    url = new URL(iframe, url).toString();
  }
  return null;
}

/**
 * Resolve a playable HLS master for a movie or an episode. Returns null when
 * VixSrc has nothing for it (caller should fall back to the iframe embed).
 */
export async function extractStream(kind: MediaKind, id: number, season?: number, episode?: number): Promise<VixStream | null> {
  const doc = await embedHtml(kind, id, season, episode);
  if (!doc) return null;
  const token = extractToken(doc.html);
  if (!token) return null;
  if (token.expires * 1000 - 60_000 < Date.now()) return null;

  const master = new URL(token.url);
  master.searchParams.set("token", token.token);
  master.searchParams.set("expires", String(token.expires));
  if (token.fhd) master.searchParams.set("h", "1");

  // Verify it actually plays and learn what is inside for the UI. Some
  // deployments want an explicit .m3u8 suffix on /playlist/<id>.
  const checkHeaders = { "user-agent": UA, accept: "*/*", referer: doc.page, origin: BASE };
  let check = await fetchText(master.toString(), checkHeaders);
  if ((check.status !== 200 || !check.text.trimStart().startsWith("#EXTM3U")) && /\/playlist\/\d+$/.test(master.pathname)) {
    master.pathname = `${master.pathname}.m3u8`;
    check = await fetchText(master.toString(), checkHeaders);
  }
  if (check.status !== 200 || !check.text.trimStart().startsWith("#EXTM3U")) return null;
  const parsed = parseMaster(check.text);

  return {
    master: master.toString(),
    referer: doc.page,
    ua: UA,
    expires: token.expires,
    ...parsed,
  };
}
