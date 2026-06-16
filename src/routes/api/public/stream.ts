import { createFileRoute } from "@tanstack/react-router";
import { assertSafeUrl } from "@/lib/ssrf-guard";

// Proxies HLS streams that require custom User-Agent / Referer headers,
// and rewrites .m3u8 playlist segment URLs to also flow through this proxy.

// Follow redirects manually so that every hop is re-validated by
// assertSafeUrl(). `redirect: "follow"` would let an attacker-controlled
// upstream 30x to a private/metadata IP that the original URL would have
// failed the SSRF check on.
const MAX_REDIRECTS = 5;
const UPSTREAM_TIMEOUT_MS = 15_000;

function rid() {
  return Math.random().toString(36).slice(2, 8);
}
function shortUrl(u: string) {
  try {
    const p = new URL(u);
    return `${p.hostname}${p.pathname.slice(0, 40)}`;
  } catch {
    return u.slice(0, 60);
  }
}

async function safeFetch(
  startUrl: URL,
  headers: Record<string, string>,
  logId: string,
): Promise<Response> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      console.warn(
        `[stream ${logId}] timeout ${UPSTREAM_TIMEOUT_MS}ms hop=${hop} ${shortUrl(current.toString())}`,
      );
    }, UPSTREAM_TIMEOUT_MS);
    let r: Response;
    const t0 = Date.now();
    try {
      r = await fetch(current.toString(), {
        headers,
        redirect: "manual",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    console.log(
      `[stream ${logId}] hop=${hop} status=${r.status} ${Date.now() - t0}ms ${shortUrl(current.toString())}`,
    );
    if (![301, 302, 303, 307, 308].includes(r.status)) return r;
    const loc = r.headers.get("location");
    if (!loc) return r;
    // Re-validate every hop — assertSafeUrl throws on private/metadata IPs
    current = assertSafeUrl(new URL(loc, current).toString());
  }
  throw new Error("Too many redirects");
}

export const Route = createFileRoute("/api/public/stream")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, OPTIONS",
            "access-control-allow-headers": "*",
          },
        }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const target = url.searchParams.get("url");
        const referer = url.searchParams.get("referer") ?? "";
        const ua = url.searchParams.get("ua") ?? "";
        if (!target) return new Response("missing url", { status: 400 });

        let parsed: URL;
        try {
          parsed = assertSafeUrl(target);
        } catch {
          return new Response("bad url", { status: 400 });
        }

        const headers: Record<string, string> = {};
        if (referer) headers["referer"] = referer;
        if (ua) headers["user-agent"] = ua;
        const range = request.headers.get("range");
        if (range) headers["range"] = range;

        const logId = rid();
        const t0 = Date.now();
        console.log(`[stream ${logId}] start ${shortUrl(parsed.toString())} range=${range ?? "-"}`);

        let upstream: Response;
        try {
          upstream = await safeFetch(parsed, headers, logId);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[stream ${logId}] upstream FAIL ${Date.now() - t0}ms ${msg}`);
          return new Response("upstream unavailable", {
            status: 502,
            headers: { "access-control-allow-origin": "*" },
          });
        }

        const ct = upstream.headers.get("content-type") ?? "";
        const isPlaylist =
          ct.includes("mpegurl") ||
          parsed.pathname.endsWith(".m3u8") ||
          parsed.pathname.endsWith(".m3u");

        const baseHeaders: Record<string, string> = {
          "access-control-allow-origin": "*",
          "access-control-expose-headers": "*",
          "cache-control": "no-store",
        };

        if (isPlaylist) {
          let text: string;
          try {
            text = await upstream.text();
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`[stream ${logId}] read playlist FAIL ${msg}`);
            return new Response("upstream read error", {
              status: 502,
              headers: { "access-control-allow-origin": "*" },
            });
          }
          const finalUrl = parsed;
          const lineCount = text.split("\n").length;
          const rewritten = text
            .split("\n")
            .map((line) => {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith("#")) {
                return line.replace(/URI="([^"]+)"/g, (_m, u: string) => {
                  const abs = new URL(u, finalUrl).toString();
                  const proxied = `/api/public/stream?url=${encodeURIComponent(abs)}${
                    referer ? `&referer=${encodeURIComponent(referer)}` : ""
                  }${ua ? `&ua=${encodeURIComponent(ua)}` : ""}`;
                  return `URI="${proxied}"`;
                });
              }
              const abs = new URL(trimmed, finalUrl).toString();
              return `/api/public/stream?url=${encodeURIComponent(abs)}${
                referer ? `&referer=${encodeURIComponent(referer)}` : ""
              }${ua ? `&ua=${encodeURIComponent(ua)}` : ""}`;
            })
            .join("\n");

          console.log(
            `[stream ${logId}] playlist ${text.length}B lines=${lineCount} ${Date.now() - t0}ms`,
          );
          return new Response(rewritten, {
            status: upstream.status,
            headers: { ...baseHeaders, "content-type": "application/vnd.apple.mpegurl" },
          });
        }

        const passHeaders = new Headers(baseHeaders);
        const passThrough = ["content-type", "content-length", "content-range", "accept-ranges"];
        for (const h of passThrough) {
          const v = upstream.headers.get(h);
          if (v) passHeaders.set(h, v);
        }
        const cl = upstream.headers.get("content-length") ?? "?";
        console.log(
          `[stream ${logId}] segment ct=${ct} bytes=${cl} status=${upstream.status} ${Date.now() - t0}ms`,
        );
        return new Response(upstream.body, {
          status: upstream.status,
          headers: passHeaders,
        });
      },
    },
  },
});
