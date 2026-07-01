import { createFileRoute } from "@tanstack/react-router";
import { assertSafeUrl } from "@/lib/ssrf-guard";
import { M3U_CHANNELS } from "@/lib/m3u-channels";

/**
 * Per-channel uptime probe.
 *
 * GET /api/public/probe                → probe every M3U channel (cached 60s)
 * GET /api/public/probe?slug=bein-max-1 → probe a single channel
 * GET /api/public/probe?url=<hls>       → probe an arbitrary URL
 *
 * Results are held in an in-memory cache; the "scheduled" side is a soft
 * poll — every incoming request older than TTL kicks a fresh probe in the
 * background so the dashboard always shows recent data without cron.
 */

interface ProbeResult {
  slug?: string;
  name?: string;
  url: string;
  ok: boolean;
  status: number;
  ms: number;
  reason?: string;
  checkedAt: number;
}

const CACHE_TTL_MS = 60_000;
const PROBE_TIMEOUT_MS = 6_000;
const cache = new Map<string, ProbeResult>();
let sweeping = false;
let lastSweep = 0;

async function probeOne(url: string, name?: string, slug?: string): Promise<ProbeResult> {
  const t0 = Date.now();
  let safe: URL;
  try {
    safe = assertSafeUrl(url);
  } catch (e) {
    return {
      slug,
      name,
      url,
      ok: false,
      status: 0,
      ms: 0,
      reason: e instanceof Error ? e.message : "unsafe url",
      checkedAt: Date.now(),
    };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const r = await fetch(safe.toString(), { signal: ctrl.signal, redirect: "follow" });
    const ms = Date.now() - t0;
    if (!r.ok) {
      return { slug, name, url, ok: false, status: r.status, ms, reason: `HTTP ${r.status}`, checkedAt: Date.now() };
    }
    const text = (await r.text()).slice(0, 512);
    const looksLikeHls = text.includes("#EXTM3U");
    return {
      slug,
      name,
      url,
      ok: looksLikeHls,
      status: r.status,
      ms,
      reason: looksLikeHls ? undefined : "not a valid HLS manifest",
      checkedAt: Date.now(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const reason = /abort/i.test(msg) ? `timeout after ${PROBE_TIMEOUT_MS}ms` : msg;
    return { slug, name, url, ok: false, status: 0, ms: Date.now() - t0, reason, checkedAt: Date.now() };
  } finally {
    clearTimeout(timer);
  }
}

async function sweepAll(force: boolean): Promise<void> {
  if (sweeping) return;
  if (!force && Date.now() - lastSweep < CACHE_TTL_MS) return;
  sweeping = true;
  lastSweep = Date.now();
  try {
    // Probe with light concurrency so we don't hammer the origin.
    const concurrency = 8;
    let i = 0;
    async function worker() {
      while (i < M3U_CHANNELS.length) {
        const idx = i++;
        const ch = M3U_CHANNELS[idx];
        const r = await probeOne(ch.url, ch.name, ch.slug);
        cache.set(ch.slug, r);
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
  } finally {
    sweeping = false;
  }
}

const CORS = {
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
  "content-type": "application/json",
};

export const Route = createFileRoute("/api/public/probe")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: { ...CORS, "access-control-allow-methods": "GET, OPTIONS" } }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const arb = url.searchParams.get("url");
        const slug = url.searchParams.get("slug");

        if (arb) {
          const r = await probeOne(arb);
          return new Response(JSON.stringify(r), { headers: CORS });
        }
        if (slug) {
          const ch = M3U_CHANNELS.find((c) => c.slug === slug);
          if (!ch) return new Response(JSON.stringify({ error: "unknown slug" }), { status: 404, headers: CORS });
          const cached = cache.get(slug);
          if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
            return new Response(JSON.stringify(cached), { headers: CORS });
          }
          const r = await probeOne(ch.url, ch.name, ch.slug);
          cache.set(slug, r);
          return new Response(JSON.stringify(r), { headers: CORS });
        }

        // Full sweep (cached). Kick a fresh sweep in background if stale.
        const stale = Date.now() - lastSweep > CACHE_TTL_MS;
        if (stale && cache.size === 0) {
          await sweepAll(true);
        } else if (stale) {
          // fire-and-forget background refresh
          sweepAll(false).catch(() => {});
        }
        const results = Array.from(cache.values());
        const summary = {
          total: M3U_CHANNELS.length,
          checked: results.length,
          up: results.filter((r) => r.ok).length,
          down: results.filter((r) => !r.ok).length,
          lastSweep,
          results,
        };
        return new Response(JSON.stringify(summary), { headers: CORS });
      },
    },
  },
});
