import { createFileRoute } from "@tanstack/react-router";
import { getAuraChannelStreams } from "@/lib/auratv-channels.functions";

// Build an HLS master playlist for an AuraTV channel key — every quality
// becomes a variant so hls.js handles ABR like YouTube.

function resolveQuality(label: string): { height: number; bandwidth: number } {
  const n = label.toUpperCase();
  const num = parseInt(n.match(/(\d{3,4})/)?.[1] ?? "0", 10);
  let height = num;
  if (!height) {
    if (n.includes("4K")) height = 2160;
    else if (n.includes("FHD") || n.includes("FULL")) height = 1080;
    else if (n.includes("HEVC")) height = 1080;
    else if (n.includes("HD")) height = 720;
    else if (n.includes("SD")) height = 480;
    else if (n.includes("RAW") || n.includes("50FPS")) height = 1080;
    else if (n.includes("DIRECT")) height = 720;
    else height = 720;
  }
  const bw: Record<number, number> = {
    2160: 12_000_000,
    1080: 5_000_000,
    720: 2_800_000,
    480: 1_400_000,
    360: 800_000,
    240: 400_000,
  };
  const bandwidth = bw[height] ?? Math.max(400_000, Math.round((height / 1080) * 5_000_000));
  return { height, bandwidth };
}

function proxify(url: string): string {
  return `/api/public/stream?url=${encodeURIComponent(url)}`;
}

export const Route = createFileRoute("/api/public/auratv-master")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, OPTIONS",
            "access-control-allow-headers": "*",
          },
        }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get("key") ?? "";
        if (!key) return new Response("missing key", { status: 400 });

        let streams: { quality: string; url: string }[] = [];
        try {
          streams = await getAuraChannelStreams({ data: { key } });
        } catch (e) {
          console.error("auratv-master fetch failed", e);
          return new Response("upstream error", { status: 502 });
        }
        if (!streams.length) return new Response("no streams", { status: 404 });

        const variants = streams
          .map((s) => ({ s, q: resolveQuality(s.quality) }))
          .sort((a, b) => a.q.bandwidth - b.q.bandwidth);

        const lines: string[] = ["#EXTM3U", "#EXT-X-VERSION:3"];
        for (const v of variants) {
          const width = Math.round((v.q.height * 16) / 9);
          lines.push(
            `#EXT-X-STREAM-INF:BANDWIDTH=${v.q.bandwidth},RESOLUTION=${width}x${v.q.height},NAME="${v.s.quality}"`,
          );
          lines.push(proxify(v.s.url));
        }

        return new Response(lines.join("\n") + "\n", {
          status: 200,
          headers: {
            "content-type": "application/vnd.apple.mpegurl",
            "access-control-allow-origin": "*",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
