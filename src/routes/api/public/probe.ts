import { createFileRoute } from "@tanstack/react-router";

/**
 * Per-channel uptime probe. Loads the server-only store lazily inside
 * handlers so it never ships to the client bundle.
 */

const CACHE_TTL_MS = 60_000;
const CORS = {
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
  "content-type": "application/json",
};

export const Route = createFileRoute("/api/public/probe")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: { ...CORS, "access-control-allow-methods": "GET, OPTIONS" },
        }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const arb = url.searchParams.get("url");
        const slug = url.searchParams.get("slug");
        const { M3U_CHANNELS } = await import("@/lib/m3u-channels");
        const { probeOne, getSnapshot, sweepAll, triggerSweepIfStale } = await import(
          "@/lib/probe-store.server"
        );

        if (arb) {
          const r = await probeOne(arb);
          return new Response(JSON.stringify(r), { headers: CORS });
        }
        if (slug) {
          const ch = M3U_CHANNELS.find((c) => c.slug === slug);
          if (!ch)
            return new Response(JSON.stringify({ error: "unknown slug" }), {
              status: 404,
              headers: CORS,
            });
          const snap = getSnapshot();
          const cached = snap.results.find((r) => r.slug === slug);
          if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
            return new Response(JSON.stringify(cached), { headers: CORS });
          }
          const r = await probeOne(ch.url, ch.name, ch.slug);
          return new Response(JSON.stringify(r), { headers: CORS });
        }

        const snap = getSnapshot();
        if (snap.checked === 0) await sweepAll(true);
        else triggerSweepIfStale();
        return new Response(JSON.stringify(getSnapshot()), { headers: CORS });
      },
    },
  },
});
