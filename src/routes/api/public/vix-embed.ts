import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://vixsrc.to";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function plain(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/vix-embed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const kind = url.searchParams.get("kind");
        const id = Number(url.searchParams.get("id"));
        const season = Number(url.searchParams.get("season") ?? "1");
        const episode = Number(url.searchParams.get("episode") ?? "1");
        if ((kind !== "movie" && kind !== "tv") || !Number.isInteger(id) || id <= 0) {
          return plain(400, "invalid title");
        }
        if (kind === "tv" && (!Number.isInteger(season) || season < 0 || !Number.isInteger(episode) || episode < 1)) {
          return plain(400, "invalid episode");
        }

        const apiPath = kind === "movie" ? "/api/movie/" + id : "/api/tv/" + id + "/" + season + "/" + episode;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12_000);
        try {
          const response = await fetch(BASE + apiPath, {
            headers: {
              "user-agent": UA,
              accept: "application/json, text/javascript, */*; q=0.01",
              "accept-language": "en-US,en;q=0.9",
              referer: BASE + "/",
              origin: BASE,
            },
            redirect: "follow",
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) return plain(502, "VixSrc unavailable");
          const payload = (await response.json()) as { src?: unknown };
          if (typeof payload.src !== "string" || !payload.src) return plain(404, "VixSrc has no player for this title");
          const target = new URL(payload.src, BASE);
          if (target.protocol !== "https:" || target.hostname !== "vixsrc.to" || !target.pathname.startsWith("/embed/")) {
            return plain(502, "invalid VixSrc player response");
          }
          return new Response(null, {
            status: 302,
            headers: {
              location: target.toString(),
              "cache-control": "no-store",
              "referrer-policy": "origin",
            },
          });
        } catch {
          return plain(502, "VixSrc unavailable");
        } finally {
          clearTimeout(timer);
        }
      },
    },
  },
});
