import { Link } from "@tanstack/react-router";
import { Play, Tv } from "lucide-react";
import type { Match } from "@/lib/matches.functions";

// Loose mapping of common Arabic channel names to YacineTV channel IDs so
// "Watch on beIN SPORTS 1" deep-links to the live player.
const CHANNEL_MAP: { match: RegExp; id: number; label: string }[] = [
  { match: /بي\s*إن\s*سبورت\s*1\b/, id: 1424, label: "beIN SPORTS 1" },
  { match: /بي\s*إن\s*سبورت\s*2\b/, id: 1425, label: "beIN SPORTS 2" },
  { match: /بي\s*إن\s*سبورت\s*3\b/, id: 1426, label: "beIN SPORTS 3" },
  { match: /بي\s*إن\s*سبورت\s*4\b/, id: 1427, label: "beIN SPORTS 4" },
  { match: /بي\s*إن\s*سبورت\s*5\b/, id: 1428, label: "beIN SPORTS 5" },
  { match: /بي\s*إن\s*سبورت\s*6\b/, id: 1429, label: "beIN SPORTS 6" },
  { match: /بي\s*إن\s*سبورت\s*7\b/, id: 1430, label: "beIN SPORTS 7" },
];

function resolveChannel(name: string): { id: number; label: string } | null {
  for (const c of CHANNEL_MAP) if (c.match.test(name)) return { id: c.id, label: c.label };
  return null;
}

function statusBadge(m: Match) {
  if (m.status === "live")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-destructive">
        <span className="live-dot" /> Live
      </span>
    );
  if (m.status === "finished")
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Final
      </span>
    );
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
      {m.time || "Soon"}
    </span>
  );
}

export function MatchCard({ match }: { match: Match }) {
  const ch = resolveChannel(match.channel);
  const showScore = match.status !== "soon" && match.score && match.score !== "0-0";
  return (
    <div className="group flex h-full flex-col gap-4 rounded-2xl bg-card-gradient p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-glow">
      <div className="flex items-center justify-between">
        {statusBadge(match)}
        <span className="truncate text-xs text-muted-foreground" dir="rtl">
          {match.competition}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3" dir="rtl">
        <div className="flex flex-1 flex-col items-center gap-2 text-center">
          {match.homeLogo && (
            <img src={match.homeLogo} alt={match.homeTeam} loading="lazy" className="h-14 w-14 object-contain" />
          )}
          <div className="text-sm font-semibold leading-tight">{match.homeTeam}</div>
        </div>
        <div className="flex shrink-0 flex-col items-center px-2">
          {showScore ? (
            <div className="font-display text-3xl font-bold tabular-nums">
              {match.score.replace(/-/g, " - ")}
            </div>
          ) : (
            <div className="font-display text-2xl font-bold text-muted-foreground">VS</div>
          )}
          {match.statusLabel && (
            <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              {match.status === "live" ? match.time : match.statusLabel}
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col items-center gap-2 text-center">
          {match.awayLogo && (
            <img src={match.awayLogo} alt={match.awayTeam} loading="lazy" className="h-14 w-14 object-contain" />
          )}
          <div className="text-sm font-semibold leading-tight">{match.awayTeam}</div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground" dir="rtl">
          <Tv className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{match.channel || "—"}</span>
        </div>
        {ch ? (
          <Link
            to="/watch/$channelId"
            params={{ channelId: String(ch.id) }}
            search={{ name: ch.label }}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
          >
            <Play className="h-3 w-3 fill-current" /> Watch
          </Link>
        ) : (
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Browse channels
          </span>
        )}
      </div>
    </div>
  );
}
