import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as cheerio from "cheerio";

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
  today: "https://live-internet-football.com/matches-today/",
  yesterday: "https://live-internet-football.com/matches-yesterday/",
  tomorrow: "https://live-internet-football.com/matches-tomorrow/",
  home: "https://live-internet-football.com/",
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
function pickImg(block: string): string {
  const m = block.match(/data-src=['"]([^'"]+)['"]/);
  if (m) return m[1];
  const s = block.match(/<img[^>]+src=['"]([^'"]+)['"]/);
  return s?.[1] ?? "";
}

function toAbsoluteUrl(src: string, baseUrl: string): string {
  const clean = decodeEntities(src).trim();
  if (!clean || clean.startsWith("data:")) return "";
  try {
    return new URL(clean, baseUrl).toString();
  } catch {
    return clean;
  }
}

function parseStatus(label: string, dateClass: string, score: string): Match["status"] {
  if (dateClass.includes("live") || label.includes("جارية") || label.includes("مباشر")) return "live";
  if (
    dateClass.includes("finished") ||
    label.includes("إنتهت") ||
    label.includes("انتهت") ||
    label.includes("انتهى") ||
    label.includes("منتهية")
  )
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
  const teamM = text.match(
    /([\u0600-\u06FF\w][\u0600-\u06FF\w \.'-]{2,40})\s+(?:vs|ضد|VS)\s+([\u0600-\u06FF\w][\u0600-\u06FF\w \.'-]{2,40})/,
  );
  if (teamM) {
    out.home = teamM[1].trim();
    out.away = teamM[2].trim();
  }
  return out;
}

function statusFromCode(code: string, cls: string): Match["status"] {
  const c = (code || "").toUpperCase();
  const k = (cls || "").toUpperCase();
  if (
    c === "LIVE" ||
    c === "1H" ||
    c === "2H" ||
    c === "HT" ||
    c === "ET" ||
    c === "P" ||
    c === "BT" ||
    k.includes("LIVE")
  )
    return "live";
  if (c === "FT" || c === "AET" || c === "PEN" || c === "END" || c === "AWD" || c === "WO" || k.includes("END"))
    return "finished";
  if (c === "NS" || c === "TBD" || k.includes("SOON") || k.includes("NOT")) return "soon";
  return "unknown";
}

function parseAyMatches(html: string, day: Day): Match[] {
  const matches: Match[] = [];
  const baseUrl = PAGE_URLS[day] ?? PAGE_URLS.home;
  const $ = cheerio.load(html);

  $('.AY_Match').each((idx: any, el: any) => {
    const $match = $(el);
    const $homeTeam = $match.find('.TM1');
    const $awayTeam = $match.find('.TM2');

    const homeTeam = $homeTeam.find('.TM_Name').text().trim() || $homeTeam.find('img').attr('alt')?.trim() || '';
    const awayTeam = $awayTeam.find('.TM_Name').text().trim() || $awayTeam.find('img').attr('alt')?.trim() || '';
    if (!homeTeam || !awayTeam) return;

    const pickImg = ($team: cheerio.Cheerio<cheerio.Element>) => {
      const $img = $team.find('img');
      return $img.attr('data-src') || $img.attr('src') || "";
    };

    const homeLogo = toAbsoluteUrl(pickImg($homeTeam), baseUrl);
    const awayLogo = toAbsoluteUrl(pickImg($awayTeam), baseUrl);

    const time = $match.find('.MT_Time').text().trim();
    
    // Score
    const goals = $match.find('.RS-goals').map((_: any, goalEl: any) => $(goalEl).text().trim()).get();
    const score = goals.length >= 2 ? `${goals[0]}-${goals[1]}` : "";

    const statusLabel = $match.find('.MT_Stat').text().trim();
    const classStr = $match.attr('class') || '';

    const infoItems = $match.find('.MT_Info li span').map((_: any, infoEl: any) => $(infoEl).text().trim()).get();
    const channel = infoItems[0] ?? "";
    const commentator = infoItems[1] ?? "";
    const competition = infoItems[2] ?? "";

    const $anchor = $match.find('a').first();
    const href = $anchor.attr('href') || "";
    const title = $anchor.attr('title') || "";
    
    const dateM = title.match(/بتاريخ\s*(\d{4}-\d{2}-\d{2})/);
    const date = dateM ? dateM[1] : null;
    const kickoffIso = date && time ? `${date}T${time}:00+03:00` : parseKickoff(time, day);

    matches.push({
      id: `${homeTeam}-${awayTeam}-${date ?? day}-${idx}`,
      homeTeam,
      homeLogo,
      awayTeam,
      awayLogo,
      time,
      kickoffIso,
      score,
      status: parseStatus(statusLabel, classStr, score),
      statusLabel,
      channel,
      commentator,
      competition,
      url: toAbsoluteUrl(href, baseUrl),
    });
  });
  return matches;
}

function parseMatches(html: string, day: Day): Match[] {
  const ayMatches = parseAyMatches(html, day);
  if (ayMatches.length > 0) return ayMatches;

  const matches: Match[] = [];
  const $ = cheerio.load(html);
  
  $('.STING-web-Match, [class*="STING-web-Match"]').each((idx: any, el: any) => {
    const $match = $(el);
    const $anchor = $match.find('a').first();
    
    const attr = (name: string) => $anchor.attr(name) || "";
    
    const homeTeam = attr("data-home") || $match.find('.STING-web-Right-Team .STING-web-Team-NAME').text().trim();
    const awayTeam = attr("data-away") || $match.find('.STING-web-Left-Team .STING-web-Team-NAME').text().trim();
    if (!homeTeam || !awayTeam) return;

    const competition = attr("data-league") || $match.find('.STING-web-Match-Info').text().trim();
    const startIso = attr("data-start");

    const $logos = $match.find('.STING-web-Team-Logo img');
    const getLogo = (index: number) => {
      const $img = $logos.eq(index);
      return $img.attr('data-img') || $img.attr('data-src') || $img.attr('src') || "";
    };
    const homeLogo = getLogo(0);
    const awayLogo = getLogo(1);

    const score = $match.find('#STING-web-Result, .STING-web-Result').text().trim();
    const timeLabel = $match.find('#STING-web-Match-Time, .STING-web-Match-Time').text().trim();
    const statusCode = $match.attr('data-status-code') || "";
    const classStr = $match.attr('class') || "";

    let time = timeLabel;
    if (startIso) {
      const dt = new Date(startIso);
      if (!isNaN(dt.getTime())) {
        const dam = new Date(dt.getTime() + SOURCE_TZ_OFFSET_HOURS * 3600_000);
        const hh = String(dam.getUTCHours()).padStart(2, "0");
        const mm2 = String(dam.getUTCMinutes()).padStart(2, "0");
        time = `${hh}:${mm2}`;
      }
    }

    const status = statusFromCode(statusCode, classStr);
    const fixtureIdAttr = $match.attr('id') || "";
    const id = fixtureIdAttr || `${homeTeam}-${awayTeam}-${idx}`;

    matches.push({
      id,
      homeTeam,
      homeLogo,
      awayTeam,
      awayLogo,
      time,
      kickoffIso: startIso || parseKickoff(time, day),
      score,
      status,
      statusLabel: timeLabel,
      channel: "",
      commentator: "",
      competition,
      url: "",
    });
  });
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
  .inputValidator(z.object({ day: z.enum(["today", "yesterday", "tomorrow", "home"]).default("today") }))
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
