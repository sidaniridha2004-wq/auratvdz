import { createFileRoute } from "@tanstack/react-router";
import { fetchYacineChannelStreams } from "@/lib/yacine-api.server";
import { signedProxyUrl } from "@/lib/stream-sign.server";

// HLS master playlist for a live-API channel. Every quality the upstream
// offers becomes one variant, so hls.js can switch bitrates on its own.
// Variant URLs are signed proxy links: the browser never learns the upstream
// address or the headers it needs, and the proxy refuses anything we did not
// mint ourselves.

const BANDWIDTH: Record<number, number> = {
  2160: 12_000_000,
  1080: 5_000_000,
  720: 2_800_000,
  480: 1_400_000,
  360: 800_000,
  240: 400_000,
};

/** Turn a label such as "1080P", "FHD" or "SD" into a resolution rung. */
function resolveQuality(name: string): { height: number; bandwidth: number } {
  const label = (name || "").toUpperCase();
  const digits = parseInt(label.match(/(\d{3,4})/)?.[1] ?? "0", 10);
  let height = digits >= 144 && digits <= 4320 ? digits : 0;
  if (!height) {
    if (label.includes("4K") || label.includes("UHD")) height = 2160;
    else if (label.includes("FHD") || label.includes("FULL")) height = 1080;
    else if (label.includes("HD")) height = 720;
    else if (label.includes("SD")) height = 480;
    else if (label.includes("LOW")) height = 240;
    else height = 720;
  }
  const bandwidth = BANDWIDTH[height] ?? Math.max(300_000, Math.round((height / 1080) * 5_000_000));
  return { height, bandwidth };
}

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

export const Route = createFileRoute("/api/public/master")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const channelId = Number(url.searchParams.get("channelId"));
        if (!Number.isInteger(channelId) || channelId <= 0 || channelId > 99_999_999) {
          return plain(400, "missing channelId");
        }
        // Optional: pin the playlist to one rung, so a channel opened from a
        // resolution-specific category plays only that quality.
        const onlyHeight = Number(url.searchParams.get("q")) || 0;

        let streams: Awaited<ReturnType<typeof fetchYacineChannelStreams>>;
        try {
          streams = await fetchYacineChannelStreams(channelId);
        } catch {
          return plain(502, "upstream error");
        }
        if (!streams.length) return plain(404, "no streams");

        // Low to high, so hls.js starts conservatively and steps up.
        let variants = streams
          .map((stream) => ({ stream, quality: resolveQuality(stream.name) }))
          .sort((a, b) => a.quality.bandwidth - b.quality.bandwidth);

        if (onlyHeight) {
          const exact = variants.filter((v) => v.quality.height === onlyHeight);
          if (exact.length) variants = exact;
        }

        const lines: string[] = ["#EXTM3U", "#EXT-X-VERSION:3"];
        for (const v of variants) {
          const width = Math.round((v.quality.height * 16) / 9);
          const name = (v.stream.name || `${v.quality.height}p`).replace(/["\r\n]/g, "");
          lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${v.quality.bandwidth},RESOLUTION=${width}x${v.quality.height},NAME="${name}"`);
          lines.push(
            await signedProxyUrl({
              url: v.stream.url,
              referer: v.stream.referer || undefined,
              ua: v.stream.userAgent || undefined,
            }),
          );
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
