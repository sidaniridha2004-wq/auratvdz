import type { M3uChannel } from "./m3u-channels";

/**
 * The events feed only names the broadcasting channel ("beIN SPORTS 2",
 * "بين سبورت ماكس 3"), while the channel directory carries the playable ids.
 * This module bridges the two by normalising both sides to a comparable form.
 */

const ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;

const WORD_MAP: Array<[RegExp, string]> = [
  [/\u0628\u064a\u0646/g, "bein"], // بين
  [/\u0633\u0628\u0648\u0631\u062a\u0633?/g, "sports"], // سبورت / سبورتس
  [/\u0645\u0627\u0643\u0633/g, "max"], // ماكس
  [/\u0625\u0643\u0633\u062a\u0631\u0627|\u0627\u0643\u0633\u062a\u0631\u0627/g, "xtra"], // إكسترا
  [/\u0646\u064a\u0648\u0632/g, "news"],
  // Resolution suffixes ("beIN SPORTS 1 1080", "MBC 720p") are not part of
  // the channel identity; strip them before the trailing number is compared.
  [/\b(2160|1440|1080|720|576|480|360|240|144)p?\b/g, ""],
  [/hd|sd|fhd|uhd|4k/g, ""],
];

export function normaliseChannelName(raw: string): string {
  let value = (raw || "")
    .toLowerCase()
    .replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) & 0xf))
    .replace(/[\u064b-\u0652\u0670]/g, "") // harakat
    .replace(/[\u0623\u0625\u0622]/g, "\u0627")
    .replace(/\u0649/g, "\u064a")
    .replace(/\u0629/g, "\u0647");
  for (const [pattern, replacement] of WORD_MAP) value = value.replace(pattern, replacement);
  return value.replace(/[^a-z0-9]+/g, " ").trim();
}

const trailingNumber = (value: string) => /(?:^|\s)(\d+)$/.exec(value)?.[1] ?? "";

/** Higher is better: 1080p feeds first, then 720p, then anything else. */
function qualityRank(group: string): number {
  const g = group.toLowerCase();
  if (g.includes("1080")) return 3;
  if (g.includes("720")) return 2;
  if (g.includes("360")) return 1;
  return 0;
}

/**
 * Finds the directory channel a fixture is broadcast on.
 * Returns null when nothing matches confidently, so the card stays unlinked
 * rather than sending a viewer to the wrong feed.
 */
export function findChannelForMatch(
  channelName: string,
  channels: Iterable<M3uChannel>,
): M3uChannel | null {
  const wanted = normaliseChannelName(channelName);
  if (!wanted) return null;
  const wantedNumber = trailingNumber(wanted);

  let best: { channel: M3uChannel; score: number; quality: number } | null = null;

  for (const channel of channels) {
    const candidate = normaliseChannelName(channel.name);
    if (!candidate) continue;
    const candidateNumber = trailingNumber(candidate);

    // A numbered feed must match its number exactly (beIN 2 is not beIN 3).
    if ((wantedNumber || candidateNumber) && wantedNumber !== candidateNumber) continue;

    let score = 0;
    if (candidate === wanted) score = 100;
    else if (candidate.startsWith(wanted) || wanted.startsWith(candidate)) score = 70;
    else if (candidate.includes(wanted) || wanted.includes(candidate)) score = 50;
    else continue;

    const quality = qualityRank(channel.group);
    if (!best || score > best.score || (score === best.score && quality > best.quality)) {
      best = { channel, score, quality };
    }
  }

  return best?.channel ?? null;
}

/** Numeric Yacine id behind a `yacine-<id>` slug, when present. */
export function yacineIdFromSlug(slug: string): number | null {
  const id = /^yacine-(\d+)$/.exec(slug)?.[1];
  return id ? Number(id) : null;
}
