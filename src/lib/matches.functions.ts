import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchYacineEvents } from "./yacine-api.server";
import { discoverYacineConfig } from "./yacine-discovery.server";

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

const TZ = "Africa/Algiers";

const dateKey = (timestamp: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));

const targetDateKey = (day: Day) => {
  const offset = day === "yesterday" ? -1 : day === "tomorrow" ? 1 : 0;
  return dateKey(Date.now() + offset * 86_400_000);
};

const statusFor = (start: number, end: number): Match["status"] => {
  const now = Math.floor(Date.now() / 1000);
  if (now < start) return "soon";
  if (!end || now <= end) return "live";
  return "finished";
};

const statusLabelFor = (status: Match["status"]) => {
  if (status === "live") return "Live";
  if (status === "soon") return "Upcoming";
  if (status === "finished") return "Finished";
  return "";
};

// Only http(s) logos from upstream feeds are passed to the browser.
const safeLogo = (raw: unknown): string => (typeof raw === "string" && /^https:\/\//i.test(raw) ? raw : "");

async function fallbackMatches(day: Day): Promise<Match[]> {
  const wanted = targetDateKey(day === "home" ? "today" : day);
  const response = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${wanted}&s=Soccer`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`schedule fallback ${response.status}`);
  const body = (await response.json()) as { events?: Array<Record<string, unknown>> };
  const now = Date.now();

  return (body.events ?? []).flatMap((event): Match[] => {
    const kickoffRaw = typeof event.strTimestamp === "string" && event.strTimestamp ? event.strTimestamp : `${event.dateEvent ?? wanted}T${event.strTime ?? "00:00:00"}Z`;
    const kickoff = new Date(kickoffRaw);
    if (!Number.isFinite(kickoff.getTime())) return [];
    const home = String(event.strHomeTeam ?? "").trim();
    const away = String(event.strAwayTeam ?? "").trim();
    if (!home || !away) return [];
    const statusText = String(event.strStatus ?? event.strProgress ?? "").toLowerCase();
    const finished = /finish|cancel|postpon|abandon/.test(statusText);
    const live = !finished && kickoff.getTime() <= now && kickoff.getTime() + 3_600_000 >= now;
    const status: Match["status"] = finished || kickoff.getTime() + 3_600_000 < now ? "finished" : live ? "live" : "soon";
    const homeScore = event.intHomeScore == null ? "" : String(event.intHomeScore);
    const awayScore = event.intAwayScore == null ? "" : String(event.intAwayScore);
    return [{
      id: `sportsdb-${String(event.idEvent ?? `${home}-${away}-${kickoff.toISOString()}`)}`,
      homeTeam: home,
      homeLogo: safeLogo(event.strHomeTeamBadge),
      awayTeam: away,
      awayLogo: safeLogo(event.strAwayTeamBadge),
      time: new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(kickoff),
      kickoffIso: kickoff.toISOString(),
      score: homeScore || awayScore ? `${homeScore} – ${awayScore}` : "",
      status,
      statusLabel: statusLabelFor(status),
      channel: "",
      commentator: "",
      competition: String(event.strLeague ?? "Football"),
      url: "",
    }];
  }).sort((a, b) => (a.kickoffIso ?? "").localeCompare(b.kickoffIso ?? ""));
}

export const getMatches = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      day: z.enum(["today", "yesterday", "tomorrow", "home"]).default("today"),
    }),
  )
  .handler(async ({ data }) => {
    try {
      await discoverYacineConfig();
      const events = await fetchYacineEvents();
      const wanted = targetDateKey(data.day === "home" ? "today" : data.day);
      const matches = events
        .filter((event) => dateKey(event.startTime * 1000) === wanted)
        .map((event): Match => {
          const status = statusFor(event.startTime, event.endTime);
          return {
            id: `yacine-event-${event.id}`,
            homeTeam: event.home.name,
            homeLogo: safeLogo(event.home.logo),
            awayTeam: event.away.name,
            awayLogo: safeLogo(event.away.logo),
            time: new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(event.startTime * 1000)),
            kickoffIso: new Date(event.startTime * 1000).toISOString(),
            score: "",
            status,
            statusLabel: statusLabelFor(status),
            channel: event.channel,
            commentator: event.commentary,
            competition: event.competition,
            url: "",
          };
        });
      return matches.length > 0 ? matches : await fallbackMatches(data.day);
    } catch {
      try {
        return await fallbackMatches(data.day);
      } catch {
        return [] as Match[];
      }
    }
  });
