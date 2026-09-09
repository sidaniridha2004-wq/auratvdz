import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import Hls from "hls.js";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { clearProgress, formatClock, readProgress, resumePoint, saveProgress } from "@/lib/resume";

// On-demand player: our own controls over hls.js, in the spirit of the big
// streaming apps. Auto-hiding chrome, a scrubber you can drag, quality /
// audio / subtitle menus, resume, keyboard shortcuts and a next-episode
// hand-off. If the direct stream cannot be played the VixSrc embed takes over
// inside the same frame, so the viewer is never left with a black screen.

export interface VodPlayerProps {
  /** Signed proxy link to the HLS master, or null to go straight to the embed. */
  src: string | null;
  /** VixSrc iframe URL used when the direct stream is unavailable. */
  embedSrc: string;
  poster?: string | null;
  title: string;
  subtitle?: string;
  backHref: string;
  next?: { href: string; label: string } | null;
  resumeKey: string;
  /** Extra fields stored alongside progress (season/episode for shows). */
  resumeMeta?: { season?: number; episode?: number };
  /** Pointer key updated with the same meta, e.g. the show key. */
  pointerKey?: string;
  /** Force a start position (0 = start over). Undefined = resume if possible. */
  startAt?: number;
  reason?: string | null;
}

type Menu = "none" | "root" | "quality" | "audio" | "subs" | "speed";

interface Rung {
  index: number;
  height: number;
  bitrate: number;
}

interface TrackOpt {
  id: number;
  label: string;
}

const HIDE_AFTER_MS = 3_000;
const SAVE_EVERY_MS = 4_000;
const NEXT_WINDOW_S = 60;
const AUTO_NEXT_S = 10;
const SKIP_S = 10;
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function trackLabel(t: { name?: string; lang?: string }, fallback: string): string {
  return t.name || t.lang || fallback;
}

export function VodPlayer({ src, embedSrc, poster, title, subtitle, backHref, next, resumeKey, resumeMeta, pointerKey, startAt, reason }: VodPlayerProps) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<number | null>(null);
  const lastSave = useRef(0);
  const retries = useRef(0);
  const dragging = useRef(false);

  const [fallback, setFallback] = useState(src === null);
  const [fallbackWhy, setFallbackWhy] = useState<string | null>(src === null ? (reason ?? null) : null);
  const [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [chrome, setChrome] = useState(true);
  const [menu, setMenu] = useState<Menu>("none");
  const [fullscreen, setFullscreen] = useState(false);
  const [rungs, setRungs] = useState<Rung[]>([]);
  const [rung, setRung] = useState(-1); // -1 = auto
  const [activeRung, setActiveRung] = useState(-1);
  const [audios, setAudios] = useState<TrackOpt[]>([]);
  const [audio, setAudio] = useState(-1);
  const [subs, setSubs] = useState<TrackOpt[]>([]);
  const [sub, setSub] = useState(-1); // -1 = off
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // ------------------------------------------------------------------ helpers

  const showChrome = useCallback(() => {
    setChrome(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused && !dragging.current) {
        setChrome(false);
        setMenu("none");
      }
    }, HIDE_AFTER_MS);
  }, []);

  const flash = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 900);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play().catch(() => undefined);
    } else {
      v.pause();
    }
    showChrome();
  }, [showChrome]);

  const seekBy = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v || !Number.isFinite(v.duration)) return;
      v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
      flash(delta > 0 ? `+${delta}s` : `${delta}s`);
      showChrome();
    },
    [flash, showChrome],
  );

  const seekToPct = useCallback((pct: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(1, pct)) * v.duration;
    setTime(v.currentTime);
  }, []);

  const setVol = useCallback(
    (value: number) => {
      const v = videoRef.current;
      if (!v) return;
      const clamped = Math.max(0, Math.min(1, value));
      v.volume = clamped;
      v.muted = clamped === 0;
      setVolume(clamped);
      setMuted(v.muted);
      showChrome();
    },
    [showChrome],
  );

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    showChrome();
  }, [showChrome]);

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void el.requestFullscreen?.().catch(() => undefined);
    }
    showChrome();
  }, [showChrome]);

  const goNext = useCallback(() => {
    if (!next) return;
    clearProgress(resumeKey);
    void navigate({ to: next.href });
  }, [navigate, next, resumeKey]);

  const persist = useCallback(
    (force = false) => {
      const v = videoRef.current;
      if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
      const now = Date.now();
      if (!force && now - lastSave.current < SAVE_EVERY_MS) return;
      lastSave.current = now;
      const p = { t: v.currentTime, d: v.duration, at: now, ...resumeMeta };
      saveProgress(resumeKey, p);
      if (pointerKey) saveProgress(pointerKey, p);
    },
    [pointerKey, resumeKey, resumeMeta],
  );

  // ------------------------------------------------------------ hls lifecycle

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src || fallback) return;

    const initial = startAt !== undefined ? startAt : resumePoint(readProgress(resumeKey));
    let disposed = false;
    setReady(false);
    setWaiting(true);
    setEnded(false);

    const giveUp = (why: string) => {
      if (disposed) return;
      setFallbackWhy(why);
      setFallback(true);
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        startPosition: initial > 0 ? initial : -1,
        capLevelToPlayerSize: false,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        backBufferLength: 60,
        enableWorker: true,
        lowLatencyMode: false,
      });
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels: Rung[] = hls.levels
          .map((l: { height: number; bitrate: number }, index: number) => ({ index, height: l.height, bitrate: l.bitrate }))
          .filter((l: Rung) => l.height > 0)
          .sort((a: Rung, b: Rung) => b.height - a.height);
        setRungs(levels);
        setReady(true);
        void v.play().catch(() => undefined);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e: unknown, data: { level: number }) => setActiveRung(data.level));
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        setAudios(
          hls.audioTracks.map((t: { id: number; name?: string; lang?: string }, i: number) => ({ id: t.id ?? i, label: trackLabel(t, `Audio ${i + 1}`) })),
        );
        setAudio(hls.audioTrack);
      });
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_e: unknown, data: { id: number }) => setAudio(data.id));
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
        setSubs(
          hls.subtitleTracks.map((t: { id: number; name?: string; lang?: string }, i: number) => ({ id: t.id ?? i, label: trackLabel(t, `Subtitles ${i + 1}`) })),
        );
        hls.subtitleDisplay = true;
        setSub(hls.subtitleTrack);
      });
      hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_e: unknown, data: { id: number }) => setSub(data.id));
      hls.on(Hls.Events.ERROR, (_e: unknown, data: { fatal: boolean; type: string; details?: string }) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retries.current < 2) {
          retries.current += 1;
          hls.recoverMediaError();
          return;
        }
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retries.current < 3) {
          retries.current += 1;
          window.setTimeout(() => !disposed && hls.startLoad(), 800 * retries.current);
          return;
        }
        giveUp(data.details ? `Stream error (${data.details})` : "The stream stopped responding");
      });
      hls.loadSource(src);
      hls.attachMedia(v);
    } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = src;
      const onMeta = () => {
        if (initial > 0) v.currentTime = initial;
        setReady(true);
        void v.play().catch(() => undefined);
      };
      v.addEventListener("loadedmetadata", onMeta, { once: true });
      v.addEventListener("error", () => giveUp("Your browser could not play this stream"), { once: true });
    } else {
      giveUp("This browser cannot play HLS video");
    }

    return () => {
      disposed = true;
      persist(true);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, fallback, resumeKey, startAt]);

  // ------------------------------------------------------------ media events

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (!dragging.current) setTime(v.currentTime);
      if (Number.isFinite(v.duration)) setDuration(v.duration);
      const b = v.buffered;
      if (b.length) setBuffered(b.end(b.length - 1));
      persist();
    };
    const onPlay = () => {
      setPlaying(true);
      setEnded(false);
      setCountdown(null);
      showChrome();
    };
    const onPause = () => {
      setPlaying(false);
      setChrome(true);
      persist(true);
    };
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);
    const onEnded = () => {
      setEnded(true);
      setPlaying(false);
      setChrome(true);
      saveProgress(resumeKey, { t: v.duration || v.currentTime, d: v.duration || v.currentTime, at: Date.now(), ...resumeMeta });
      if (next) setCountdown(AUTO_NEXT_S);
    };
    const onVolume = () => {
      setVolume(v.volume);
      setMuted(v.muted);
    };
    const onRate = () => setSpeed(v.playbackRate);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onTime);
    v.addEventListener("progress", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("canplay", onPlaying);
    v.addEventListener("ended", onEnded);
    v.addEventListener("volumechange", onVolume);
    v.addEventListener("ratechange", onRate);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onTime);
      v.removeEventListener("progress", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("canplay", onPlaying);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("volumechange", onVolume);
      v.removeEventListener("ratechange", onRate);
    };
  }, [next, persist, resumeKey, resumeMeta, showChrome]);

  // Auto-advance countdown after the credits.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      goNext();
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, goNext]);

  // Fullscreen state + save on unload.
  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    const onHide = () => persist(true);
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [persist]);

  // Keyboard shortcuts.
  useEffect(() => {
    if (fallback) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
        case "j":
          e.preventDefault();
          seekBy(-SKIP_S);
          break;
        case "ArrowRight":
        case "l":
          e.preventDefault();
          seekBy(SKIP_S);
          break;
        case "ArrowUp":
          e.preventDefault();
          setVol(volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          setVol(volume - 0.1);
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "n":
          if (next) goNext();
          break;
        case "Escape":
          if (menu !== "none") setMenu("none");
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fallback, goNext, menu, next, seekBy, setVol, toggleFullscreen, toggleMute, togglePlay, volume]);

  // ------------------------------------------------------------ scrubber

  const pctFromEvent = (e: { clientX: number }) => {
    const bar = barRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const onBarPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pctFromEvent(e);
    setTime(p * duration);
    setHoverPct(p);
    showChrome();
  };
  const onBarPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pctFromEvent(e);
    setHoverPct(p);
    if (dragging.current) setTime(p * duration);
  };
  const onBarPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    seekToPct(pctFromEvent(e));
    showChrome();
  };

  // ------------------------------------------------------------ menus

  const pickRung = (index: number) => {
    const hls = hlsRef.current;
    if (hls) hls.currentLevel = index;
    setRung(index);
    setMenu("none");
    flash(index === -1 ? "Auto quality" : `${rungs.find((r) => r.index === index)?.height ?? ""}p`);
  };
  const pickAudio = (id: number) => {
    const hls = hlsRef.current;
    if (hls) hls.audioTrack = id;
    setAudio(id);
    setMenu("none");
  };
  const pickSub = (id: number) => {
    const hls = hlsRef.current;
    if (hls) {
      hls.subtitleTrack = id;
      hls.subtitleDisplay = id !== -1;
    }
    setSub(id);
    setMenu("none");
  };
  const pickSpeed = (rate: number) => {
    const v = videoRef.current;
    if (v) v.playbackRate = rate;
    setSpeed(rate);
    setMenu("none");
    flash(`${rate}×`);
  };

  const activeHeight = useMemo(() => rungs.find((r) => r.index === activeRung)?.height ?? null, [rungs, activeRung]);
  const pct = duration > 0 ? (time / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;
  const nearEnd = duration > 0 && duration - time <= NEXT_WINDOW_S;
  const showNext = Boolean(next) && (nearEnd || ended);
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  // ------------------------------------------------------------ render

  if (fallback) {
    return (
      <div ref={wrapRef} className="relative h-full w-full bg-black">
        <iframe
          src={embedSrc}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-3 text-white sm:p-4">
          <a href={backHref} className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 hover:bg-black/70" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </a>
          {fallbackWhy && (
            <span className="pointer-events-auto inline-flex items-center gap-2 rounded bg-black/60 px-3 py-1.5 text-[12px]">
              <AlertTriangle className="h-3.5 w-3.5 text-accent" aria-hidden />
              Using the backup player · {fallbackWhy}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className={`group/player relative h-full w-full select-none bg-black text-white ${chrome ? "" : "cursor-none"}`}
      onPointerMove={showChrome}
      onPointerDown={showChrome}
      onDoubleClick={toggleFullscreen}
    >
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full"
        onClick={(e) => {
          e.stopPropagation();
          if (menu !== "none") {
            setMenu("none");
            return;
          }
          togglePlay();
        }}
      />

      {/* Centre state: spinner / big play */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        {(waiting || !ready) && !ended ? (
          <Loader2 className="h-12 w-12 animate-spin opacity-80" aria-label="Loading" />
        ) : !playing && !ended ? (
          <span className="grid h-20 w-20 place-items-center rounded-full bg-white/15 backdrop-blur-sm">
            <Play className="h-10 w-10 fill-current" aria-hidden />
          </span>
        ) : null}
        {toast && <span className="absolute bottom-28 rounded bg-black/70 px-3 py-1 font-mono text-[13px]">{toast}</span>}
      </div>

      {/* Ended: next episode or replay */}
      {ended && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-6">
          <div className="text-center">
            <div className="kicker text-white/70">{next ? "Up next" : "The end"}</div>
            {next ? (
              <>
                <div className="mt-2 font-display text-2xl">{next.label}</div>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <button type="button" onClick={goNext} className="btn btn-primary">
                    <SkipForward className="h-4 w-4" aria-hidden /> Play now{countdown !== null ? ` (${countdown})` : ""}
                  </button>
                  <button type="button" onClick={() => setCountdown(null)} className="btn btn-ghost text-white">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  v.currentTime = 0;
                  void v.play();
                }}
                className="btn btn-primary mt-5"
              >
                <RotateCcw className="h-4 w-4" aria-hidden /> Watch again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top bar */}
      <div
        className={`absolute inset-x-0 top-0 flex items-start gap-3 bg-gradient-to-b from-black/80 to-transparent p-3 transition-opacity sm:p-4 ${chrome ? "opacity-100" : "opacity-0"}`}
      >
        <a href={backHref} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-white/15" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </a>
        <div className="min-w-0">
          <div className="truncate font-display text-[18px] leading-tight sm:text-[22px]" dir="auto">
            {title}
          </div>
          {subtitle && <div className="truncate text-[13px] text-white/75">{subtitle}</div>}
        </div>
        {activeHeight && <span className="kicker ml-auto mt-2 hidden rounded bg-white/15 px-1.5 py-0.5 text-[11px] sm:inline">{activeHeight}p</span>}
      </div>

      {/* Next episode pill during the last minute */}
      {showNext && !ended && next && (
        <button type="button" onClick={goNext} className="btn btn-primary absolute bottom-24 right-4 sm:bottom-28 sm:right-6">
          <SkipForward className="h-4 w-4" aria-hidden /> Next episode
        </button>
      )}

      {/* Bottom controls */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-3 pt-10 transition-opacity sm:px-5 sm:pb-4 ${chrome ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrubber */}
        <div
          ref={barRef}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.floor(duration)}
          aria-valuenow={Math.floor(time)}
          aria-valuetext={formatClock(time)}
          tabIndex={0}
          className="group/bar relative h-6 cursor-pointer touch-none"
          onPointerDown={onBarPointerDown}
          onPointerMove={onBarPointerMove}
          onPointerUp={onBarPointerUp}
          onPointerCancel={onBarPointerUp}
          onPointerLeave={() => !dragging.current && setHoverPct(null)}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-white/25 transition-[height] group-hover/bar:h-1.5">
            <div className="absolute inset-y-0 left-0 rounded bg-white/40" style={{ width: `${bufferedPct}%` }} />
            <div className="absolute inset-y-0 left-0 rounded bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow transition-opacity group-hover/bar:opacity-100"
            style={{ left: `${pct}%` }}
          />
          {hoverPct !== null && duration > 0 && (
            <span
              className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[11px]"
              style={{ left: `${hoverPct * 100}%` }}
            >
              {formatClock(hoverPct * duration)}
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-1 sm:gap-2">
          <button type="button" onClick={togglePlay} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/15" aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
          </button>
          <button type="button" onClick={() => seekBy(-SKIP_S)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/15" aria-label="Back 10 seconds">
            <RotateCcw className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => seekBy(SKIP_S)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/15" aria-label="Forward 10 seconds">
            <RotateCw className="h-5 w-5" />
          </button>

          <div className="group/vol flex items-center">
            <button type="button" onClick={toggleMute} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/15" aria-label={muted ? "Unmute" : "Mute"}>
              <VolumeIcon className="h-5 w-5" />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => setVol(Number(e.target.value))}
              aria-label="Volume"
              className="hidden w-0 accent-primary transition-all group-hover/vol:w-20 sm:block"
            />
          </div>

          <span className="ml-1 font-mono text-[12px] tabular-nums text-white/85 sm:text-[13px]">
            {formatClock(time)} <span className="text-white/50">/ {formatClock(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {next && (
              <button type="button" onClick={goNext} className="hidden h-10 w-10 place-items-center rounded-full hover:bg-white/15 sm:grid" aria-label="Next episode" title="Next episode (n)">
                <SkipForward className="h-5 w-5" />
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu((m) => (m === "none" ? "root" : "none"))}
                className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/15"
                aria-label="Settings"
                aria-expanded={menu !== "none"}
              >
                <Settings className="h-5 w-5" />
              </button>
              {menu !== "none" && (
                <div className="absolute bottom-12 right-0 w-60 overflow-hidden rounded bg-[#171613]/95 text-[14px] shadow-xl backdrop-blur" role="menu">
                  {menu === "root" && (
                    <ul>
                      <MenuRow
                        label="Quality"
                        value={rung === -1 ? `Auto${activeHeight ? ` (${activeHeight}p)` : ""}` : `${activeHeight ?? ""}p`}
                        onClick={() => setMenu("quality")}
                        disabled={!rungs.length}
                      />
                      <MenuRow label="Audio" value={audios.find((a) => a.id === audio)?.label ?? "Default"} onClick={() => setMenu("audio")} disabled={audios.length < 2} />
                      <MenuRow label="Subtitles" value={sub === -1 ? "Off" : subs.find((s) => s.id === sub)?.label ?? "On"} onClick={() => setMenu("subs")} disabled={!subs.length} />
                      <MenuRow label="Speed" value={`${speed}×`} onClick={() => setMenu("speed")} />
                      <li className="border-t border-white/10">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setFallbackWhy("switched manually");
                            setFallback(true);
                          }}
                          className="flex w-full items-center px-3 py-2.5 text-left text-white/70 hover:bg-white/10"
                        >
                          Use the backup player
                        </button>
                      </li>
                    </ul>
                  )}
                  {menu === "quality" && (
                    <SubMenu title="Quality" onBack={() => setMenu("root")}>
                      <Option label="Auto" hint={activeHeight ? `${activeHeight}p` : undefined} selected={rung === -1} onClick={() => pickRung(-1)} />
                      {rungs.map((r) => (
                        <Option
                          key={r.index}
                          label={`${r.height}p`}
                          hint={r.bitrate ? `${Math.round(r.bitrate / 1000)} kbps` : undefined}
                          selected={rung === r.index}
                          onClick={() => pickRung(r.index)}
                        />
                      ))}
                    </SubMenu>
                  )}
                  {menu === "audio" && (
                    <SubMenu title="Audio" onBack={() => setMenu("root")}>
                      {audios.map((a) => (
                        <Option key={a.id} label={a.label} selected={audio === a.id} onClick={() => pickAudio(a.id)} />
                      ))}
                    </SubMenu>
                  )}
                  {menu === "subs" && (
                    <SubMenu title="Subtitles" onBack={() => setMenu("root")}>
                      <Option label="Off" selected={sub === -1} onClick={() => pickSub(-1)} />
                      {subs.map((s) => (
                        <Option key={s.id} label={s.label} selected={sub === s.id} onClick={() => pickSub(s.id)} />
                      ))}
                    </SubMenu>
                  )}
                  {menu === "speed" && (
                    <SubMenu title="Speed" onBack={() => setMenu("root")}>
                      {SPEEDS.map((s) => (
                        <Option key={s} label={s === 1 ? "Normal" : `${s}×`} selected={speed === s} onClick={() => pickSpeed(s)} />
                      ))}
                    </SubMenu>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/15"
              aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            >
              {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuRow({ label, value, onClick, disabled }: { label: string; value: string; onClick: () => void; disabled?: boolean }) {
  return (
    <li>
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        disabled={disabled}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <span>{label}</span>
        <span className="truncate text-[13px] text-white/60">{value} ›</span>
      </button>
    </li>
  );
}

function SubMenu({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div>
      <button type="button" onClick={onBack} className="flex w-full items-center gap-2 px-3 py-2.5 text-left font-semibold hover:bg-white/10">
        <ChevronLeft className="h-4 w-4" aria-hidden /> {title}
      </button>
      <ul className="max-h-64 overflow-y-auto">{children}</ul>
    </div>
  );
}

function Option({ label, hint, selected, onClick }: { label: string; hint?: string; selected: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        role="menuitemradio"
        aria-checked={selected}
        onClick={onClick}
        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-white/10 ${selected ? "text-white" : "text-white/80"}`}
      >
        <span className="inline-flex items-center gap-2">
          <Check className={`h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`} aria-hidden /> {label}
        </span>
        {hint && <span className="font-mono text-[11px] text-white/50">{hint}</span>}
      </button>
    </li>
  );
}
