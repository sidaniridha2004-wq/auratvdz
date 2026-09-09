import { createFileRoute } from "@tanstack/react-router";

/**
 * Per-channel uptime probe. Only known channel slugs can be probed; the old
 * `?url=` parameter, which let anyone make this server request arbitrary
 * addresses, is gone. The server-only store is loaded lazily inside the
 * handler so it never ships to the client bundle.
 */

const CACHE_TTL_MS = 60_000;
const SLUG_RE = /^[a-z0-9-]{1,80}$/;
const HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

export const Route = createFileRoute("/api/public/probe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const slug = url.searchParams.get("slug");
        const { M3U_CHANNELS } = await import("@/lib/m3u-channels");
        const { probeOne, getSnapshot, sweepAll, triggerSweepIfStale } = await import("@/lib/probe-store.server");

        if (slug !== null) {
          if (!SLUG_RE.test(slug)) return json({ error: "invalid slug" }, 400);
          const ch = M3U_CHANNELS.find((c) => c.slug === slug);
          if (!ch) return json({ error: "unknown slug" }, 404);
          const snap = getSnapshot();
          const cached = snap.results.find((r) => r.slug === slug);
          if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) return json(cached);
          return json(await probeOne(ch.url, ch.name, ch.slug));
        }

        const snap = getSnapshot();
        if (snap.checked === 0) await sweepAll(true);
        else triggerSweepIfStale();
        return json(getSnapshot());
      },
    },
  },
});
