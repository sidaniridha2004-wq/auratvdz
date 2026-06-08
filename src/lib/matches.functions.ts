import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface Match {
  id: string;
  homeTeam: string;
  homeLogo: string;
  awayTeam: string;
  awayLogo: string;
  time: string;
  score: string;
  status: "live" | "soon" | "finished" | "unknown";
  statusLabel: string;
  channel: string;
  commentator: string;
  competition: string;
  url: string;
}

const PAGE_URLS = {
  today: "https://d.syrlive.com/matches-today",
  yesterday: "https://d.syrlive.com/matches-yesterday",
  tomorrow: "https://d.syrlive.com/matches-tomorrow",
  home: "https://d.syrlive.com/",
} as const;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).trim();
}

function attr(block: string, name: string): string {
  const re = new RegExp(`${name}=['"]([^'"]+)['"]`, "i");
  return block.match(re)?.[1] ?? "";
}

function pickImg(block: string): string {
  // syrlive uses data-src for lazy loading; fall back to src
  const m = block.match(/data-src=['"]([^'"]+)['"]/);
  if (m) return m[1];
  const s = block.match(/<img[^>]+src=['"]([^'"]+)['"]/);
  return s?.[1] ?? "";
}

function parseStatus(label: string, dateClass: string): Match["status"] {
  if (dateClass.includes("live") || label.includes("جارية")) return "live";
  if (dateClass.includes("finished") || label.includes("إنتهت") || label.includes("انتهت"))
    return "finished";
  if (dateClass.includes("soon") || label.includes("لم")) return "soon";
  return "unknown";
}

function parseMatches(html: string): Match[] {
  const containerRe =
    /<div\s+class=['"]match-container([^'"]*)['"][^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
  // The closing pattern above is loose; use a smarter approach: split by occurrences of match-container
  const parts = html.split(/<div\s+class=['"]match-container/);
  const matches: Match[] = [];
  for (let i = 1; i < parts.length; i++) {
    // Re-attach prefix so attrs parse, then take until the next match-container starts.
    const block = "class='match-container" + parts[i];
    const teamBlocks = [...block.matchAll(
      /<div\s+class=['"](right-team|left-team)[^'"]*['"][^>]*>([\s\S]*?)<\/div>\s*<\/div>/g,
    )];
    if (teamBlocks.length < 2) continue;
    const home = teamBlocks[0][2];
    const away = teamBlocks[1][2];
    const homeTeam = stripTags(home.match(/<div\s+class=['"]team-name['"][^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
    const awayTeam = stripTags(away.match(/<div\s+class=['"]team-name['"][^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
    const homeLogo = pickImg(home);
    const awayLogo = pickImg(away);

    const time = stripTags(
      block.match(/<div\s+class=['"]match-time['"][^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "",
    );
    const score = stripTags(block.match(/<div\s+class=['"]result['"][^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
    const dateMatch = block.match(/<div\s+class=['"]date([^'"]*)['"][^>]*>([\s\S]*?)<\/div>/);
    const dateClass = dateMatch?.[1] ?? "";
    const statusLabel = stripTags(dateMatch?.[2] ?? "");

    const infoItems = [...block.matchAll(
      /<li[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/li>/g,
    )].map((m) => stripTags(m[1]));
    const [channel = "", commentator = "", competition = ""] = infoItems;

    const url = block.match(/<a[^>]+href=['"]([^'"]+\/matches\/[^'"]+)['"]/)?.[1] ?? "";
    const id = url.split("/matches/")[1]?.replace(/\/$/, "") ?? `${homeTeam}-${awayTeam}-${i}`;

    if (!homeTeam || !awayTeam) continue;
    matches.push({
      id,
      homeTeam,
      homeLogo,
      awayTeam,
      awayLogo,
      time,
      score,
      status: parseStatus(statusLabel, dateClass),
      statusLabel,
      channel,
      commentator,
      competition,
      url,
    });
  }
  return matches;
}

async function fetchPage(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept-Language": "ar,en;q=0.8",
    },
  });
  if (!r.ok) throw new Error(`syrlive ${r.status}`);
  return r.text();
}

export const getMatches = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      day: z.enum(["today", "yesterday", "tomorrow", "home"]).default("today"),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const html = await fetchPage(PAGE_URLS[data.day]);
      return parseMatches(html);
    } catch (e) {
      console.error("getMatches failed", e);
      return [] as Match[];
    }
  });
