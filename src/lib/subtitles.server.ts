// Subtitle discovery (server only).
//
// Arabic first, English as a courtesy. Sources:
//  1. Wyzie Subs — a free OpenSubtitles/SubDL aggregator keyed by TMDB id; no
//     API key, returns direct .srt/.vtt links.
//  2. OpenSubtitles REST API — used only when OPENSUBTITLES_API_KEY is set and
//     Wyzie came back empty (free tier allows a handful of downloads a day).
//
// Results are handed to the browser as signed links to /api/public/subtitle,
// which fetches the file server-side and converts SRT -> WebVTT.

import type { MediaKind } from "./tmdb.server";
import { signedProxyUrl } from "./stream-sign.server";

const UA = "AuraTV/1.0 (+https://auratvdz.lovable.app)";
const TIMEOUT_MS = 9_000;
const CACHE_TTL_MS = 6 * 60 * 60_000;
const CACHE_MAX = 4_000;

export interface FoundSubtitle {
  lang: string; // ISO 639-1
  label: string;
  url: string; // upstream file
  format: "srt" | "vtt" | "unknown";
  hearingImpaired: boolean;
  source: string;
}

export interface SubtitleTrack {
  lang: string;
  label: string;
  /** Root-relative signed link to /api/public/subtitle (serves WebVTT). */
  src: string;
  /** Same link, absolute, for embed players that fetch server-side. */
  absolute: string;
  hearingImpaired: boolean;
}

const LANG_NAMES: Record<string, string> = {
  ar: "Arabic",
  en: "English",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  de: "German",
  tr: "Turkish",
  pt: "Portuguese",
};

const cache = new Map<string, { at: number; value: FoundSubtitle[] }>();

function remember(key: string, value: FoundSubtitle[]): FoundSubtitle[] {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function getJson(url: string, headers: Record<string, string> = {}, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, headers: { "user-agent": UA, accept: "application/json", ...headers }, signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

function normaliseLang(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (v === "ara" || v.startsWith("ar")) return "ar";
  if (v === "eng" || v.startsWith("en")) return "en";
  if (v.length === 2) return v;
  if (v.length === 3) return v.slice(0, 2);
  return null;
}

function formatOf(url: string, hint: unknown): FoundSubtitle["format"] {
  const h = typeof hint === "string" ? hint.toLowerCase() : "";
  if (h.includes("vtt") || /\.vtt(\?|$)/i.test(url)) return "vtt";
  if (h.includes("srt") || /\.srt(\?|$)/i.test(url)) return "srt";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Wyzie

/** Parse a Wyzie /search payload defensively; shape has drifted before. */
export function parseWyzie(data: unknown, wanted: string[]): FoundSubtitle[] {
  const rows: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results)
      ? ((data as { results: unknown[] }).results)
      : [];
  const out: FoundSubtitle[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url : typeof o.link === "string" ? o.link : null;
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const lang = normaliseLang(o.language ?? o.lang ?? o.languageCode);
    if (!lang || !wanted.includes(lang)) continue;
    out.push({
      lang,
      label: LANG_NAMES[lang] ?? (typeof o.display === "string" ? o.display : lang.toUpperCase()),
      url,
      format: formatOf(url, o.format),
      hearingImpaired: Boolean(o.isHearingImpaired ?? o.hearing_impaired),
      source: typeof o.source === "string" ? o.source : "wyzie",
    });
  }
  return out;
}

async function searchWyzie(kind: MediaKind, id: number, season: number | undefined, episode: number | undefined, wanted: string[]): Promise<FoundSubtitle[]> {
  const url = new URL("https://sub.wyzie.ru/search");
  url.searchParams.set("id", String(id));
  if (kind === "tv") {
    url.searchParams.set("season", String(season ?? 1));
    url.searchParams.set("episode", String(episode ?? 1));
  }
  url.searchParams.set("language", wanted.join(","));
  url.searchParams.set("format", "srt");
  const data = await getJson(url.toString());
  return parseWyzie(data, wanted);
}

// ---------------------------------------------------------------------------
// OpenSubtitles (optional)

async function searchOpenSubtitles(kind: MediaKind, id: number, season: number | undefined, episode: number | undefined, lang: string): Promise<FoundSubtitle[]> {
  const key = process.env.OPENSUBTITLES_API_KEY;
  if (!key) return [];
  const headers = { "Api-Key": key, "content-type": "application/json" };
  const url = new URL("https://api.opensubtitles.com/api/v1/subtitles");
  if (kind === "movie") {
    url.searchParams.set("tmdb_id", String(id));
    url.searchParams.set("type", "movie");
  } else {
    url.searchParams.set("parent_tmdb_id", String(id));
    url.searchParams.set("season_number", String(season ?? 1));
    url.searchParams.set("episode_number", String(episode ?? 1));
    url.searchParams.set("type", "episode");
  }
  url.searchParams.set("languages", lang);
  url.searchParams.set("order_by", "download_count");
  const data = (await getJson(url.toString(), headers)) as { data?: Array<{ attributes?: { hearing_impaired?: boolean; files?: Array<{ file_id?: number }> } }> };
  const best = data.data?.find((d) => d.attributes?.files?.[0]?.file_id);
  const fileId = best?.attributes?.files?.[0]?.file_id;
  if (!fileId) return [];
  const dl = (await getJson("https://api.opensubtitles.com/api/v1/download", headers, {
    method: "POST",
    body: JSON.stringify({ file_id: fileId, sub_format: "srt" }),
  })) as { link?: string };
  if (!dl.link) return [];
  return [
    {
      lang,
      label: LANG_NAMES[lang] ?? lang.toUpperCase(),
      url: dl.link,
      format: "srt",
      hearingImpaired: Boolean(best?.attributes?.hearing_impaired),
      source: "opensubtitles",
    },
  ];
}

// ---------------------------------------------------------------------------

/** One best pick per language; non-HI preferred, Arabic first. */
function pickBest(found: FoundSubtitle[], wanted: string[]): FoundSubtitle[] {
  const out: FoundSubtitle[] = [];
  for (const lang of wanted) {
    const candidates = found.filter((f) => f.lang === lang);
    if (!candidates.length) continue;
    const clean = candidates.find((c) => !c.hearingImpaired && c.format !== "unknown") ?? candidates.find((c) => !c.hearingImpaired) ?? candidates[0];
    out.push(clean);
    const hi = candidates.find((c) => c.hearingImpaired && c !== clean);
    if (hi && lang === "ar") out.push({ ...hi, label: `${hi.label} (SDH)` });
  }
  return out;
}

/**
 * Find subtitles for a title. Never throws: an empty list just means the
 * player shows no external tracks.
 */
export async function findSubtitles(kind: MediaKind, id: number, season?: number, episode?: number, wanted: string[] = ["ar", "en"]): Promise<FoundSubtitle[]> {
  const key = `${kind}:${id}:${season ?? ""}:${episode ?? ""}:${wanted.join(",")}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  let found: FoundSubtitle[] = [];
  try {
    found = await searchWyzie(kind, id, season, episode, wanted);
  } catch {
    found = [];
  }
  if (!found.some((f) => f.lang === wanted[0])) {
    try {
      found = [...found, ...(await searchOpenSubtitles(kind, id, season, episode, wanted[0]))];
    } catch {
      // optional source
    }
  }
  return remember(key, pickBest(found, wanted));
}

/** Turn upstream files into signed WebVTT links for the browser. */
export async function toTracks(found: FoundSubtitle[], origin: string, ttlSeconds = 24 * 3600): Promise<SubtitleTrack[]> {
  const out: SubtitleTrack[] = [];
  for (const f of found) {
    const src = await signedProxyUrl({ url: f.url }, ttlSeconds, "/api/public/subtitle");
    out.push({ lang: f.lang, label: f.label, src, absolute: origin.replace(/\/$/, "") + src, hearingImpaired: f.hearingImpaired });
  }
  return out;
}
