import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BASE = "https://vixsrc.to";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const inputSchema = z.object({
  kind: z.enum(["movie", "tv"]),
  id: z.number().int().min(1).max(99_999_999),
  season: z.number().int().min(0).max(200).optional(),
  episode: z.number().int().min(1).max(2_000).optional(),
});

type DirectResult =
  | { ok: true; src: string; heights: number[]; audio: string[]; subtitles: string[]; expiresAt: number }
  | { ok: false; reason: string };

function cookiesFrom(response: Response): string | undefined {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  const raw = values.length ? values : response.headers.get("set-cookie")?.split(/,(?=\s*[^;,=]+=[^;,]+)/) ?? [];
  const cookies = raw.map((part) => part.trim().split(";", 1)[0]).filter(Boolean);
  return cookies.length ? cookies.join("; ") : undefined;
}

function pick(re: RegExp, value: string): string | null {
  return value.match(re)?.[1] ?? null;
}

function parseToken(html: string): { token: string; expires: number; url: string; fhd: boolean } | null {
  const start = html.indexOf("masterPlaylist");
  const scope = start >= 0 ? html.slice(start, start + 12_000) : html;
  const token = pick(/["']?token["']?\s*:\s*["']([A-Za-z0-9_-]+)["']/, scope);
  const expiresRaw = pick(/["']?expires["']?\s*:\s*["']?(\d+)["']?/, scope);
  const rawUrl = pick(/(?:["']url["']|\burl)\s*:\s*["']([^"']+)["']/, scope);
  if (!token || !expiresRaw || !rawUrl) return null;
  const url = rawUrl.replace(/\\\//g, "/").replace(/&amp;/g, "&");
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || !/^https?:\/\//i.test(url)) return null;
  return { token, expires, url, fhd: /canPlayFHD\s*=\s*true/.test(html) || !/canPlayFHD/.test(html) };
}

function parseMaster(text: string): { heights: number[]; audio: string[]; subtitles: string[] } {
  const heights = new Set<number>();
  const audio = new Set<string>();
  const subtitles = new Set<string>();
  for (const line of text.split("\n")) {
    if (line.startsWith("#EXT-X-STREAM-INF")) {
      const height = Number(line.match(/RESOLUTION=\d+x(\d+)/)?.[1]);
      if (height > 0) heights.add(height);
    } else if (line.startsWith("#EXT-X-MEDIA:TYPE=AUDIO")) {
      audio.add(line.match(/NAME="([^"]+)"/)?.[1] ?? line.match(/LANGUAGE="([^"]+)"/)?.[1] ?? "Audio");
    } else if (line.startsWith("#EXT-X-MEDIA:TYPE=SUBTITLES")) {
      subtitles.add(line.match(/NAME="([^"]+)"/)?.[1] ?? line.match(/LANGUAGE="([^"]+)"/)?.[1] ?? "Subtitles");
    }
  }
  return { heights: [...heights].sort((a, b) => b - a), audio: [...audio], subtitles: [...subtitles] };
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow", cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve Vix to AuraTV's native HLS player. Vix's JSON API establishes an
 * anonymous session used by its tokenized embed; discarding Set-Cookie made
 * the embed return 410/blocked. Keep that session for extraction, then proxy
 * the signed HLS master with the exact embed referer and browser identity.
 */
export const resolveFreshVixDirect = createServerFn({ method: "GET" })
  .inputValidator(inputSchema)
  .handler(async ({ data }): Promise<DirectResult> => {
    if (data.kind === "tv" && (data.season === undefined || data.episode === undefined)) {
      return { ok: false, reason: "Season and episode are required." };
    }
    const apiPath = data.kind === "movie" ? `/api/movie/${data.id}` : `/api/tv/${data.id}/${data.season}/${data.episode}`;
    const publicPage = data.kind === "movie" ? `${BASE}/movie/${data.id}` : `${BASE}/tv/${data.id}/${data.season}/${data.episode}`;
    const common: Record<string, string> = {
      "user-agent": UA,
      "accept-language": "en-US,en;q=0.9",
      origin: BASE,
      referer: `${BASE}/`,
    };

    try {
      const api = await timedFetch(BASE + apiPath, { headers: { ...common, accept: "application/json, */*" } });
      if (!api.ok) return { ok: false, reason: `Vix API returned ${api.status}.` };
      const session = cookiesFrom(api);
      const payload = (await api.json()) as { src?: unknown };
      if (typeof payload.src !== "string" || !payload.src) return { ok: false, reason: "Vix has no player for this title." };
      const embedUrl = new URL(payload.src, BASE);
      if (embedUrl.protocol !== "https:" || embedUrl.hostname !== "vixsrc.to" || !embedUrl.pathname.startsWith("/embed/")) {
        return { ok: false, reason: "Vix returned an invalid player." };
      }

      const embedHeaders: Record<string, string> = { ...common, accept: "text/html,*/*", referer: publicPage };
      if (session) embedHeaders.cookie = session;
      const embed = await timedFetch(embedUrl.toString(), { headers: embedHeaders });
      if (!embed.ok) return { ok: false, reason: `Vix player returned ${embed.status}.` };
      const found = parseToken(await embed.text());
      if (!found) return { ok: false, reason: "Vix changed its player format." };
      if (found.expires * 1000 <= Date.now() + 30_000) return { ok: false, reason: "Vix returned an expired stream." };

      const master = new URL(found.url);
      master.searchParams.set("token", found.token);
      master.searchParams.set("expires", String(found.expires));
      if (found.fhd) master.searchParams.set("h", "1");
      const mediaHeaders: Record<string, string> = {
        "user-agent": UA,
        accept: "*/*",
        referer: embedUrl.toString(),
        origin: BASE,
      };
      if (session) mediaHeaders.cookie = session;
      let check = await timedFetch(master.toString(), { headers: mediaHeaders });
      let body = await check.text();
      if ((!check.ok || !body.trimStart().startsWith("#EXTM3U")) && /\/playlist\/\d+$/.test(master.pathname)) {
        master.pathname += ".m3u8";
        check = await timedFetch(master.toString(), { headers: mediaHeaders });
        body = await check.text();
      }
      if (!check.ok || !body.trimStart().startsWith("#EXTM3U")) {
        return { ok: false, reason: `Vix stream returned ${check.status}.` };
      }

      const { signedProxyUrl } = await import("./stream-sign.server");
      const now = Math.floor(Date.now() / 1000);
      const ttl = Math.max(60, Math.min(6 * 3600, found.expires - now - 20));
      const src = await signedProxyUrl({ url: master.toString(), referer: embedUrl.toString(), ua: UA }, ttl);
      return { ok: true, src, expiresAt: (now + ttl) * 1000, ...parseMaster(body) };
    } catch (error) {
      const reason = error instanceof Error && error.name === "AbortError" ? "Vix timed out." : "Vix is unavailable.";
      return { ok: false, reason };
    }
  });
