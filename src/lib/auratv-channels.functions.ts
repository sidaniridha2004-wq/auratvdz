import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Legacy channel manifest (key -> quality label -> stream URL). Fetched on the
// server only; raw upstream URLs never reach the browser. Playback goes through
// /api/public/auratv-master, which wraps each variant in a signed proxy URL.
const manifestUrl = () => process.env.AURATV_MANIFEST_URL || "https://pastebin.com/raw/4y28Ad1U";
const TTL_MS = 10 * 60_000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 512 * 1024;

const manifestSchema = z.object({
  match_channels: z.record(z.string().max(120), z.record(z.string().max(40), z.string().max(2048))).default({}),
});
type Manifest = z.infer<typeof manifestSchema>;

let cache: { at: number; data: Manifest } | null = null;

async function loadManifest(): Promise<Manifest> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(manifestUrl(), {
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "application/json, text/plain;q=0.9", "User-Agent": "AuraTV/1.0 (+https://auratvdz.lovable.app)" },
    });
    if (!r.ok) throw new Error(`manifest ${r.status}`);
    const body = await r.text();
    if (body.length > MAX_BYTES) throw new Error("manifest too large");
    const data = manifestSchema.parse(JSON.parse(body));
    cache = { at: Date.now(), data };
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export interface AuraChannel {
  key: string;
  name: string;
  qualities: string[];
}

const prettyName = (key: string) => key.replace(/\bsportss\b/gi, "sports").replace(/\bsp rts\b/gi, "sports");

/** Public: channel keys and quality labels only. */
export const getAuraChannels = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const m = await loadManifest();
    return Object.entries(m.match_channels)
      .map(([key, qs]): AuraChannel => ({ key, name: prettyName(key), qualities: Object.keys(qs ?? {}) }))
      .filter((c) => c.qualities.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [] as AuraChannel[];
  }
});

const keySchema = z.string().min(1).max(120).regex(/^[a-z0-9_.\- ]+$/i);

/**
 * Server-only. Not a server function on purpose: it returns raw upstream URLs
 * and is consumed exclusively by the master-playlist route.
 */
export async function getAuraChannelStreams(args: { data: { key: string } }): Promise<{ quality: string; url: string }[]> {
  const key = keySchema.parse(args.data.key);
  const m = await loadManifest();
  const entry = m.match_channels[key];
  if (!entry) return [];
  return Object.entries(entry)
    .filter(([, url]) => /^https?:\/\//i.test(url))
    .map(([quality, url]) => ({ quality, url }));
}
