import type { StreamResolution } from "./media.functions";

/** Keep Vix available without moving it ahead of the primary Link server. */
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
  const vixKind = stream.direct.ok ? "direct" as const : "embed" as const;
  const servers = stream.servers.map((server) =>
    server.id === "vixsrc" ? { ...server, kind: vixKind, embed } : server,
  );

  if (!servers.some((server) => server.id === "vixsrc")) {
    const vix = { id: "vixsrc" as const, name: "Server 2 · Vix", kind: vixKind, embed };
    const linkIndex = servers.findIndex((server) => server.id === "vidapi");
    servers.splice(linkIndex >= 0 ? linkIndex + 1 : 0, 0, vix);
  }
  return { ...stream, servers };
}
