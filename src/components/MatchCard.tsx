import { Link } from "@tanstack/react-router";
import { Play, Tv, Clock, Mic2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Match } from "@/lib/matches.functions";

// Channel name → YacineTV channel id. Prefer 1080P streams.
// IDs verified against http://ver3.yacinelive.com/api/categories/* on 2026-06-12.
const CHANNEL_MAP: { match: RegExp; id: number; label: string }[] = [
  // beIN MAX 1-6 (1080P category 90)
  { match: /bein\s*max\s*1\b/i, id: 1471, label: "beIN MAX 1" },
  { match: /bein\s*max\s*2\b/i, id: 1472, label: "beIN MAX 2" },
  { match: /bein\s*max\s*3\b/i, id: 1473, label: "beIN MAX 3" },
  { match: /bein\s*max\s*4\b/i, id: 1474, label: "beIN MAX 4" },
  { match: /bein\s*max\s*5\b/i, id: 1475, label: "beIN MAX 5" },
  { match: /bein\s*max\s*6\b/i, id: 1476, label: "beIN MAX 6" },
  // beIN SPORTS 1-9 (category 4, 1080P)
  { match: /bein\s*(sports?\s*)?1\b/i, id: 1424, label: "beIN SPORTS 1" },
  { match: /bein\s*(sports?\s*)?2\b/i, id: 1425, label: "beIN SPORTS 2" },
  { match: /bein\s*(sports?\s*)?3\b/i, id: 1426, label: "beIN SPORTS 3" },
  { match: /bein\s*(sports?\s*)?4\b/i, id: 1427, label: "beIN SPORTS 4" },
  { match: /bein\s*(sports?\s*)?5\b/i, id: 1428, label: "beIN SPORTS 5" },
  { match: /bein\s*(sports?\s*)?6\b/i, id: 1429, label: "beIN SPORTS 6" },
  { match: /bein\s*(sports?\s*)?7\b/i, id: 1430, label: "beIN SPORTS 7" },
  { match: /bein\s*(sports?\s*)?8\b/i, id: 1431, label: "beIN SPORTS 8" },
  { match: /bein\s*(sports?\s*)?9\b/i, id: 1432, label: "beIN SPORTS 9" },
  // beIN XTRA
  { match: /bein\s*xtra\s*1/i, id: 1421, label: "beIN XTRA 1" },
  { match: /bein\s*xtra\s*2/i, id: 1422, label: "beIN XTRA 2" },
  { match: /bein\s*xtra\s*3/i, id: 1423, label: "beIN XTRA 3" },
  // Arabic variants
  { match: /بي\s*ان\s*ماكس\s*1|بي\s*إن\s*ماكس\s*1/i, id: 1471, label: "beIN MAX 1" },
  { match: /بي\s*ان\s*ماكس\s*2|بي\s*إن\s*ماكس\s*2/i, id: 1472, label: "beIN MAX 2" },
  { match: /بي\s*ان\s*ماكس\s*3|بي\s*إن\s*ماكس\s*3/i, id: 1473, label: "beIN MAX 3" },
  { match: /بي\s*ان\s*سبورت\s*1|بي\s*إن\s*سبورت\s*1/i, id: 1424, label: "beIN SPORTS 1" },
  { match: /بي\s*ان\s*سبورت\s*2|بي\s*إن\s*سبورت\s*2/i, id: 1425, label: "beIN SPORTS 2" },
];

function resolveChannel(name: string): { id: number; label: string } | null {
  if (!name) return null;
  for (const c of CHANNEL_MAP) if (c.match.test(name)) return { id: c.id, label: c.label };
  return null;
}

function useLocalKickoff(iso: string | null) {
  const [out, setOut] = useState<{ time: string; date: string } | null>(null);
  useEffect(() => {
    if (!iso) {
      setOut(null);
      return;
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      setOut(null);
      return;
    }
    setOut({
      time: new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(d),
      date: new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(d),
    });
  }, [iso]);
  return out;
}

function StatusBadge({ m, localTime }: { m: Match; localTime: string | null }) {
  if (m.status === "live")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-destructive">
        <span className="live-dot" /> Live
      </span>
    );
  if (m.status === "finished")
    return (
      <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Full time
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
      <Clock className="h-3 w-3" /> {localTime ?? m.time ?? "Soon"}
    </span>
  );
}

export function MatchCard({ match }: { match: Match }) {
  const ch = resolveChannel(match.channel);
  const local = useLocalKickoff(match.kickoffIso);
  const showScore = match.status !== "soon" && match.score && match.score !== "0-0";

  // Build a search payload that carries the matched channel name for the watch page header.
  const watchSearch = ch
    ? { name: ch.label }
    : { name: "" };

  return (
    <div className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-border/60 bg-card-gradient p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow">
      {/* hover aurora */}
      <div className="pointer-events-none absolute -inset-px -z-0 rounded-2xl bg-gradient-to-br from-cyan-500/0 via-violet-500/0 to-fuchsia-500/0 opacity-0 transition duration-500 group-hover:from-cyan-500/10 group-hover:via-violet-500/10 group-hover:to-fuchsia-500/10 group-hover:opacity-100" />

      <div className="relative flex items-center justify-between">
        <StatusBadge m={match} localTime={local?.time ?? null} />
        <span className="truncate text-xs text-muted-foreground" dir="rtl">
          {match.competition}
        </span>
      </div>

      <div className="relative flex items-center justify-between gap-3" dir="rtl">
        <div className="flex flex-1 flex-col items-center gap-2 text-center">
          {match.homeLogo ? (
            <img
              src={match.homeLogo}
              alt={match.homeTeam}
              loading="lazy"
              className="h-14 w-14 object-contain drop-shadow-[0_0_10px_rgba(56,189,248,0.25)] transition duration-300 group-hover:scale-110"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-muted" />
          )}
          <div className="text-sm font-semibold leading-tight">{match.homeTeam}</div>
        </div>
        <div className="flex shrink-0 flex-col items-center px-2">
          {showScore ? (
            <div className="font-display text-3xl font-bold tabular-nums">
              {match.score.replace(/-/g, " - ")}
            </div>
          ) : (
            <div className="font-display text-2xl font-bold text-muted-foreground/70">VS</div>
          )}
          {local?.date && match.status !== "live" && (
            <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              {local.date}
            </div>
          )}
          {match.status === "live" && (
            <div className="mt-1 text-[10px] uppercase tracking-widest text-destructive">
              {match.statusLabel || "Now"}
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col items-center gap-2 text-center">
          {match.awayLogo ? (
            <img
              src={match.awayLogo}
              alt={match.awayTeam}
              loading="lazy"
              className="h-14 w-14 object-contain drop-shadow-[0_0_10px_rgba(167,139,250,0.25)] transition duration-300 group-hover:scale-110"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-muted" />
          )}
          <div className="text-sm font-semibold leading-tight">{match.awayTeam}</div>
        </div>
      </div>

      <div className="relative mt-auto flex flex-col gap-2 border-t border-border/60 pt-3 text-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <Tv className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{match.channel || "—"}</span>
          </div>
          {ch ? (
            <Link
              to="/watch/$channelId"
              params={{ channelId: String(ch.id) }}
              search={watchSearch}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow transition hover:scale-105 hover:opacity-95"
            >
              <Play className="h-3 w-3 fill-current" /> Watch
            </Link>
          ) : (
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              No channel
            </span>
          )}
        </div>
        {match.commentator && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground" dir="rtl">
            <Mic2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{match.commentator}</span>
          </div>
        )}
      </div>
    </div>
  );
}
