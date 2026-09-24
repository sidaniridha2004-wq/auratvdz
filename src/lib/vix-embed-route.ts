import type { StreamResolution } from "./media.functions";

/** Replace VixSrc's public title page with a fresh tokenized embed redirect. */
export function withVixEmbedRoute(
  stream: StreamResolution,
  input: { kind: "movie" | "tv"; id: number; season?: number; episode?: number },
): StreamResolution {
  const params = new URLSearchParams({ kind: input.kind, id: String(input.id) });
  if (input.kind === "tv") {
    params.set("season", String(input.season ?? 1));
    params.set("episode", String(input.episode ?? 1));
  }
  const embed = "/api/public/vix-embed?" + params.toString();
  const servers = stream.servers.map((server) =>
    server.id === "vixsrc" ? { ...server, kind: "embed" as const, embed } : server,
  );

  // Upstream catalogue lists can lag behind VixSrc's live JSON API. The API
  // may have a working player even when sourcesFor() did not include Vix, so
  // inject the tokenized route instead of silently falling back to VidLink.
  if (!servers.some((server) => server.id === "vixsrc")) {
    servers.unshift({ id: "vixsrc", name: "Server 2 · Vix", kind: "embed", embed });
  }
  servers.sort((a, b) => (a.id === "vixsrc" ? -1 : b.id === "vixsrc" ? 1 : 0));
  return { ...stream, servers };
}
