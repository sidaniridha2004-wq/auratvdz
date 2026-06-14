import { createFileRoute } from "@tanstack/react-router";
import { getYacineConfig } from "@/lib/yacine-config.server";

// Builds a single HLS master playlist that references every quality variant
// returned by YacineTV as a separate stream. hls.js then performs adaptive
// bitrate switching automatically (YouTube-style), choosing the best quality
// for the viewer's bandwidth and falling back when the connection drops.

function decrypt(enc: string, key: string): string {
  const bin = atob(enc.trim());
  let out = "";
  for (let i = 0; i < bin.length; i++) {
    out += String.fromCharCode(bin.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

interface StreamLink {
  name: string;
  url: string;
  referer: string;
  user_agent: string;
}

async function fetchStreams(channelId: number): Promise<StreamLink[]> {
  const { apiUrl, decryptKey } = getYacineConfig();
  const r = await fetch(`${apiUrl}/api/channel/${channelId}`);
  const ts = r.headers.get("t") ?? String(Math.floor(Date.now() / 1000));
  const text = await r.text();
  const json = JSON.parse(decrypt(text, decryptKey + ts)) as { data: StreamLink[] };
  return json.data ?? [];
}

// Map a quality label (e.g. "1080P", "720", "FHD") to a rough resolution +
// bandwidth so hls.js has good ABR signal.
function resolveQuality(name: string): { height: number; bandwidth: number; label: string } {
  const n = (name || "").toUpperCase();
  const num = parseInt(n.match(/(\d{3,4})/)?.[1] ?? "0", 10);
  let height = num;
  if (!height) {
    if (n.includes("FHD") || n.includes("FULL")) height = 1080;
    else if (n.includes("HD")) height = 720;
    else if (n.includes("SD")) height = 480;
    else if (n.includes("LOW")) height = 240;
    else height = 720;
  }
  const map: Record<number, number> = {
    1080: 5_000_000,
    720: 2_800_000,
    480: 1_400_000,
    360: 800_000,
    240: 400_000,
  };
  const bandwidth =
    map[height] ?? Math.max(300_000, Math.round((height / 1080) * 5_000_000));
  const width = Math.round((height * 16) / 9);
  return { height, bandwidth, label: `${height}p (${width}x${height})` };
}

function buildProxyUrl(url: string, referer: string, ua: string) {
  const params = new URLSearchParams({ url });
  if (referer) params.set("referer", referer);
  if (ua) params.set("ua", ua);
  return `/api/public/stream?${params.toString()}`;
}

export const Route = createFileRoute("/api/public/master")({
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
        const channelId = Number(url.searchParams.get("channelId"));
        if (!Number.isFinite(channelId)) {
          return new Response("missing channelId", { status: 400 });
        }

        let streams: StreamLink[] = [];
        try {
          streams = await fetchStreams(channelId);
        } catch (e) {
          console.error("master: fetchStreams failed", e);
          return new Response("upstream error", { status: 502 });
        }

        if (!streams.length) {
          return new Response("no streams", { status: 404 });
        }

        // Sort low→high so hls.js starts conservative and steps up
        const variants = streams
          .map((s, i) => ({ s, i, q: resolveQuality(s.name) }))
          .sort((a, b) => a.q.bandwidth - b.q.bandwidth);

        const lines: string[] = ["#EXTM3U", "#EXT-X-VERSION:3"];
        for (const v of variants) {
          const width = Math.round((v.q.height * 16) / 9);
          lines.push(
            `#EXT-X-STREAM-INF:BANDWIDTH=${v.q.bandwidth},RESOLUTION=${width}x${v.q.height},NAME="${v.s.name || `${v.q.height}p`}"`,
          );
          lines.push(buildProxyUrl(v.s.url, v.s.referer ?? "", v.s.user_agent ?? ""));
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
