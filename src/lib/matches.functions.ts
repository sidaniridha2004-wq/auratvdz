import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface Match {
  id: string;
  homeTeam: string;
  homeLogo: string;
  awayTeam: string;
  awayLogo: string;
  time: string;
  kickoffIso: string | null;
  score: string;
  status: "live" | "soon" | "finished" | "unknown";
  statusLabel: string;
  channel: string;
  commentator: string;
  competition: string;
  url: string;
}

type Day = "today" | "yesterday" | "tomorrow" | "home";

const SOURCE_TZ_OFFSET_HOURS = 3;

function damascusDateParts(day: Day): { y: number; m: number; d: number } {
  const nowDam = new Date(Date.now() + SOURCE_TZ_OFFSET_HOURS * 3600_000);
  const offset = day === "yesterday" ? -1 : day === "tomorrow" ? 1 : 0;
  nowDam.setUTCDate(nowDam.getUTCDate() + offset);
  return {
    y: nowDam.getUTCFullYear(),
    m: nowDam.getUTCMonth() + 1,
    d: nowDam.getUTCDate(),
  };
}

function parseKickoff(time: string, day: Day): string | null {
  const m = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const ap = m[3]?.toUpperCase();
  if (ap === "PM" && hh < 12) hh += 12;
  if (ap === "AM" && hh === 12) hh = 0;
  const { y, m: mo, d } = damascusDateParts(day);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(mo)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00+03:00`;
}

const PAGE_URLS = {
  today: "https://d.syrlive.com/matches-today",
  yesterday: "https://d.syrlive.com/matches-yesterday",
  tomorrow: "https://d.syrlive.com/matches-tomorrow",
  home: "https://d.syrlive.com/",
} as const;

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ");
}
function stripTags(s: string): string { return decodeEntities(s.replace(/<[^>]+>/g, "")).trim(); }
function pickImg(block: string): string {
  const m = block.match(/data-src=['"]([^'"]+)['"]/);
  if (m) return m[1];
  const s = block.match(/<img[^>]+src=['"]([^'"]+)['"]/);
  return s?.[1] ?? "";
}

function parseStatus(label: string, dateClass: string, score: string): Match["status"] {
  if (dateClass.includes("live") || label.includes("جارية") || label.includes("مباشر")) return "live";
  if (dateClass.includes("finished") || label.includes("إنتهت") || label.includes("انتهت") || label.includes("انتهى") || label.includes("منتهية"))
    return "finished";
  if (dateClass.includes("soon") || label.includes("لم") || label.includes("قريب") || label.includes("قادم"))
    return "soon";
  if (score && /\d+\s*-\s*\d+/.test(score) && score.replace(/\s/g, "") !== "0-0") return "finished";
  return "unknown";
}

/**
 * Fallback: if the primary block parser missed team names or score,
 * try a plain-text regex sweep of the raw block. Handles minor markup
 * changes on the source site.
 */
function fallbackTextParse(block: string): { home?: string; away?: string; score?: string } {
  const text = stripTags(block).replace(/\s+/g, " ").trim();
  const out: { home?: string; away?: string; score?: string } = {};
  // Score patterns: "1 - 2", "1-2", "١ - ٢"
  const scoreM = text.match(/(\d+)\s*[-–:]\s*(\d+)/);
  if (scoreM) out.score = `${scoreM[1]}-${scoreM[2]}`;
  // Names on either side of "vs" or "ضد"
  const teamM = text.match(/([\u0600-\u06FF\w][\u0600-\u06FF\w \.'-]{2,40})\s+(?:vs|ضد|VS)\s+([\u0600-\u06FF\w][\u0600-\u06FF\w \.'-]{2,40})/);
  if (teamM) { out.home = teamM[1].trim(); out.away = teamM[2].trim(); }
  return out;
}

function parseMatches(html: string, day: Day): Match[] {
  const parts = html.split(/<div\s+class=['"]match-container/);
  const matches: Match[] = [];
  for (let i = 1; i < parts.length; i++) {
    const raw = parts[i];
    const endIdx = raw.search(/<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/);
    const block = endIdx > 0 ? raw.slice(0, endIdx) : raw;

    const classStr = block.match(/^\s*([^'">]*)/)?.[1] ?? "";

    const teamLogos = [...block.matchAll(/<div\s+class=['"]team-logo[^'"]*['"][^>]*>([\s\S]*?)<\/div>/g)].map((m) => pickImg(m[1]));
    const teamNames = [...block.matchAll(/<div\s+class=['"]team-name['"][^>]*>([\s\S]*?)<\/div>/g)].map((m) => stripTags(m[1]));
    let homeTeam = teamNames[0] ?? "";
    let awayTeam = teamNames[1] ?? "";
    const homeLogo = teamLogos[0] ?? "";
    const awayLogo = teamLogos[1] ?? "";

    const time = stripTags(block.match(/<div\s+class=['"]match-time['"][^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
    let score = stripTags(block.match(/<div\s+class=['"]result['"][^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
    const dateMatch = block.match(/<div\s+class=['"]date([^'"]*)['"][^>]*>([\s\S]*?)<\/div>/);
    const statusLabel = stripTags(dateMatch?.[2] ?? "");

    // Fallback secondary selectors
    if (!homeTeam || !awayTeam || !score) {
      const fb = fallbackTextParse(block);
      if (!homeTeam && fb.home) homeTeam = fb.home;
      if (!awayTeam && fb.away) awayTeam = fb.away;
      if (!score && fb.score) score = fb.score;
    }
    // Alt score selector
    if (!score) {
      score = stripTags(block.match(/<div\s+class=['"]match-score[^'"]*['"][^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
    }

    const infoItems = [...block.matchAll(/<li[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/li>/g)].map((m) => stripTags(m[1]));
    const [channel = "", commentator = "", competition = ""] = infoItems;

    const url = block.match(/<a[^>]+href=['"]([^'"]+\/matches\/[^'"]+)['"]/)?.[1] ?? "";
    const id = url.split("/matches/")[1]?.replace(/\/$/, "") ?? `${homeTeam}-${awayTeam}-${i}`;

    if (!homeTeam || !awayTeam) continue;
    matches.push({
      id, homeTeam, homeLogo, awayTeam, awayLogo,
      time, kickoffIso: parseKickoff(time, day), score,
      status: parseStatus(statusLabel, classStr, score),
      statusLabel, channel, commentator, competition, url,
    });
  }
  return matches;
}

async function fetchPage(url: string, attempt = 0): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "ar,en;q=0.8",
      },
    });
    if (!r.ok) throw new Error(`syrlive ${r.status}`);
    return await r.text();
  } catch (e) {
    if (attempt < 2) {
      await new Promise((res) => setTimeout(res, 400 * (attempt + 1)));
      return fetchPage(url, attempt + 1);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const getMatches = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ day: z.enum(["today", "yesterday", "tomorrow", "home"]).default("today") }),
  )
  .handler(async ({ data }) => {
    try {
      const html = await fetchPage(PAGE_URLS[data.day]);
      const primary = parseMatches(html, data.day);
      // If primary parse gave nothing but the page loaded, try home fallback
      if (primary.length === 0 && data.day === "today") {
        try {
          const fallbackHtml = await fetchPage(PAGE_URLS.home);
          const fromHome = parseMatches(fallbackHtml, "today");
          if (fromHome.length > 0) return fromHome;
        } catch {}
      }
      return primary;
    } catch (e) {
      console.error("getMatches failed", e);
      return [] as Match[];
    }
  });
