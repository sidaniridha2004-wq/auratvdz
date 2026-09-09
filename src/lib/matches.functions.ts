import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchYacineEvents } from "./yacine-api.server";

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

const dateKey = (timestamp: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));

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

export const getMatches = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      day: z.enum(["today", "yesterday", "tomorrow", "home"]).default("today"),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const events = await fetchYacineEvents();
      const wanted = targetDateKey(data.day === "home" ? "today" : data.day);

      return events
        .filter((event) => dateKey(event.startTime * 1000) === wanted)
        .map((event): Match => {
          const status = statusFor(event.startTime, event.endTime);
          return {
            id: `yacine-event-${event.id}`,
            homeTeam: event.home.name,
            homeLogo: event.home.logo,
            awayTeam: event.away.name,
            awayLogo: event.away.logo,
            time: new Intl.DateTimeFormat("en-GB", {
              timeZone: "Africa/Algiers",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }).format(new Date(event.startTime * 1000)),
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
    } catch (error) {
      console.error("getMatches failed", error);
      return [] as Match[];
    }
  });
