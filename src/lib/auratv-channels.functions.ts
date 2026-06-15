import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Source: user-provided pastebin manifest. Raw endpoint.
const PASTEBIN_URL = "https://pastebin.com/raw/4y28Ad1U";

interface Manifest {
  match_channels: Record<string, Record<string, string>>;
}

let cache: { at: number; data: Manifest } | null = null;
const TTL_MS = 10 * 60_000;

async function loadManifest(): Promise<Manifest> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const r = await fetch(PASTEBIN_URL, { redirect: "follow" });
  if (!r.ok) throw new Error(`pastebin ${r.status}`);
  const data = (await r.json()) as Manifest;
  cache = { at: Date.now(), data };
  return data;
}

export interface AuraChannel {
  key: string;
  name: string;
  qualities: string[];
}

export const getAuraChannels = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const m = await loadManifest();
    const map = m.match_channels ?? {};
    const out: AuraChannel[] = Object.entries(map).map(([key, qs]) => ({
      key,
      name: key.replace(/\bsportss\b/gi, "sports").replace(/\bsp rts\b/gi, "sports"),
      qualities: Object.keys(qs ?? {}),
    }));
    // Filter out channels with no qualities
    return out.filter((c) => c.qualities.length > 0).sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    console.error("getAuraChannels failed", e);
    return [] as AuraChannel[];
  }
});

export const getAuraChannelStreams = createServerFn({ method: "GET" })
  .inputValidator(z.object({ key: z.string().min(1).max(120) }))
  .handler(async ({ data }) => {
    const m = await loadManifest();
    const entry = m.match_channels?.[data.key];
    if (!entry) return [] as { quality: string; url: string }[];
    return Object.entries(entry).map(([quality, url]) => ({ quality, url }));
  });
