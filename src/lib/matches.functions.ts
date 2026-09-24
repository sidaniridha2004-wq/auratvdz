import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchYacineDirectory, fetchYacineEvents } from "./yacine-api.server";
import { discoverYacineConfig } from "./yacine-discovery.server";
import { normaliseChannelName } from "./match-channel";

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
  /** Current rotating Yacine channel id, resolved alongside the event feed. */
  channelId?: string;
  channelLogo?: string;
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

const safeLogo = (raw: unknown): string => (typeof raw === "string" && /^https:\/\//i.test(raw) ? raw : "");

export const getMatches = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      day: z.enum(["today", "yesterday", "tomorrow", "home"]).default("today"),
    }),
  )
  .handler(async ({ data }) => {
    try {
      await discoverYacineConfig();
      // Resolve the schedule and directory in the same request. The previous
      // client-side join could use a different host/cache generation, leaving
      // event-only groups such as ALKASS marked "No stream" even though the
      // current directory already contained a playable rotating channel id.
      const [events, directory] = await Promise.all([
        fetchYacineEvents(),
        fetchYacineDirectory().catch(() => null),
      ]);
      const wanted = targetDateKey(data.day === "home" ? "today" : data.day);
      const channelByName = new Map<string, { id: string; logo: string }>();
      for (const channel of directory?.channels ?? []) {
        const key = normaliseChannelName(channel.name);
        if (key && !channelByName.has(key)) channelByName.set(key, { id: channel.id, logo: channel.logo });
      }

      return events
        .filter((event) => dateKey(event.startTime * 1000) === wanted)
        .map((event): Match => {
          const status = statusFor(event.startTime, event.endTime);
          const resolved = channelByName.get(normaliseChannelName(event.channel));
          return {
            id: `yacine-event-${event.id}`,
            homeTeam: event.home.name,
            homeLogo: safeLogo(event.home.logo),
            awayTeam: event.away.name,
            awayLogo: safeLogo(event.away.logo),
            time: new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(
              new Date(event.startTime * 1000),
            ),
            kickoffIso: new Date(event.startTime * 1000).toISOString(),
            score: "",
            status,
            statusLabel: statusLabelFor(status),
            channel: event.channel,
            channelId: resolved?.id,
            channelLogo: safeLogo(resolved?.logo),
            commentator: event.commentary,
            competition: event.competition,
            url: "",
          };
        });
    } catch {
      return [] as Match[];
    }
  });
