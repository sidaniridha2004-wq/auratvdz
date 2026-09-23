import { getYacineConfig } from "./yacine-config.server";

export type FallbackYacineStream = {
  name: string;
  url: string;
  referer: string;
  userAgent: string;
};

type Json = Record<string, unknown>;
type GoodEntry = { streams: FallbackYacineStream[]; expiresAt: number };

const API_FALLBACKS = [
  "https://def.ycnapi.com",
  "https://def11.ycnapi.com",
  "https://deft.yacinelive.com",
];
const LAST_GOOD_TTL_MS = 10 * 60_000;
const lastGood = new Map<string, GoodEntry>();

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

function rows(payload: unknown): Json[] {
  if (Array.isArray(payload)) return payload as Json[];
  const data = (payload as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as Json[]) : [];
}

function decode(encoded: string, timestamp: string, keyBase: string): unknown {
  const input = Buffer.from(encoded.trim(), "base64");
  const key = Buffer.from(keyBase + timestamp, "utf8");
  const output = Buffer.allocUnsafe(input.length);
  for (let i = 0; i < input.length; i += 1) output[i] = input[i] ^ key[i % key.length];
  return JSON.parse(output.toString("utf8")) as unknown;
}

function absoluteUrl(value: unknown, base?: string): string {
  const candidate = text(value);
  if (!candidate) return "";
  try {
    const parsed = base ? new URL(candidate, base + "/") : new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export function rememberYacineChannelStreams(channelId: string, streams: FallbackYacineStream[]): void {
  if (!streams.length) return;
  lastGood.set(channelId, { streams, expiresAt: Date.now() + LAST_GOOD_TTL_MS });
}

function remembered(channelId: string): FallbackYacineStream[] {
  const hit = lastGood.get(channelId);
  if (!hit) return [];
  if (hit.expiresAt <= Date.now()) {
    lastGood.delete(channelId);
    return [];
  }
  return hit.streams;
}

/**
 * A channel id can be listed by one Yacine API host while its playable feed is
 * present on another. Try every known host and accept the first non-empty
 * channel response instead of treating an empty 200 response as authoritative.
 */
export async function fetchYacineChannelFallback(channelId: string): Promise<FallbackYacineStream[]> {
  if (!/^\d{1,30}$/.test(channelId)) return [];

  const cached = remembered(channelId);
  if (cached.length) return cached;

  const config = getYacineConfig();
  const hosts = Array.from(new Set([config.apiUrl, ...API_FALLBACKS]));
  const outcomes: string[] = [];

  for (const host of hosts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(host + "/api/channel/" + channelId, {
        headers: { Accept: "*/*", "User-Agent": "okhttp/4.12.0" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        outcomes.push(new URL(host).host + ":http-" + response.status);
        continue;
      }

      const timestamp = response.headers.get("t") ?? String(Math.floor(Date.now() / 1000));
      const rawRows = rows(decode(await response.text(), timestamp, config.decryptKey));
      const streams = rawRows
        .map((item) => ({
          name: text(item.name).slice(0, 40),
          url: absoluteUrl(item.url ?? item.stream_url ?? item.stream ?? item.link, config.streamUrl),
          referer: absoluteUrl(item.referer ?? item.referrer),
          userAgent: text(item.user_agent ?? item.userAgent).slice(0, 256),
        }))
        .filter((stream) => stream.url !== "");

      outcomes.push(new URL(host).host + ":" + rawRows.length + "-rows/" + streams.length + "-streams");
      if (streams.length) {
        rememberYacineChannelStreams(channelId, streams);
        return streams;
      }
    } catch (error) {
      const reason = error instanceof Error ? error.name : "error";
      outcomes.push(new URL(host).host + ":" + reason);
    } finally {
      clearTimeout(timer);
    }
  }

  console.error("[auratv] No Yacine streams for channel", channelId, outcomes.join(", "));
  return remembered(channelId);
}
