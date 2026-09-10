import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import Hls from "hls.js";
import {
  AlertTriangle,
  ArrowLeft,
  Captions,
  Check,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Languages,
  Loader2,
  Maximize,
  Minimize,
  MonitorPlay,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Server,
  Settings,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { ServerId, ServerOption, StreamResolution, SubtitleTrack } from "@/lib/media.functions";
import { clearProgress, formatClock, readProgress, resumePoint, saveProgress } from "@/lib/resume";

// On-demand player.
//
// Server 1 (VixSrc) is played by our own controls over hls.js: auto-hiding
// chrome, draggable scrubber, quality / audio / subtitle / speed menus,
// resume, keyboard shortcuts and a next-episode hand-off. External subtitle
// files (Arabic first) are attached as <track>s and switched on by default.
//
// If the direct stream cannot be played, produces sound but no picture, or the
// viewer asks for it, the player switches to another server. Servers 2-4
// (VidAPI, MultiEmbed, VidFast) and the VixSrc embed are iframes; we keep a
// slim bar over them with back, title and a "Change server" menu so the
// viewer is never stuck.

export interface VodPlayerProps {
  stream: StreamResolution;
  /** Server requested in the URL (?s=vidapi). Overrides the remembered one. */
  preferredServer?: ServerId;
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
}

type Mode = { kind: "direct" } | { kind: "embed"; server: ServerId; why: string | null };
type Menu = "none" | "root" | "quality" | "audio" | "subs" | "speed" | "server";
/** off | external track n | hls.js subtitle track n */
type SubChoice = "off" | `ext-${number}` | `hls-${number}`;

interface Rung {
  index: number;
  height: number;
  bitrate: number;
}

interface TrackOpt {
  id: number;
  label: string;
  lang: string;
}

const HIDE_AFTER_MS = 3_000;
const SAVE_EVERY_MS = 4_000;
const NEXT_WINDOW_S = 60;
const AUTO_NEXT_S = 10;
const SKIP_S = 10;
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
/** After playback reports "playing", check for decoded frames at these delays. */
const PICTURE_CHECK_MS = [4_000, 9_000];
const SERVER_PREF = "auratv:server";
const SUBS_PREF = "auratv:subs";
const VIDAPI_ORIGIN = "https://vaplayer.ru";

function remember(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // private mode
  }
}

function recall(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function isServerId(v: unknown): v is ServerId {
  return v === "vixsrc" || v === "vidapi" || v === "multiembed" || v === "vidfast";
}

function trackLabel(t: { name?: string; lang?: string }, fallback: string): string {
  return t.name || t.lang || fallback;
}

function langOf(t: { lang?: string; name?: string }): string {
  const raw = (t.lang || "").toLowerCase();
  if (raw) return raw.slice(0, 2);
  const n = (t.name || "").toLowerCase();
  if (/arab|عرب/.test(n)) return "ar";
  if (/engl/.test(n)) return "en";
  if (/fran|french/.test(n)) return "fr";
  return "";
}

export function VodPlayer({ stream, preferredServer, poster, title, subtitle, backHref, next, resumeKey, resumeMeta, pointerKey, startAt }: VodPlayerProps) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<number | null>(null);
  const pictureTimers = useRef<number[]>([]);
  const lastSave = useRef(0);
  const retries = useRef(0);
  const dragging = useRef(false);
  const directFailed = useRef(false);

  const servers = stream.servers;
  const direct = stream.direct;
  const external = stream.subtitles;
  const hasServer = useCallback((id: ServerId) => servers.some((s) => s.id === id), [servers]);

  // Which server do we start on?
  const [mode, setMode] = useState<Mode>(() => {
    const wanted = preferredServer ?? (isServerId(recall(SERVER_PREF)) ? (recall(SERVER_PREF) as ServerId) : null);
    if (wanted && wanted !== "vixsrc" && hasServer(wanted)) return { kind: "embed", server: wanted, why: null };
    if (direct.ok) return { kind: "direct" };
    const firstEmbed = servers.find((s) => s.kind === "embed");
    if (firstEmbed) return { kind: "embed", server: firstEmbed.id, why: direct.ok ? null : direct.reason };
    return { kind: "embed", server: "vixsrc", why: direct.ok ? null : direct.reason };
  });

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
  const [hlsSubs, setHlsSubs] = useState<TrackOpt[]>([]);
  const [sub, setSub] = useState<SubChoice>("off");
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  const announce = useCallback((text: string | null, ms = 6_000) => {
    setNotice(text);
    if (text) window.setTimeout(() => setNotice((n) => (n === text ? null : n)), ms);
  }, []);

  const resumeAt = useCallback(() => (startAt !== undefined ? startAt : resumePoint(readProgress(resumeKey))), [resumeKey, startAt]);

  /** Embed URL for a server, with the resume point appended client-side. */
  const embedSrcFor = useCallback(
    (id: ServerId): string | null => {
      const opt = servers.find((s) => s.id === id);
      if (!opt) return null;
      try {
        const u = new URL(opt.embed);
        const v = videoRef.current;
        const at = v && Number.isFinite(v.currentTime) && v.currentTime > 5 ? v.currentTime : resumeAt();
        if (at > 0 && id !== "multiembed") u.searchParams.set(id === "vidapi" ? "resumeAt" : "startAt", String(Math.floor(at)));
        return u.toString();
      } catch {
        return opt.embed;
      }
    },
    [resumeAt, servers],
  );

  const switchServer = useCallback(
    (id: ServerId, opts: { manual: boolean; why?: string }) => {
      setMenu("none");
      if (opts.manual) remember(SERVER_PREF, id);
      if (id === "vixsrc" && direct.ok && !directFailed.current) {
        setMode({ kind: "direct" });
      } else if (hasServer(id) || id === "vixsrc") {
        setMode({ kind: "embed", server: id, why: opts.why ?? null });
      } else {
        return;
      }
      const name = servers.find((s) => s.id === id)?.name ?? id;
      announce(opts.manual ? `Switched to ${name}` : `${opts.why ?? "Playback failed"} — switched to ${name}`);
    },
    [announce, direct.ok, hasServer, servers],
  );

  /** The direct stream is unusable: move to the first embed server. */
  const giveUp = useCallback(
    (why: string) => {
      directFailed.current = true;
      const alt = servers.find((s) => s.kind === "embed")?.id ?? "vixsrc";
      switchServer(alt, { manual: false, why });
    },
    [servers, switchServer],
  );

  const clearPictureTimers = () => {
    for (const t of pictureTimers.current) window.clearTimeout(t);
    pictureTimers.current = [];
  };

  /** Sound but no picture (unsupported video codec, broken rendition) → fail over. */
  const armPictureCheck = useCallback(() => {
    clearPictureTimers();
    const v = videoRef.current;
    if (!v) return;
    pictureTimers.current = PICTURE_CHECK_MS.map((ms, i) =>
      window.setTimeout(() => {
        const el = videoRef.current;
        if (!el || el.paused || el.ended || el.currentTime < 1) return;
        let frames = -1;
        const q = typeof el.getVideoPlaybackQuality === "function" ? el.getVideoPlaybackQuality() : null;
        if (q && typeof q.totalVideoFrames === "number") frames = q.totalVideoFrames;
        const noPicture = el.videoWidth === 0 || frames === 0;
        if (noPicture && i === PICTURE_CHECK_MS.length - 1) giveUp("No picture from Server 1");
      }, ms),
    );
  }, [giveUp]);

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

  // --------------------------------------------------------------- subtitles

  /** Pick the default subtitle: remembered language, else Arabic, else off. */
  const defaultSubChoice = useCallback(
    (hls: TrackOpt[]): SubChoice => {
      const pref = recall(SUBS_PREF); // "off" | lang code | null (= Arabic)
      if (pref === "off") return "off";
      const want = pref && pref !== "off" ? pref : "ar";
      const extIdx = external.findIndex((s) => s.lang === want && !s.hearingImpaired);
      if (extIdx >= 0) return `ext-${extIdx}`;
      const extAny = external.findIndex((s) => s.lang === want);
      if (extAny >= 0) return `ext-${extAny}`;
      const h = hls.find((t) => t.lang === want);
      if (h) return `hls-${h.id}`;
      if (want === "ar") return "off";
      // Remembered language not available: fall back to Arabic.
      const ar = external.findIndex((s) => s.lang === "ar");
      if (ar >= 0) return `ext-${ar}`;
      const har = hls.find((t) => t.lang === "ar");
      return har ? `hls-${har.id}` : "off";
    },
    [external],
  );

  /** Apply the current choice to <track> elements and hls.js. */
  const applySubs = useCallback(
    (choice: SubChoice) => {
      const v = videoRef.current;
      const hls = hlsRef.current;
      const extIndex = choice.startsWith("ext-") ? Number(choice.slice(4)) : -1;
      const hlsId = choice.startsWith("hls-") ? Number(choice.slice(4)) : -1;
      if (v) {
        const tracks = v.textTracks;
        for (let i = 0; i < tracks.length; i++) {
          const t = tracks[i];
          const id = t.id || "";
          if (id.startsWith("ext-")) {
            t.mode = id === `ext-${extIndex}` ? "showing" : "disabled";
          } else if (hlsId === -1) {
            // Tracks created by hls.js: keep them hidden when an external one is shown.
            if (t.mode === "showing") t.mode = "hidden";
          }
        }
      }
      if (hls) {
        hls.subtitleTrack = hlsId;
        hls.subtitleDisplay = hlsId !== -1;
      }
    },
    [],
  );

  const pickSub = (choice: SubChoice) => {
    setSub(choice);
    applySubs(choice);
    setMenu("none");
    if (choice === "off") {
      remember(SUBS_PREF, "off");
      flash("Subtitles off");
    } else {
      const lang = choice.startsWith("ext-") ? external[Number(choice.slice(4))]?.lang : hlsSubs.find((t) => t.id === Number(choice.slice(4)))?.lang;
      remember(SUBS_PREF, lang || "ar");
      flash("Subtitles on");
    }
  };

  const subLabel = useMemo(() => {
    if (sub === "off") return "Off";
    if (sub.startsWith("ext-")) return external[Number(sub.slice(4))]?.label ?? "On";
    return hlsSubs.find((t) => t.id === Number(sub.slice(4)))?.label ?? "On";
  }, [external, hlsSubs, sub]);

  // Re-apply whenever the choice or the track list changes (tracks mount late).
  useEffect(() => {
    if (mode.kind !== "direct") return;
    applySubs(sub);
  }, [applySubs, mode.kind, sub, hlsSubs, external]);

  // ------------------------------------------------------------ hls lifecycle

  useEffect(() => {
    const v = videoRef.current;
    if (!v || mode.kind !== "direct" || !direct.ok) return;
    const src = direct.src;
    const initial = resumeAt();
    let disposed = false;
    retries.current = 0;
    setReady(false);
    setWaiting(true);
    setEnded(false);
    setRungs([]);
    setAudios([]);
    setHlsSubs([]);
    setSub(defaultSubChoice([]));

    const fail = (why: string) => {
      if (!disposed) giveUp(why);
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        startPosition: initial > 0 ? initial : -1,
        // Never cap by element size: viewers pick 1080p even in a small window.
        capLevelToPlayerSize: false,
        startLevel: -1,
        abrEwmaDefaultEstimate: 6_000_000,
        testBandwidth: false,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        backBufferLength: 60,
        enableWorker: true,
        lowLatencyMode: false,
        renderTextTracksNatively: true,
      });
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels: Rung[] = (hls.levels as Array<{ height: number; bitrate: number }>)
          .map((l, index) => ({ index, height: l.height, bitrate: l.bitrate }))
          .filter((l) => l.height > 0)
          .sort((a, b) => b.height - a.height);
        setRungs(levels);
        setReady(true);
        void v.play().catch(() => undefined);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e: unknown, data: { level: number }) => setActiveRung(data.level));
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        const list = (hls.audioTracks as Array<{ id: number; name?: string; lang?: string }>).map((t, i) => ({
          id: t.id ?? i,
          label: trackLabel(t, `Audio ${i + 1}`),
          lang: langOf(t),
        }));
        setAudios(list);
        setAudio(hls.audioTrack);
      });
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_e: unknown, data: { id: number }) => setAudio(data.id));
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
        const list = (hls.subtitleTracks as Array<{ id: number; name?: string; lang?: string }>).map((t, i) => ({
          id: t.id ?? i,
          label: trackLabel(t, `Subtitles ${i + 1}`),
          lang: langOf(t),
        }));
        setHlsSubs(list);
        setSub(defaultSubChoice(list));
      });
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
        fail(data.details ? `Stream error (${data.details})` : "The stream stopped responding");
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
      v.addEventListener("error", () => fail("Your browser could not play this stream"), { once: true });
    } else {
      fail("This browser cannot play HLS video");
    }

    return () => {
      disposed = true;
      clearPictureTimers();
      persist(true);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.kind, direct.ok, direct.ok ? direct.src : null, resumeKey, startAt]);

  // ------------------------------------------------------------ media events

  useEffect(() => {
    const v = videoRef.current;
    if (!v || mode.kind !== "direct") return;
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
    const onPlaying = () => {
      setWaiting(false);
      armPictureCheck();
    };
    const onCanPlay = () => setWaiting(false);
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
    v.addEventListener("canplay", onCanPlay);
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
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("volumechange", onVolume);
      v.removeEventListener("ratechange", onRate);
    };
  }, [armPictureCheck, mode.kind, next, persist, resumeKey, resumeMeta, showChrome]);

  // Progress reported by the VidAPI embed (postMessage) feeds "continue watching".
  useEffect(() => {
    if (mode.kind !== "embed" || mode.server !== "vidapi") return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== VIDAPI_ORIGIN) return;
      const msg = e.data as { type?: string; data?: { player_status?: string; player_progress?: unknown; player_duration?: unknown } } | null;
      if (!msg || msg.type !== "PLAYER_EVENT" || !msg.data) return;
      const t = Number(msg.data.player_progress);
      const d = Number(msg.data.player_duration);
      if (!Number.isFinite(t) || !Number.isFinite(d) || d <= 0) return;
      const now = Date.now();
      if (msg.data.player_status !== "paused" && msg.data.player_status !== "completed" && now - lastSave.current < SAVE_EVERY_MS) return;
      lastSave.current = now;
      const p = { t: msg.data.player_status === "completed" ? d : t, d, at: now, ...resumeMeta };
      saveProgress(resumeKey, p);
      if (pointerKey) saveProgress(pointerKey, p);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [mode, pointerKey, resumeKey, resumeMeta]);

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
    if (mode.kind !== "direct") return;
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
        case "c":
          pickSub(sub === "off" ? defaultSubChoiceOrFirst() : "off");
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
    const defaultSubChoiceOrFirst = (): SubChoice => {
      const d = defaultSubChoice(hlsSubs);
      if (d !== "off") return d;
      if (external.length) return "ext-0";
      if (hlsSubs.length) return `hls-${hlsSubs[0].id}`;
      return "off";
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.kind, goNext, menu, next, seekBy, setVol, toggleFullscreen, toggleMute, togglePlay, volume, sub, hlsSubs, external, defaultSubChoice]);

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
  const currentServer: ServerId = mode.kind === "direct" ? "vixsrc" : mode.server;
  const currentServerName = servers.find((s) => s.id === currentServer)?.name ?? (currentServer === "vixsrc" ? "Server 1" : "Server 2");
  const serverChoices: ServerOption[] = useMemo(() => {
    const list = [...servers];
    if (!list.some((s) => s.id === "vixsrc") && direct.ok) list.unshift({ id: "vixsrc", name: "Server 1 · Vix", kind: "direct", embed: "" });
    return list;
  }, [direct.ok, servers]);
  const hasSubs = external.length > 0 || hlsSubs.length > 0;

  // ------------------------------------------------------------ render: embed

  if (mode.kind === "embed") {
    const src = embedSrcFor(mode.server) ?? embedSrcFor("vixsrc") ?? "";
    return (
      <div ref={wrapRef} className="relative h-full w-full bg-black text-white">
        {src ? (
          <iframe
            key={src}
            src={src}
            title={title}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="origin"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white/80">No server can play this title right now.</div>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-3 bg-gradient-to-b from-black/80 via-black/30 to-transparent p-3 sm:p-4">
          <a href={backHref} className="vod-pill pointer-events-auto grid h-10 w-10 shrink-0 place-items-center" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="min-w-0 pt-1.5">
            <div className="truncate font-display text-[16px] leading-tight drop-shadow sm:text-[20px]" dir="auto">
              {title}
            </div>
            {subtitle && <div className="truncate text-[12px] text-white/75 drop-shadow">{subtitle}</div>}
          </div>
          <div className="pointer-events-auto relative ml-auto shrink-0">
            <button
              type="button"
              onClick={() => setMenu((m) => (m === "server" ? "none" : "server"))}
              className="vod-pill inline-flex h-10 items-center gap-2 px-3.5 text-[13px] font-semibold"
              aria-expanded={menu === "server"}
            >
              <Server className="h-4 w-4" aria-hidden /> {currentServerName}
              <ChevronRight className={`h-4 w-4 transition-transform ${menu === "server" ? "rotate-90" : ""}`} aria-hidden />
            </button>
            {menu === "server" && (
              <div className="vod-menu absolute right-0 top-12 w-64" role="menu">
                <div className="px-3 pb-1 pt-2.5 text-[11px] uppercase tracking-[.14em] text-white/50">Change server</div>
                <ul>
                  {serverChoices.map((s) => (
                    <Option
                      key={s.id}
                      label={s.name}
                      hint={s.kind === "direct" ? "our player · qualities" : "built-in player"}
                      selected={s.id === currentServer}
                      onClick={() => switchServer(s.id, { manual: true })}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        {notice && <Notice icon={<AlertTriangle className="h-3.5 w-3.5 text-accent" aria-hidden />}>{notice}</Notice>}
      </div>
    );
  }

  // ----------------------------------------------------------- render: direct

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
        className="vod-video-chrome absolute inset-0 h-full w-full"
        onClick={(e) => {
          e.stopPropagation();
          if (menu !== "none") {
            setMenu("none");
            return;
          }
          togglePlay();
        }}
      >
        {external.map((s, i) => (
          <track key={s.src} id={`ext-${i}`} kind="subtitles" src={s.src} srcLang={s.lang} label={s.label} default={sub === `ext-${i}`} />
        ))}
      </video>

      {/* Centre state: spinner / big play */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        {(waiting || !ready) && !ended ? (
          <span className="grid h-16 w-16 place-items-center rounded-full bg-black/40 backdrop-blur">
            <Loader2 className="h-9 w-9 animate-spin" aria-label="Loading" />
          </span>
        ) : !playing && !ended ? (
          <span className="vod-bigplay grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground sm:h-24 sm:w-24">
            <Play className="ml-1 h-10 w-10 fill-current sm:h-12 sm:w-12" aria-hidden />
          </span>
        ) : null}
        {toast && <span className="vod-chip absolute bottom-28 !px-3 !py-1 !text-[13px]">{toast}</span>}
      </div>

      {notice && <Notice icon={<Server className="h-3.5 w-3.5 text-accent" aria-hidden />}>{notice}</Notice>}

      {/* Ended: next episode or replay */}
      {ended && (
        <div className="absolute inset-0 grid place-items-center bg-black/75 p-6 backdrop-blur-sm">
          <div className="text-center">
            <div className="kicker text-white/70">{next ? "Up next" : "The end"}</div>
            {next ? (
              <>
                <div className="mt-2 font-display text-2xl sm:text-3xl">{next.label}</div>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button type="button" onClick={goNext} className="btn btn-primary glow-primary h-12 rounded-full px-6">
                    <SkipForward className="h-4 w-4" aria-hidden /> Play now{countdown !== null ? ` (${countdown})` : ""}
                  </button>
                  <button type="button" onClick={() => setCountdown(null)} className="vod-pill h-12 px-5 text-[14px] font-semibold">
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
                className="btn btn-primary glow-primary mt-6 h-12 rounded-full px-6"
              >
                <RotateCcw className="h-4 w-4" aria-hidden /> Watch again
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top bar */}
      <div
        className={`absolute inset-x-0 top-0 flex items-start gap-3 bg-gradient-to-b from-black/80 via-black/30 to-transparent p-3 transition-opacity duration-300 sm:p-4 ${chrome ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <a href={backHref} className="vod-pill grid h-10 w-10 shrink-0 place-items-center" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </a>
        <div className="min-w-0 pt-1.5">
          <div className="truncate font-display text-[17px] leading-tight drop-shadow sm:text-[22px]" dir="auto">
            {title}
          </div>
          {subtitle && <div className="truncate text-[12px] text-white/75 drop-shadow sm:text-[13px]">{subtitle}</div>}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {activeHeight && <span className="vod-chip hidden sm:inline-flex">{activeHeight}p</span>}
          {sub !== "off" && (
            <span className="vod-chip hidden sm:inline-flex">
              <Captions className="h-3 w-3" aria-hidden /> {subLabel}
            </span>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((m) => (m === "server" ? "none" : "server"))}
              className="vod-pill inline-flex h-10 items-center gap-2 px-3.5 text-[13px] font-semibold"
              aria-expanded={menu === "server"}
              aria-label="Change server"
            >
              <Server className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">{currentServerName}</span>
              <ChevronRight className={`h-4 w-4 transition-transform ${menu === "server" ? "rotate-90" : ""}`} aria-hidden />
            </button>
            {menu === "server" && (
              <div className="vod-menu absolute right-0 top-12 w-64" role="menu" onClick={(e) => e.stopPropagation()}>
                <div className="px-3 pb-1 pt-2.5 text-[11px] uppercase tracking-[.14em] text-white/50">Change server</div>
                <ul>
                  {serverChoices.map((s) => (
                    <Option
                      key={s.id}
                      label={s.name}
                      hint={s.kind === "direct" ? "our player · qualities" : "built-in player"}
                      selected={s.id === currentServer}
                      onClick={() => switchServer(s.id, { manual: true })}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Next episode pill during the last minute */}
      {showNext && !ended && next && (
        <button type="button" onClick={goNext} className="btn btn-primary glow-primary absolute bottom-24 right-4 rounded-full sm:bottom-28 sm:right-6">
          <SkipForward className="h-4 w-4" aria-hidden /> Next episode
        </button>
      )}

      {/* Bottom controls */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-3 pt-12 transition-opacity duration-300 sm:px-5 sm:pb-4 ${chrome ? "opacity-100" : "pointer-events-none opacity-0"}`}
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
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25 transition-[height] group-hover/bar:h-1.5">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/40" style={{ width: `${bufferedPct}%` }} />
            <div className="vod-progress absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <div
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-[0_0_0_4px_rgba(217,39,47,.45)] transition-opacity group-hover/bar:opacity-100"
            style={{ left: `${pct}%` }}
          />
          {hoverPct !== null && duration > 0 && (
            <span className="vod-chip pointer-events-none absolute -top-8 -translate-x-1/2 !bg-black/80" style={{ left: `${hoverPct * 100}%` }}>
              {formatClock(hoverPct * duration)}
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-1 sm:gap-2">
          <IconButton onClick={togglePlay} label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
          </IconButton>
          <IconButton onClick={() => seekBy(-SKIP_S)} label="Back 10 seconds">
            <RotateCcw className="h-5 w-5" />
          </IconButton>
          <IconButton onClick={() => seekBy(SKIP_S)} label="Forward 10 seconds">
            <RotateCw className="h-5 w-5" />
          </IconButton>

          <div className="group/vol flex items-center">
            <IconButton onClick={toggleMute} label={muted ? "Unmute" : "Mute"}>
              <VolumeIcon className="h-5 w-5" />
            </IconButton>
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
              <span className="hidden sm:block">
                <IconButton onClick={goNext} label="Next episode">
                  <SkipForward className="h-5 w-5" />
                </IconButton>
              </span>
            )}
            {hasSubs && (
              <IconButton onClick={() => setMenu((m) => (m === "subs" ? "none" : "subs"))} label="Subtitles" active={sub !== "off"}>
                <Captions className="h-5 w-5" />
              </IconButton>
            )}
            <div className="relative">
              <IconButton onClick={() => setMenu((m) => (m === "none" ? "root" : "none"))} label="Settings" expanded={menu !== "none" && menu !== "server"}>
                <Settings className={`h-5 w-5 transition-transform duration-300 ${menu !== "none" ? "rotate-90" : ""}`} />
              </IconButton>
              {menu !== "none" && menu !== "server" && (
                <div className="vod-menu absolute bottom-12 right-0 w-64" role="menu">
                  {menu === "root" && (
                    <ul className="py-1">
                      <MenuRow
                        icon={<Gauge className="h-4 w-4" aria-hidden />}
                        label="Quality"
                        value={rung === -1 ? `Auto${activeHeight ? ` · ${activeHeight}p` : ""}` : `${activeHeight ?? ""}p`}
                        onClick={() => setMenu("quality")}
                        disabled={!rungs.length}
                      />
                      <MenuRow
                        icon={<Languages className="h-4 w-4" aria-hidden />}
                        label="Audio"
                        value={audios.find((a) => a.id === audio)?.label ?? "Default"}
                        onClick={() => setMenu("audio")}
                        disabled={audios.length < 2}
                      />
                      <MenuRow icon={<Captions className="h-4 w-4" aria-hidden />} label="Subtitles" value={subLabel} onClick={() => setMenu("subs")} disabled={!hasSubs} />
                      <MenuRow icon={<MonitorPlay className="h-4 w-4" aria-hidden />} label="Speed" value={speed === 1 ? "Normal" : `${speed}×`} onClick={() => setMenu("speed")} />
                      <MenuRow icon={<Server className="h-4 w-4" aria-hidden />} label="Server" value={currentServerName} onClick={() => setMenu("server")} />
                    </ul>
                  )}
                  {menu === "quality" && (
                    <SubMenu title="Quality" onBack={() => setMenu("root")}>
                      <Option label="Auto" hint={activeHeight ? `${activeHeight}p now` : undefined} selected={rung === -1} onClick={() => pickRung(-1)} />
                      {rungs.map((r) => (
                        <Option
                          key={r.index}
                          label={`${r.height}p${r.height >= 2160 ? " · 4K" : r.height >= 1080 ? " · Full HD" : r.height >= 720 ? " · HD" : ""}`}
                          hint={r.bitrate ? `${(r.bitrate / 1_000_000).toFixed(1)} Mbps` : undefined}
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
                      <Option label="Off" selected={sub === "off"} onClick={() => pickSub("off")} />
                      {external.map((s: SubtitleTrack, i) => (
                        <Option key={s.src} label={s.label} hint={s.hearingImpaired ? "SDH" : undefined} selected={sub === `ext-${i}`} onClick={() => pickSub(`ext-${i}`)} />
                      ))}
                      {hlsSubs.map((s) => (
                        <Option key={`h${s.id}`} label={s.label} hint="in stream" selected={sub === `hls-${s.id}`} onClick={() => pickSub(`hls-${s.id}`)} />
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
            <IconButton onClick={toggleFullscreen} label={fullscreen ? "Exit full screen" : "Full screen"}>
              {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center px-4 sm:top-[4.5rem]">
      <span className="vod-pill inline-flex max-w-full items-center gap-2 px-3.5 py-2 text-[12px] sm:text-[13px]">
        {icon}
        <span className="truncate">{children}</span>
      </span>
    </div>
  );
}

function IconButton({ onClick, label, children, active, expanded }: { onClick: () => void; label: string; children: ReactNode; active?: boolean; expanded?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-white/15 ${active ? "text-white" : "text-white/90"}`}
      aria-label={label}
      title={label}
      aria-expanded={expanded}
    >
      {children}
      {active && <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-primary" aria-hidden />}
    </button>
  );
}

function MenuRow({ icon, label, value, onClick, disabled }: { icon?: ReactNode; label: string; value: string; onClick: () => void; disabled?: boolean }) {
  return (
    <li>
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        disabled={disabled}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <span className="inline-flex items-center gap-2.5">
          {icon && <span className="text-white/70">{icon}</span>}
          {label}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1 text-[13px] text-white/60">
          <span className="truncate">{value}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </span>
      </button>
    </li>
  );
}

function SubMenu({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div>
      <button type="button" onClick={onBack} className="flex w-full items-center gap-2 border-b border-white/10 px-3 py-2.5 text-left font-semibold hover:bg-white/10">
        <ChevronLeft className="h-4 w-4" aria-hidden /> {title}
      </button>
      <ul className="max-h-64 overflow-y-auto py-1">{children}</ul>
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
          <Check className={`h-4 w-4 text-primary ${selected ? "opacity-100" : "opacity-0"}`} aria-hidden /> {label}
        </span>
        {hint && <span className="font-mono text-[11px] text-white/50">{hint}</span>}
      </button>
    </li>
  );
}
