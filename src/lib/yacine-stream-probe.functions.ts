import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normaliseChannelName } from "./match-channel";

const HOSTS = ["https://def.ycnapi.com", "https://def11.ycnapi.com", "https://deft.yacinelive.com"];
type Json = Record<string, unknown>;
function decode(encoded: string, timestamp: string, keyBase: string): unknown {
  const input = Buffer.from(encoded.trim(), "base64");
  const key = Buffer.from(keyBase + timestamp, "utf8");
  const output = Buffer.allocUnsafe(input.length);
  for (let i = 0; i < input.length; i += 1) output[i] = input[i] ^ key[i % key.length];
  return JSON.parse(output.toString("utf8")) as unknown;
}
function rows(payload: unknown): Json[] {
  if (Array.isArray(payload)) return payload as Json[];
  const data = (payload as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as Json[]) : [];
}
const text = (v: unknown) => typeof v === "string" ? v.trim() : "";

export const probeYacineStream = createServerFn({ method: "GET" })
  .inputValidator(z.object({ name: z.string().min(1).max(120).default("Alkass 1") }))
  .handler(async ({ data }) => {
    const { discoverYacineConfig } = await import("./yacine-discovery.server");
    const { getYacineConfig } = await import("./yacine-config.server");
    const { fetchYacineDirectory } = await import("./yacine-api.server");
    await discoverYacineConfig();
    const config = getYacineConfig();
    const directory = await fetchYacineDirectory();
    const wanted = normaliseChannelName(data.name);
    const channel = directory.channels.find((c) => normaliseChannelName(c.name) === wanted) ?? null;
    if (!channel) return { name: data.name, directoryCount: directory.channels.length, channel: null, outcomes: [] };
    const hosts = Array.from(new Set([config.apiUrl, ...HOSTS]));
    const outcomes = await Promise.all(hosts.map(async (host) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      try {
        const response = await fetch(host + "/api/channel/" + channel.id, { headers: { Accept: "*/*", "User-Agent": "okhttp/4.12.0" }, cache: "no-store", signal: controller.signal });
        if (!response.ok) return { host: new URL(host).host, apiStatus: response.status };
        const timestamp = response.headers.get("t") ?? String(Math.floor(Date.now() / 1000));
        const streamRows = rows(decode(await response.text(), timestamp, config.decryptKey));
        const row = streamRows[0];
        if (!row) return { host: new URL(host).host, apiStatus: response.status, rows: 0 };
        const raw = text(row.url ?? row.stream_url ?? row.stream ?? row.link);
        let streamUrl = "";
        try { streamUrl = new URL(raw, config.streamUrl + "/").toString(); } catch {}
        if (!streamUrl) return { host: new URL(host).host, apiStatus: response.status, rows: streamRows.length, noUrl: true, keys: Object.keys(row) };
        const headers: Record<string,string> = { "user-agent": text(row.user_agent ?? row.userAgent) || "okhttp/4.12.0", accept: "*/*" };
        const ref = text(row.referer ?? row.referrer);
        if (ref) { headers.referer = ref; headers.origin = new URL(ref).origin; }
        const stream = await fetch(streamUrl, { headers, cache: "no-store", signal: controller.signal });
        const body = await stream.text();
        return {
          host: new URL(host).host,
          apiStatus: response.status,
          rows: streamRows.length,
          keys: Object.keys(row),
          label: text(row.name),
          streamHost: new URL(streamUrl).host,
          hasReferer: Boolean(ref),
          hasUserAgent: Boolean(text(row.user_agent ?? row.userAgent)),
          streamStatus: stream.status,
          streamType: stream.headers.get("content-type"),
          startsM3u: body.trimStart().startsWith("#EXTM3U"),
          bodyStart: body.trimStart().slice(0, 80),
        };
      } catch (error) {
        return { host: new URL(host).host, error: error instanceof Error ? error.name : "error" };
      } finally { clearTimeout(timer); }
    }));
    return { name: data.name, directoryCount: directory.channels.length, channel, outcomes };
  });
