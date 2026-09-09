// Resolution hints live in three places upstream: the stream label
// ("1080P"), the channel name ("beIN SPORTS 1 FHD") and the category name
// ("beIN SPORTS 720"). This module reads them all the same way so the master
// playlist, the channel tiles and the player agree on what "1080p" means.

const ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;
const MIN_HEIGHT = 144;
const MAX_HEIGHT = 4320;
// Bare numbers only count when they are a real rung, so "Sports 2024" is not
// read as a 2024-line stream. Anything with a p/i suffix is trusted as-is.
const KNOWN_RUNGS = new Set([144, 240, 288, 360, 480, 540, 576, 720, 1080, 1440, 2160, 4320]);

/**
 * Resolution rung named in a label, or 0 when the label carries none.
 * "1080P" / "beIN SPORTS 1080" -> 1080, "FHD" -> 1080, "HD" -> 720, "SD" -> 480.
 */
export function heightFromLabel(label: string | number | null | undefined): number {
  if (typeof label === "number") return Number.isInteger(label) && label >= MIN_HEIGHT && label <= MAX_HEIGHT ? label : 0;
  const text = (label || "").replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) & 0xf)).toUpperCase();
  if (!text) return 0;
  for (const match of text.matchAll(/(?<![0-9])(\d{3,4})\s*[PI](?![A-Z0-9])/g)) {
    const n = parseInt(match[1], 10);
    if (n >= MIN_HEIGHT && n <= MAX_HEIGHT) return n;
  }
  for (const match of text.matchAll(/(?<![0-9])(\d{3,4})(?![0-9])/g)) {
    const n = parseInt(match[1], 10);
    if (KNOWN_RUNGS.has(n)) return n;
  }
  if (/\b(4K|UHD)\b/.test(text)) return 2160;
  if (/\bFHD\b|FULL\s*HD|\bHEVC\b/.test(text)) return 1080;
  if (/\bHD\b/.test(text)) return 720;
  if (/\bSD\b/.test(text)) return 480;
  if (/\bLOW\b/.test(text)) return 240;
  return 0;
}

/** Rough bitrate for a rung, used for the BANDWIDTH attribute hls.js sorts by. */
export function bandwidthForHeight(height: number): number {
  if (height >= 2160) return 12_000_000;
  if (height >= 1440) return 8_000_000;
  if (height >= 1080) return 5_000_000;
  if (height >= 720) return 2_800_000;
  if (height >= 576) return 1_800_000;
  if (height >= 480) return 1_400_000;
  if (height >= 360) return 800_000;
  return 400_000;
}
