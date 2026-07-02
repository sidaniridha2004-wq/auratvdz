// Shared probe cache + best-effort background scheduler.
// Runs at module scope; each Worker isolate keeps its own cache.
// On serverless runtimes without long-lived isolates the sweep is triggered
// lazily on incoming requests (see triggerSweepIfStale).

import { assertSafeUrl } from "@/lib/ssrf-guard";
import { M3U_CHANNELS } from "@/lib/m3u-channels";

export interface ProbeResult {
  slug: string;
  name: string;
  url: string;
  ok: boolean;
  status: number;
  ms: number;
  reason?: string;
  checkedAt: number;
}

const CACHE_TTL_MS = 3 * 60_000;
const PROBE_TIMEOUT_MS = 6_000;
const cache = new Map<string, ProbeResult>();
let sweeping = false;
let lastSweep = 0;

const MAX_REDIRECTS = 5;

export async function probeOne(url: string, name = "", slug = ""): Promise<ProbeResult> {
  const t0 = Date.now();
  let safe: URL;
  try {
    safe = assertSafeUrl(url);
  } catch (e) {
    return {
      slug, name, url, ok: false, status: 0, ms: 0,
      reason: e instanceof Error ? e.message : "unsafe url",
      checkedAt: Date.now(),
    };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    // Walk redirects manually and re-validate every hop with assertSafeUrl —
    // otherwise a public URL could 30x to a private/metadata IP and bypass
    // the initial SSRF check.
    let current = safe;
    let r: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      r = await fetch(current.toString(), { signal: ctrl.signal, redirect: "manual" });
      if (![301, 302, 303, 307, 308].includes(r.status)) break;
      const loc = r.headers.get("location");
      if (!loc) break;
      current = assertSafeUrl(new URL(loc, current).toString());
      r = null;
    }
    if (!r) {
      return { slug, name, url, ok: false, status: 0, ms: Date.now() - t0, reason: "too many redirects", checkedAt: Date.now() };
    }
    const ms = Date.now() - t0;
    if (!r.ok) {
      return { slug, name, url, ok: false, status: r.status, ms, reason: `HTTP ${r.status}`, checkedAt: Date.now() };
    }
    const text = (await r.text()).slice(0, 512);
    const looksLikeHls = text.includes("#EXTM3U");
    return {
      slug, name, url, ok: looksLikeHls, status: r.status, ms,
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

export async function sweepAll(force = false): Promise<void> {
  if (sweeping) return;
  if (!force && Date.now() - lastSweep < CACHE_TTL_MS) return;
  sweeping = true;
  lastSweep = Date.now();
  try {
    const concurrency = 6;
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
    console.log(`[probe] sweep complete: ${cache.size} channels in ${Date.now() - lastSweep}ms`);
  } finally {
    sweeping = false;
  }
}

/** Kick a background sweep if data is stale. Non-blocking. */
export function triggerSweepIfStale(): void {
  const stale = Date.now() - lastSweep > CACHE_TTL_MS;
  if (stale) sweepAll(false).catch((e) => console.warn("[probe] sweep err", e));
}

export function getSnapshot(): {
  total: number;
  up: number;
  down: number;
  checked: number;
  lastSweep: number;
  results: ProbeResult[];
} {
  const results = Array.from(cache.values());
  return {
    total: M3U_CHANNELS.length,
    checked: results.length,
    up: results.filter((r) => r.ok).length,
    down: results.filter((r) => !r.ok).length,
    lastSweep,
    results,
  };
}

export function getFailureFor(slug: string): ProbeResult | undefined {
  return cache.get(slug);
}

// Best-effort in-isolate scheduler.
try {
  if (typeof setInterval === "function") {
    setInterval(() => {
      sweepAll(false).catch(() => {});
    }, CACHE_TTL_MS);
  }
} catch {}
