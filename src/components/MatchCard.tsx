import { Link } from "@tanstack/react-router";
import { Tv, Clock, Mic2, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { Match } from "@/lib/matches.functions";
import { resolveMatchChannelSlug, findChannelBySlug } from "@/lib/m3u-channels";

type Resolved =
  | { kind: "m3u"; slug: string; label: string }
  | { kind: "yacine"; id: number; label: string }
  | null;

// Resolve a match's channel to a playable route. Prefers our M3U primary
// server; falls back to YacineTV IDs for beIN MAX 1-6.
function resolveChannel(name: string): Resolved {
  if (!name) return null;
  const slug = resolveMatchChannelSlug(name);
  if (slug) {
    const ch = findChannelBySlug(slug);
    if (ch) return { kind: "m3u", slug, label: ch.name };
  }
  const m = name.toLowerCase().match(/(?:bein[^0-9]*max|ماكس|max)\s*([1-6])/);
  if (m) {
    const n = parseInt(m[1], 10);
    return { kind: "yacine", id: 1470 + n, label: `beIN MAX ${n}` };
  }
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
    if (Number.isNaN(d.getTime())) return setOut(null);
    setOut({
      time: new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d),
      date: new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(d),
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

  const inner = (
    <div className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-border/60 bg-card-gradient p-5 shadow-card card-hover">
      {/* hover aurora wash */}
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
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary opacity-80 transition group-hover:opacity-100">
              <PlayCircle className="h-4 w-4" /> Play
            </div>
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

  if (!ch) return inner;
  if (ch.kind === "m3u") {
    return (
      <Link
        to="/watch/live/$slug"
        params={{ slug: ch.slug }}
        className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl"
      >
        {inner}
      </Link>
    );
  }
  return (
    <Link
      to="/watch/$channelId"
      params={{ channelId: String(ch.id) }}
      search={{ name: ch.label }}
      className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl"
    >
      {inner}
    </Link>
  );
}
