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
function text(v: unknown) { return typeof v === "string" ? v.trim() : ""; }

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
    const channels = directory.channels.filter((c) => normaliseChannelName(c.name) === wanted).slice(0, 8);
    const outcomes = [];
    for (const channel of channels) {
      for (const host of Array.from(new Set([config.apiUrl, ...HOSTS]))) {
        try {
          const response = await fetch(host + "/api/channel/" + channel.id, { headers: { Accept: "*/*", "User-Agent": "okhttp/4.12.0" }, cache: "no-store" });
          if (!response.ok) { outcomes.push({ id: channel.id, category: channel.categoryName, host: new URL(host).host, apiStatus: response.status }); continue; }
          const timestamp = response.headers.get("t") ?? String(Math.floor(Date.now() / 1000));
          const streamRows = rows(decode(await response.text(), timestamp, config.decryptKey));
          for (const row of streamRows.slice(0, 3)) {
            const raw = text(row.url ?? row.stream_url ?? row.stream ?? row.link);
            let streamUrl = "";
            try { streamUrl = new URL(raw, config.streamUrl + "/").toString(); } catch {}
            let streamStatus: number | string = "no-url";
            let streamType: string | null = null;
            let startsM3u = false;
            if (streamUrl) {
              try {
                const headers: Record<string,string> = { "user-agent": text(row.user_agent ?? row.userAgent) || "okhttp/4.12.0", accept: "*/*" };
                const ref = text(row.referer ?? row.referrer);
                if (ref) { headers.referer = ref; headers.origin = new URL(ref).origin; }
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 10_000);
                const stream = await fetch(streamUrl, { headers, cache: "no-store", signal: controller.signal });
                clearTimeout(timer);
                streamStatus = stream.status;
                streamType = stream.headers.get("content-type");
                startsM3u = (await stream.text()).trimStart().startsWith("#EXTM3U");
              } catch (error) { streamStatus = error instanceof Error ? error.name : "error"; }
            }
            outcomes.push({
              id: channel.id,
              category: channel.categoryName,
              host: new URL(host).host,
              apiStatus: response.status,
              rows: streamRows.length,
              label: text(row.name),
              streamHost: streamUrl ? new URL(streamUrl).host : null,
              hasReferer: Boolean(text(row.referer ?? row.referrer)),
              hasUserAgent: Boolean(text(row.user_agent ?? row.userAgent)),
              streamStatus,
              streamType,
              startsM3u,
            });
          }
        } catch (error) {
          outcomes.push({ id: channel.id, category: channel.categoryName, host: new URL(host).host, error: error instanceof Error ? error.name : "error" });
        }
      }
    }
    return { name: data.name, directoryCount: directory.channels.length, channels, outcomes };
  });
