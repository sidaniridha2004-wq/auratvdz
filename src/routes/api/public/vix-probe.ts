import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://vixsrc.to";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const HEADERS = {
  "user-agent": UA,
  accept: "application/json, text/javascript, */*; q=0.01",
  "accept-language": "en-US,en;q=0.9",
  referer: BASE + "/",
  origin: BASE,
};

function html(status: number, data: unknown): Response {
  const body = JSON.stringify(data, null, 2).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
  return new Response(`<!doctype html><title>Vix probe</title><pre>${body}</pre>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/vix-probe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const input = new URL(request.url);
        const id = Number(input.searchParams.get("id"));
        if (!Number.isInteger(id) || id <= 0) return html(400, { error: "invalid id" });
        try {
          const api = await fetch(`${BASE}/api/movie/${id}`, { headers: HEADERS, cache: "no-store" });
          const payload = (await api.json()) as { src?: unknown };
          if (typeof payload.src !== "string") return html(200, { apiStatus: api.status, hasSrc: false });
          const target = new URL(payload.src, BASE);
          const page = `${BASE}/movie/${id}`;
          const embed = await fetch(target, {
            headers: { ...HEADERS, accept: "text/html,*/*", referer: page },
            cache: "no-store",
            redirect: "follow",
          });
          const text = await embed.text();
          return html(200, {
            apiStatus: api.status,
            embedStatus: embed.status,
            embedHost: new URL(embed.url).hostname,
            embedPathOk: new URL(embed.url).pathname.startsWith("/embed/"),
            contentType: embed.headers.get("content-type"),
            xFrameOptions: embed.headers.get("x-frame-options"),
            frameAncestors: embed.headers.get("content-security-policy")?.match(/frame-ancestors[^;]*/i)?.[0] ?? null,
            htmlBytes: text.length,
            markers: {
              masterPlaylist: text.includes("masterPlaylist"),
              playlist: /playlist/i.test(text),
              token: /["']?token["']?\s*[:=]/i.test(text),
              expires: /["']?expires["']?\s*[:=]/i.test(text),
              absoluteUrl: /https?:\\?\/\\?\//i.test(text),
              m3u8: /m3u8/i.test(text),
              blocked: /blocked|forbidden|access denied/i.test(text),
            },
            scriptSrcs: [...text.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].slice(0, 12).map((m) => m[1]),
          });
        } catch (error) {
          return html(502, { error: error instanceof Error ? error.message : "probe failed" });
        }
      },
    },
  },
});
