import { createServerFn } from "@tanstack/react-start";

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

function safe(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) return "[url]";
    return value.slice(0, 160);
  }
  if (Array.isArray(value)) return depth < 2 ? value.slice(0, 5).map((item) => safe(item, depth + 1)) : `[array:${value.length}]`;
  if (typeof value === "object" && depth < 2) {
    return Object.fromEntries(Object.entries(value as Json).map(([key, item]) => [key, safe(item, depth + 1)]));
  }
  return `[${typeof value}]`;
}

export const probeYacineEvents = createServerFn({ method: "GET" }).handler(async () => {
  const { getYacineConfig } = await import("./yacine-config.server");
  const config = getYacineConfig();
  const hosts = Array.from(new Set([config.apiUrl, ...HOSTS]));
  const errors: string[] = [];
  for (const host of hosts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(host + "/api/events", {
        headers: { Accept: "*/*", "User-Agent": "okhttp/4.12.0" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        errors.push(new URL(host).host + ":" + response.status);
        continue;
      }
      const timestamp = response.headers.get("t") ?? String(Math.floor(Date.now() / 1000));
      const events = rows(decode(await response.text(), timestamp, config.decryptKey));
      return { host: new URL(host).host, count: events.length, events: events.slice(0, 12).map((event) => safe(event)), errors };
    } catch (error) {
      errors.push(new URL(host).host + ":" + (error instanceof Error ? error.name : "error"));
    } finally {
      clearTimeout(timer);
    }
  }
  return { host: null, count: 0, events: [], errors };
});
