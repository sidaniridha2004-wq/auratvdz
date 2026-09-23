import { createFileRoute } from "@tanstack/react-router";
import { fetchYacineChannelVariants, type YacineVariant } from "@/lib/yacine-api.server";
import {
  fetchYacineChannelFallback,
  rememberYacineChannelStreams,
} from "@/lib/yacine-channel-fallback.server";
import { discoverYacineConfig } from "@/lib/yacine-discovery.server";
import { signedProxyUrl } from "@/lib/stream-sign.server";
import { bandwidthForHeight, heightFromLabel } from "@/lib/quality";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "range",
};

function plain(status: number, body: string) {
  return new Response(body, {
    status,
    headers: { ...CORS, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

function cleanName(value: string): string {
  return value.replace(/["\r\n,]/g, "").trim();
}

export const Route = createFileRoute("/api/public/master")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const channelId = url.searchParams.get("channelId")?.trim() ?? "";
        if (!/^\d{1,30}$/.test(channelId)) return plain(400, "missing channelId");
        const wanted = heightFromLabel(url.searchParams.get("q"));

        let variants: YacineVariant[];
        try {
          await discoverYacineConfig();
          variants = await fetchYacineChannelVariants(channelId, wanted);
          if (variants.length) {
            rememberYacineChannelStreams(
              channelId,
              variants.map(({ name, url, referer, userAgent }) => ({ name, url, referer, userAgent })),
            );
          } else {
            const fallback = await fetchYacineChannelFallback(channelId);
            variants = fallback.map((stream) => ({
              ...stream,
              channelId,
              height: heightFromLabel(stream.name) || wanted || 720,
            }));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("[auratv] Yacine master failed:", message.slice(0, 300));
          return plain(502, "upstream error");
        }
        if (!variants.length) return plain(404, "no streams");

        variants.sort((a, b) => a.height - b.height);
        if (wanted) {
          const preferred = variants.filter((v) => v.height === wanted);
          if (preferred.length) variants = [...preferred, ...variants.filter((v) => v.height !== wanted)];
        }

        const lines: string[] = ["#EXTM3U", "#EXT-X-VERSION:3"];
        for (const v of variants) {
          const bandwidth = bandwidthForHeight(v.height);
          const width = Math.round((v.height * 16) / 9);
          const label = cleanName(v.name) || v.height + "p";
          lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${v.height},NAME="${label}"`);
          lines.push(await signedProxyUrl({ url: v.url, referer: v.referer || undefined, ua: v.userAgent || undefined }));
        }

        return new Response(lines.join("\n") + "\n", {
          status: 200,
          headers: { ...CORS, "content-type": "application/vnd.apple.mpegurl", "cache-control": "no-store", "x-content-type-options": "nosniff" },
        });
      },
    },
  },
});
