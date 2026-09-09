import { createFileRoute } from "@tanstack/react-router";
import { assertSafeUrlResolved } from "@/lib/ssrf-guard";
import { signedProxyUrl, verifyProxyParams, type ProxyTarget } from "@/lib/stream-sign.server";

// Relays HLS playlists and segments that need a specific Referer or
// User-Agent. Only links minted by our own master-playlist routes are
// accepted: the upstream URL and headers travel inside a signed, expiring
// token, so this endpoint can no longer be pointed at arbitrary hosts.
//
// Redirects are followed by hand and every hop is re-checked against the
// SSRF guard (including DNS), so an upstream 30x cannot steer us at a
// private or metadata address.

const MAX_REDIRECTS = 5;
const UPSTREAM_TIMEOUT_MS = 15_000;
const MAX_PLAYLIST_BYTES = 2 * 1024 * 1024;
const SNIFF_BYTES = 512 * 1024;
const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "range",
  "access-control-expose-headers": "content-length, content-range, accept-ranges",
};

function plain(status: number, body: string) {
  return new Response(body, {
    status,
    headers: { ...CORS, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

async function fetchFollowingRedirects(
  start: URL,
  headers: Record<string, string>,
): Promise<{ response: Response; finalUrl: URL }> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(current.toString(), { headers, redirect: "manual", signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, finalUrl: current };
    const location = response.headers.get("location");
    if (!location) return { response, finalUrl: current };
    current = await assertSafeUrlResolved(new URL(location, current).toString());
  }
  throw new Error("Too many redirects");
}

/** Rewrite every URI in a playlist to a signed proxy link with the same headers and expiry. */
async function rewritePlaylist(text: string, base: URL, parent: ProxyTarget): Promise<string> {
  const sign = (raw: string) => {
    let absolute: string;
    try {
      absolute = new URL(raw, base).toString();
    } catch {
      return Promise.resolve("");
    }
    if (!/^https?:\/\//i.test(absolute)) return Promise.resolve("");
    return signedProxyUrl({ url: absolute, referer: parent.referer, ua: parent.ua, exp: parent.exp });
  };

  const out: string[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }
    if (trimmed.startsWith("#")) {
      // Tags such as #EXT-X-KEY, #EXT-X-MAP and #EXT-X-MEDIA carry URI="...".
      const matches = [...trimmed.matchAll(/URI="([^"]+)"/g)];
      if (!matches.length) {
        out.push(line);
        continue;
      }
      let rewritten = trimmed;
      for (const match of matches) {
        const signed = await sign(match[1]);
        if (signed) rewritten = rewritten.replace(match[0], `URI="${signed}"`);
      }
      out.push(rewritten);
      continue;
    }
    const signed = await sign(trimmed);
    out.push(signed || trimmed);
  }
  return out.join("\n");
}

function looksLikePlaylist(contentType: string, url: URL): boolean {
  if (contentType.includes("mpegurl")) return true;
  const path = url.pathname.toLowerCase();
  return path.endsWith(".m3u8") || path.endsWith(".m3u");
}

function mightBePlaylist(contentType: string, length: number | null): boolean {
  if (length !== null && length > SNIFF_BYTES) return false;
  return contentType === "" || contentType.startsWith("text/") || contentType.includes("octet-stream");
}

export const Route = createFileRoute("/api/public/stream")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const target = await verifyProxyParams(url.searchParams.get("u"), url.searchParams.get("s"));
        if (!target) return plain(403, "forbidden");

        let parsed: URL;
        try {
          parsed = await assertSafeUrlResolved(target.url);
        } catch {
          return plain(400, "bad url");
        }

        const headers: Record<string, string> = {
          "user-agent": target.ua || DEFAULT_UA,
          accept: "*/*",
        };
        if (target.referer) {
          headers.referer = target.referer;
          try {
            headers.origin = new URL(target.referer).origin;
          } catch {
            // A malformed referer is still forwarded as-is; origin is optional.
          }
        }
        const range = request.headers.get("range");
        if (range && /^bytes=\d*-\d*$/.test(range)) headers.range = range;

        let upstream: Response;
        let finalUrl: URL;
        try {
          ({ response: upstream, finalUrl } = await fetchFollowingRedirects(parsed, headers));
        } catch {
          return plain(502, "upstream unavailable");
        }
        if (!upstream.ok && upstream.status !== 206) {
          return plain(upstream.status >= 500 ? 502 : 404, "upstream error");
        }

        const contentType = (upstream.headers.get("content-type") ?? "").toLowerCase();
        const declaredLength = Number(upstream.headers.get("content-length"));
        const length = Number.isFinite(declaredLength) && declaredLength > 0 ? declaredLength : null;

        let playlistText: string | null = null;
        let bufferedBody: ArrayBuffer | null = null;

        if (looksLikePlaylist(contentType, finalUrl) || looksLikePlaylist(contentType, parsed)) {
          if (length !== null && length > MAX_PLAYLIST_BYTES) return plain(502, "playlist too large");
          playlistText = await upstream.text();
          if (playlistText.length > MAX_PLAYLIST_BYTES) return plain(502, "playlist too large");
        } else if (mightBePlaylist(contentType, length)) {
          // Tokenised playlist URLs often have no extension and a generic
          // content type; peek at the body before deciding.
          bufferedBody = await upstream.arrayBuffer();
          if (bufferedBody.byteLength <= MAX_PLAYLIST_BYTES) {
            const head = new TextDecoder().decode(bufferedBody.slice(0, 16));
            if (head.trimStart().startsWith("#EXTM3U")) {
              playlistText = new TextDecoder().decode(bufferedBody);
              bufferedBody = null;
            }
          }
        }

        if (playlistText !== null) {
          const rewritten = await rewritePlaylist(playlistText, finalUrl, target);
          return new Response(rewritten, {
            status: 200,
            headers: {
              ...CORS,
              "content-type": "application/vnd.apple.mpegurl",
              "cache-control": "no-store",
              "x-content-type-options": "nosniff",
            },
          });
        }

        const passHeaders = new Headers({
          ...CORS,
          "cache-control": "private, max-age=120",
          "x-content-type-options": "nosniff",
        });
        for (const name of ["content-type", "content-length", "content-range", "accept-ranges"]) {
          const value = upstream.headers.get(name);
          if (value) passHeaders.set(name, value);
        }
        return new Response(bufferedBody ?? upstream.body, { status: upstream.status, headers: passHeaders });
      },
    },
  },
});
