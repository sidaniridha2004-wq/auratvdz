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
  const servers = stream.servers
    .map((server) => (server.id === "vixsrc" ? { ...server, kind: "embed" as const, embed } : server))
    .sort((a, b) => (a.id === "vixsrc" ? -1 : b.id === "vixsrc" ? 1 : 0));
  return { ...stream, servers };
}
