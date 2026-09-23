import { createFileRoute } from "@tanstack/react-router";
import { fetchYacineChannelVariants, fetchYacineDirectory, type YacineVariant } from "@/lib/yacine-api.server";
import {
  fetchYacineChannelFallback,
  rememberYacineChannelStreams,
} from "@/lib/yacine-channel-fallback.server";
import { discoverYacineConfig } from "@/lib/yacine-discovery.server";
import { normaliseChannelName } from "@/lib/match-channel";
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

function channelNameFromRequest(request: Request, url: URL): string {
  const explicit = url.searchParams.get("name")?.trim();
  if (explicit) return explicit.slice(0, 120);
  const referer = request.headers.get("referer");
  if (!referer) return "";
  try {
    return (new URL(referer).searchParams.get("name")?.trim() ?? "").slice(0, 120);
  } catch {
    return "";
  }
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
        const requestedName = channelNameFromRequest(request, url);

        let variants: YacineVariant[];
        try {
          await discoverYacineConfig();
          variants = await fetchYacineChannelVariants(channelId, wanted);
          if (variants.length) {
            rememberYacineChannelStreams(
              channelId,
              variants.map(({ name, url: streamUrl, referer, userAgent }) => ({
                name,
                url: streamUrl,
                referer,
                userAgent,
              })),
            );
          }

          // Yacine rotates its large channel IDs. A page opened before a
          // rotation can therefore hold an id whose /api/channel route now
          // returns 404. Resolve the current ids by the stable channel name and
          // rebuild the quality ladder from those entries.
          if (!variants.length && requestedName) {
            const wantedName = normaliseChannelName(requestedName);
            const directory = await fetchYacineDirectory();
            const current = directory.channels
              .filter((channel) => normaliseChannelName(channel.name) === wantedName)
              .sort((a, b) => {
                const ah = heightFromLabel(a.categoryName) || heightFromLabel(a.name);
                const bh = heightFromLabel(b.categoryName) || heightFromLabel(b.name);
                if (wanted) return Math.abs(ah - wanted) - Math.abs(bh - wanted);
                return bh - ah;
              })
              .slice(0, 8);

            const recovered = await Promise.all(
              current.map(async (channel) => ({
                channel,
                streams: await fetchYacineChannelFallback(channel.id),
              })),
            );
            const seen = new Set<string>();
            variants = recovered.flatMap(({ channel, streams }) => {
              const hint = heightFromLabel(channel.categoryName) || heightFromLabel(channel.name) || wanted || 720;
              return streams.flatMap((stream) => {
                if (seen.has(stream.url)) return [];
                seen.add(stream.url);
                return [{ ...stream, channelId: channel.id, height: heightFromLabel(stream.name) || hint }];
              });
            });
          }

          if (!variants.length) {
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
          headers: {
            ...CORS,
            "content-type": "application/vnd.apple.mpegurl",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
