import { createFileRoute } from "@tanstack/react-router";
import { getAuraChannelStreams } from "@/lib/auratv-channels.functions";
import { signedProxyUrl } from "@/lib/stream-sign.server";

// HLS master playlist for a legacy AuraTV manifest key. Variants are signed
// proxy URLs (see stream-sign.server.ts).

function resolveQuality(label: string): { height: number; bandwidth: number } {
  const n = (label || "").toUpperCase();
  const num = parseInt(n.match(/(\d{3,4})/)?.[1] ?? "0", 10);
  let height = num;
  if (!height) {
    if (n.includes("4K")) height = 2160;
    else if (n.includes("FHD") || n.includes("FULL") || n.includes("HEVC") || n.includes("RAW") || n.includes("50FPS")) height = 1080;
    else if (n.includes("HD") || n.includes("DIRECT")) height = 720;
    else if (n.includes("SD")) height = 480;
    else height = 720;
  }
  const bw: Record<number, number> = { 2160: 12_000_000, 1080: 5_000_000, 720: 2_800_000, 480: 1_400_000, 360: 800_000, 240: 400_000 };
  return { height, bandwidth: bw[height] ?? Math.max(400_000, Math.round((height / 1080) * 5_000_000)) };
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
            "access-control-allow-headers": "range",
          },
        }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = (url.searchParams.get("key") ?? "").trim();
        if (!key || key.length > 80 || !/^[a-z0-9_.-]+$/i.test(key)) {
          return new Response("missing key", { status: 400 });
        }

        let streams: { quality: string; url: string }[] = [];
        try {
          streams = await getAuraChannelStreams({ data: { key } });
        } catch {
          return new Response("upstream error", { status: 502 });
        }
        if (!streams.length) return new Response("no streams", { status: 404 });

        const variants = streams
          .filter((s) => /^https?:\/\//i.test(s.url))
          .map((s) => ({ s, q: resolveQuality(s.quality) }))
          .sort((a, b) => a.q.bandwidth - b.q.bandwidth);

        const lines: string[] = ["#EXTM3U", "#EXT-X-VERSION:3"];
        for (const v of variants) {
          const width = Math.round((v.q.height * 16) / 9);
          const name = (v.s.quality || `${v.q.height}p`).replace(/["\r\n]/g, "").slice(0, 40);
          lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${v.q.bandwidth},RESOLUTION=${width}x${v.q.height},NAME="${name}"`);
          lines.push(await signedProxyUrl({ url: v.s.url }));
        }

        return new Response(lines.join("\n") + "\n", {
          status: 200,
          headers: {
            "content-type": "application/vnd.apple.mpegurl",
            "access-control-allow-origin": "*",
            "cache-control": "private, max-age=20",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
