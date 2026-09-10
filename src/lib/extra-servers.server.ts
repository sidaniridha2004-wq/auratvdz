// Extra embed-only stream servers (server only).
//
// MultiEmbed and VidFast publish no availability lists, so they are always
// offered as fallbacks after Server 1/Server 2 and the player finds out at
// play time whether they carry the title.

import type { MediaKind } from "./tmdb.server";

export function multiembedUrl(kind: MediaKind, id: number, season?: number, episode?: number): string {
  return kind === "movie"
    ? `https://multiembed.cc/embed/movie/${id}`
    : `https://multiembed.cc/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;
}

export function vidfastUrl(kind: MediaKind, id: number, opts: { season?: number; episode?: number; startAt?: number } = {}): string {
  const path = kind === "movie" ? `/movie/${id}` : `/tv/${id}/${opts.season ?? 1}/${opts.episode ?? 1}`;
  const url = new URL("https://vidfast.vc" + path);
  url.searchParams.set("autoPlay", "true");
  url.searchParams.set("theme", "d9272f");
  url.searchParams.set("sub", "ar");
  if (opts.startAt && opts.startAt > 0) url.searchParams.set("startAt", String(Math.floor(opts.startAt)));
  return url.toString();
}
