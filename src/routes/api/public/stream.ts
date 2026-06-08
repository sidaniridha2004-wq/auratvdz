import { createFileRoute } from "@tanstack/react-router";

// Proxies HLS streams that require custom User-Agent / Referer headers,
// and rewrites .m3u8 playlist segment URLs to also flow through this proxy.
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
          parsed = new URL(target);
        } catch {
          return new Response("bad url", { status: 400 });
        }

        const headers: Record<string, string> = {};
        if (referer) headers["referer"] = referer;
        if (ua) headers["user-agent"] = ua;
        const range = request.headers.get("range");
        if (range) headers["range"] = range;

        const upstream = await fetch(parsed.toString(), { headers, redirect: "follow" });
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
          const text = await upstream.text();
          const finalUrl = new URL(upstream.url);
          const rewritten = text
            .split("\n")
            .map((line) => {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith("#")) {
                // rewrite URI="..." inside tags (keys, maps)
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

          return new Response(rewritten, {
            status: upstream.status,
            headers: {
              ...baseHeaders,
              "content-type": "application/vnd.apple.mpegurl",
            },
          });
        }

        // Pass through binary segments
        const passHeaders = new Headers(baseHeaders);
        const passThrough = ["content-type", "content-length", "content-range", "accept-ranges"];
        for (const h of passThrough) {
          const v = upstream.headers.get(h);
          if (v) passHeaders.set(h, v);
        }
        return new Response(upstream.body, {
          status: upstream.status,
          headers: passHeaders,
        });
      },
    },
  },
});
