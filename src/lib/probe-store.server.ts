// Shared probe cache plus a best-effort background scheduler.
// Runs at module scope; each worker isolate keeps its own cache. On serverless
// runtimes without long-lived isolates the sweep is triggered lazily on
// incoming requests (see triggerSweepIfStale).

import { assertSafeUrlResolved } from "@/lib/ssrf-guard";
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
const MAX_REDIRECTS = 5;
const cache = new Map<string, ProbeResult>();
let sweeping = false;
let lastSweep = 0;

function fail(base: Omit<ProbeResult, "ok" | "status" | "checkedAt">, reason: string, status = 0): ProbeResult {
  return { ...base, ok: false, status, reason, checkedAt: Date.now() };
}

export async function probeOne(url: string, name = "", slug = ""): Promise<ProbeResult> {
  const t0 = Date.now();
  const base = { slug, name, url, ms: 0 };
  let safe: URL;
  try {
    // Resolves DNS and checks the answer, so a public hostname that points at
    // a private address is rejected too.
    safe = await assertSafeUrlResolved(url);
  } catch (e) {
    return fail(base, e instanceof Error ? e.message : "unsafe url");
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    // Walk redirects by hand and re-validate every hop; otherwise a public URL
    // could 30x to a private or metadata address and bypass the first check.
    let current = safe;
    let r: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      r = await fetch(current.toString(), { signal: ctrl.signal, redirect: "manual" });
      if (![301, 302, 303, 307, 308].includes(r.status)) break;
      const loc = r.headers.get("location");
      if (!loc) break;
      current = await assertSafeUrlResolved(new URL(loc, current).toString());
      r = null;
    }
    const ms = Date.now() - t0;
    if (!r) return fail({ ...base, ms }, "too many redirects");
    if (!r.ok) return fail({ ...base, ms }, `HTTP ${r.status}`, r.status);
    const text = (await r.text()).slice(0, 512);
    const looksLikeHls = text.includes("#EXTM3U");
    return {
      ...base,
      ms,
      ok: looksLikeHls,
      status: r.status,
      reason: looksLikeHls ? undefined : "not a valid HLS manifest",
      checkedAt: Date.now(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Do not surface raw network error text (it can include internal
    // hostnames); map to a short, fixed vocabulary.
    const reason = /abort/i.test(msg) ? `timeout after ${PROBE_TIMEOUT_MS}ms` : "connection failed";
    return fail({ ...base, ms: Date.now() - t0 }, reason);
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
        const ch = M3U_CHANNELS[i++];
        cache.set(ch.slug, await probeOne(ch.url, ch.name, ch.slug));
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
  } finally {
    sweeping = false;
  }
}

/** Kick a background sweep if data is stale. Non-blocking. */
export function triggerSweepIfStale(): void {
  if (Date.now() - lastSweep > CACHE_TTL_MS) {
    sweepAll(false).catch(() => undefined);
  }
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
if (typeof setInterval === "function") {
  const handle = setInterval(() => {
    sweepAll(false).catch(() => undefined);
  }, CACHE_TTL_MS);
  // Do not keep a Node process alive just for this timer.
  (handle as { unref?: () => void }).unref?.();
}
