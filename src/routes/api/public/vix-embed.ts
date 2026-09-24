import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://vixsrc.to";

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

        // Vix blocks Vercel's server IP from its JSON API. Send the viewer to
        // the documented player page instead, so its own browser establishes
        // the required same-origin session and obtains a fresh embed token.
        const path = kind === "movie" ? `/movie/${id}/` : `/tv/${id}/${season}/${episode}/`;
        const target = new URL(path, BASE);
        target.searchParams.set("autoplay", "false");
        target.searchParams.set("lang", "en");
        return new Response(null, {
          status: 302,
          headers: {
            location: target.toString(),
            "cache-control": "no-store",
            // Avoid Vix treating the embedding site as a blocked referrer.
            "referrer-policy": "no-referrer",
          },
        });
      },
    },
  },
});
