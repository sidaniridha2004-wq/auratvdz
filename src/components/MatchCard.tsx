import { Link } from "@tanstack/react-router";
import { Mic2, Tv } from "lucide-react";
import { useEffect, useState } from "react";
import type { Match } from "@/lib/matches.functions";
import { resolveMatchChannelSlug, findChannelBySlug, type M3uChannel } from "@/lib/m3u-channels";
import { useChannelsBySlug } from "@/lib/channels-client";
import { ChannelLogo } from "./ChannelLogo";

type Resolved =
  | { kind: "m3u"; slug: string; label: string; logo?: string }
  | { kind: "yacine"; id: number; label: string }
  | null;

function resolveChannel(match: Match, bySlug: Map<string, M3uChannel>): Resolved {
  if (!match.channel) return null;
  let slug = "";
  const matchNameLower = match.channel.toLowerCase();
  const matchIdLower = match.id.toLowerCase();
  for (const [k, v] of bySlug.entries()) {
    if (!v.matchAlias) continue;
    const aliases = v.matchAlias.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
    if (aliases.some((a) => matchNameLower.includes(a) || a === matchIdLower)) {
      slug = k;
      break;
    }
  }
  if (!slug) slug = resolveMatchChannelSlug(match.channel) || "";
  if (slug) {
    const dbCh = bySlug.get(slug);
    if (!dbCh) return null;
    const staticCh = findChannelBySlug(slug);
    return { kind: "m3u", slug, label: dbCh.name || staticCh?.name || slug, logo: dbCh.logo || staticCh?.logo };
  }
  const m = matchNameLower.match(/(?:bein[^0-9]*max|\u0645\u0627\u0643\u0633|max)\s*([1-6])/);
  if (m) {
    const n = parseInt(m[1], 10);
    return { kind: "yacine", id: 1470 + n, label: `beIN MAX ${n}` };
  }
  return null;
}

function useLocalKickoff(iso: string | null) {
  const [out, setOut] = useState<{ time: string; date: string } | null>(null);
  useEffect(() => {
    if (!iso) return setOut(null);
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return setOut(null);
    setOut({
      time: new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(d),
      date: new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(d),
    });
  }, [iso]);
  return out;
}

function useCountdown(iso: string | null) {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) return;
    const target = new Date(iso).getTime();
    if (Number.isNaN(target)) return;
    const tick = () => setMs(target - Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [iso]);
  if (ms == null || ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function Status({ m, localTime }: { m: Match; localTime: string | null }) {
  if (m.status === "live")
    return (
      <span className="badge badge-live">
        <span className="live-dot" aria-hidden /> Live {m.statusLabel ? `· ${m.statusLabel}` : ""}
      </span>
    );
  if (m.status === "finished") return <span className="badge badge-ft">Full time</span>;
  return <span className="badge badge-soon">{localTime ?? m.time ?? "Soon"}</span>;
}

function Team({ name, logo, align }: { name: string; logo?: string; align: "start" | "end" }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-3 ${align === "end" ? "flex-row-reverse text-right" : ""}`}>
      {logo ? (
        <img src={logo} alt={`${name} crest`} loading="lazy" decoding="async" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
      ) : (
        <span aria-hidden className="h-10 w-10 shrink-0 rounded-full bg-muted" />
      )}
      <span className="min-w-0 truncate text-[15px] font-semibold" dir="auto">
        {name}
      </span>
    </div>
  );
}

/** One fixture, laid out like a printed listings row. */
export function MatchCard({ match }: { match: Match }) {
  const bySlug = useChannelsBySlug();
  const ch = resolveChannel(match, bySlug);
  const local = useLocalKickoff(match.kickoffIso);
  const countdown = useCountdown(match.status === "soon" ? match.kickoffIso : null);
  const showScore = match.status !== "soon" && match.score && match.score !== "0-0";

  const inner = (
    <article className={`tile flex h-full flex-col gap-4 p-4 ${ch ? "tile-hover" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <Status m={match} localTime={local?.time ?? null} />
        <span className="kicker truncate" dir="auto">
          {match.competition}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Team name={match.homeTeam} logo={match.homeLogo} align="start" />
        <div className="w-[84px] shrink-0 text-center">
          {showScore ? (
            <div className="font-display text-[30px] leading-none">{match.score.replace(/-/g, " – ")}</div>
          ) : countdown ? (
            <>
              <div className="font-display text-[22px] leading-none text-accent">{countdown}</div>
              <div className="kicker mt-1">kick-off</div>
            </>
          ) : (
            <div className="kicker text-muted-foreground">{local?.date ?? "vs"}</div>
          )}
        </div>
        <Team name={match.awayTeam} logo={match.awayLogo} align="end" />
      </div>

      <div className="rule mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-[12px] text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2">
          {ch?.kind === "m3u" && ch.logo ? (
            <ChannelLogo src={ch.logo} name={ch.label} size={20} />
          ) : (
            <Tv className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className="truncate" dir="auto">
            {match.channel || "Channel to be confirmed"}
          </span>
        </span>
        {match.commentator && (
          <span className="flex min-w-0 items-center gap-1.5" dir="auto">
            <Mic2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{match.commentator}</span>
          </span>
        )}
        <span className={`kicker ${ch ? "text-primary" : ""}`}>{ch ? "Watch →" : "No stream"}</span>
      </div>
    </article>
  );

  if (!ch) return inner;
  if (ch.kind === "m3u") {
    return (
      <Link to="/watch/live/$slug" params={{ slug: ch.slug }} className="block h-full" aria-label={`Watch ${match.homeTeam} vs ${match.awayTeam} on ${ch.label}`}>
        {inner}
      </Link>
    );
  }
  return (
    <Link to="/watch/$channelId" params={{ channelId: String(ch.id) }} search={{ name: ch.label }} className="block h-full" aria-label={`Watch ${match.homeTeam} vs ${match.awayTeam} on ${ch.label}`}>
      {inner}
    </Link>
  );
}
