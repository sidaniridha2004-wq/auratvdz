// Extra embed-only stream servers (server only).
//
// YapGrid and NHD publish no availability lists, so they are always offered
// as fallbacks. The internal function names stay stable because their IDs are
// already used in saved URLs and player preferences.

import type { MediaKind } from "./tmdb.server";

/** Server 3: YapGrid — responsive multi-server player with synced subtitles. */
export function multiembedUrl(kind: MediaKind, id: number, season?: number, episode?: number): string {
  const path = kind === "movie" ? `/embed/movie/${id}` : `/embed/tv/${id}/${season ?? 1}/${episode ?? 1}`;
  const url = new URL("https://yapgrid.com" + path);
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("lang", "ar");
  return url.toString();
}

/** Server 4: NHD — automatic source failover, audio tracks and 20+ subtitle languages. */
export function vidfastUrl(kind: MediaKind, id: number, opts: { season?: number; episode?: number; startAt?: number } = {}): string {
  const path = kind === "movie" ? `/movie/${id}` : `/tv/${id}/${opts.season ?? 1}/${opts.episode ?? 1}`;
  return new URL("https://nhdapi.com" + path).toString();
}
