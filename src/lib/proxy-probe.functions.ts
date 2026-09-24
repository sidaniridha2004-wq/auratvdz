import { createServerFn } from "@tanstack/react-start";
import { normaliseChannelName } from "./match-channel";

export const probeAuraProxy = createServerFn({ method: "GET" }).handler(async () => {
  const { discoverYacineConfig } = await import("./yacine-discovery.server");
  const { fetchYacineDirectory } = await import("./yacine-api.server");
  await discoverYacineConfig();
  const directory = await fetchYacineDirectory();
  const channel = directory.channels.find((c) => normaliseChannelName(c.name) === normaliseChannelName("Alkass 1"));
  if (!channel) return { error: "channel missing" };
  const origin = "https://auratvdz.vercel.app";
  const masterUrl = `${origin}/api/public/master?channelId=${channel.id}&name=${encodeURIComponent(channel.name)}`;
  try {
    const master = await fetch(masterUrl, { cache: "no-store" });
    const masterText = await master.text();
    const childRaw = masterText.split(/\r?\n/).find((line) => line.trim() && !line.startsWith("#"));
    if (!childRaw) return { channel, masterStatus: master.status, masterStart: masterText.slice(0, 200), error: "no child" };
    const childUrl = new URL(childRaw, origin).toString();
    const child = await fetch(childUrl, { cache: "no-store" });
    const childText = await child.text();
    const segmentRaw = childText.split(/\r?\n/).find((line) => line.trim() && !line.startsWith("#"));
    let segment = null;
    if (segmentRaw) {
      const segmentResponse = await fetch(new URL(segmentRaw, origin), { headers: { range: "bytes=0-1023" }, cache: "no-store" });
      segment = { status: segmentResponse.status, type: segmentResponse.headers.get("content-type"), length: segmentResponse.headers.get("content-length") };
      await segmentResponse.body?.cancel();
    }
    return {
      channel,
      masterStatus: master.status,
      masterType: master.headers.get("content-type"),
      masterM3u: masterText.trimStart().startsWith("#EXTM3U"),
      childStatus: child.status,
      childType: child.headers.get("content-type"),
      childM3u: childText.trimStart().startsWith("#EXTM3U"),
      childStart: childText.slice(0, 160),
      segment,
    };
  } catch (error) {
    return { channel, error: error instanceof Error ? `${error.name}: ${error.message}` : "error" };
  }
});
