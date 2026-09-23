import { createFileRoute } from "@tanstack/react-router";
import { getYacineConfig } from "@/lib/yacine-config.server";
import { discoverYacineConfig } from "@/lib/yacine-discovery.server";

type Json = Record<string, unknown>;

type Outcome = {
  host: string;
  httpStatus?: number;
  contentType?: string;
  bodyBytes?: number;
  timestampHeader: boolean;
  decode?: "ok" | "failed";
  decodeError?: string;
  payloadType?: string;
  payloadKeys?: string[];
  rowCount?: number;
  firstRowKeys?: string[];
  urlFields?: Record<string, number>;
  elapsedMs: number;
};

const FALLBACK_HOSTS = [
  "https://def.ycnapi.com",
  "https://def11.ycnapi.com",
  "https://deft.yacinelive.com",
];

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

function errorName(error: unknown): string {
  if (!(error instanceof Error)) return "UnknownError";
  return (error.name + ": " + error.message).slice(0, 160);
}

export const Route = createFileRoute("/api/public/yacine-diagnostic")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url);
        const channelId = requestUrl.searchParams.get("channelId")?.trim() ?? "";
        if (!/^\d{1,30}$/.test(channelId)) {
          return Response.json({ error: "missing channelId" }, { status: 400 });
        }

        await discoverYacineConfig();
        const config = getYacineConfig();
        const hosts = Array.from(new Set([config.apiUrl, ...FALLBACK_HOSTS]));
        const outcomes: Outcome[] = [];

        for (const base of hosts) {
          const started = Date.now();
          const outcome: Outcome = {
            host: new URL(base).host,
            timestampHeader: false,
            elapsedMs: 0,
          };
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12_000);
          try {
            const response = await fetch(base + "/api/channel/" + channelId, {
              headers: { Accept: "*/*", "User-Agent": "okhttp/4.12.0" },
              cache: "no-store",
              signal: controller.signal,
            });
            const timestamp = response.headers.get("t");
            const body = await response.text();
            outcome.httpStatus = response.status;
            outcome.contentType = response.headers.get("content-type") ?? "";
            outcome.bodyBytes = Buffer.byteLength(body);
            outcome.timestampHeader = Boolean(timestamp);

            if (response.ok) {
              try {
                const payload = decode(
                  body,
                  timestamp ?? String(Math.floor(Date.now() / 1000)),
                  config.decryptKey,
                );
                const payloadRows = rows(payload);
                outcome.decode = "ok";
                outcome.payloadType = Array.isArray(payload) ? "array" : typeof payload;
                outcome.payloadKeys =
                  payload && typeof payload === "object" && !Array.isArray(payload)
                    ? Object.keys(payload as Json).slice(0, 20)
                    : [];
                outcome.rowCount = payloadRows.length;
                outcome.firstRowKeys = Object.keys(payloadRows[0] ?? {}).slice(0, 30);
                outcome.urlFields = {
                  url: payloadRows.filter((row) => typeof row.url === "string" && row.url !== "").length,
                  stream_url: payloadRows.filter((row) => typeof row.stream_url === "string" && row.stream_url !== "").length,
                  stream: payloadRows.filter((row) => typeof row.stream === "string" && row.stream !== "").length,
                  link: payloadRows.filter((row) => typeof row.link === "string" && row.link !== "").length,
                };
              } catch (error) {
                outcome.decode = "failed";
                outcome.decodeError = errorName(error);
              }
            }
          } catch (error) {
            outcome.decode = "failed";
            outcome.decodeError = errorName(error);
          } finally {
            clearTimeout(timer);
            outcome.elapsedMs = Date.now() - started;
            outcomes.push(outcome);
          }
        }

        return Response.json(
          {
            channelId,
            selectedApiHost: new URL(config.apiUrl).host,
            selectedStreamHost: new URL(config.streamUrl).host,
            outcomes,
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
