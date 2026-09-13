// Extra embed-only stream servers (server only).
//
// YapGrid and Vidzy publish no availability lists, so they are always offered
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

/** Server 4: Vidzy — VF French audio, VOSTFR and subtitle controls. */
export function vidfastUrl(kind: MediaKind, id: number, opts: { season?: number; episode?: number; startAt?: number } = {}): string {
  const path = kind === "movie" ? `/movie/${id}` : `/serie/${id}/${opts.season ?? 1}/${opts.episode ?? 1}`;
  const url = new URL("https://vidzy.org" + path);
  url.searchParams.set("lang", "vf");
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("color", "d9272f");
  if (kind === "tv") url.searchParams.set("autonext", "1");
  return url.toString();
}
