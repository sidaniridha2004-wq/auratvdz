import { useEffect, useRef, useState, useCallback, type MouseEvent } from "react";
import Hls from "hls.js";
import { RefreshCw, AlertTriangle, Settings, Check, Wifi, Zap, ArrowLeft, Maximize, Minimize } from "lucide-react";
import { isAndroidTV, isCapacitor } from "@/lib/tv-navigation";

export interface QualitySource {
  label: string;
  url: string;
  height?: number;
}

interface Props {
  src?: string;
  /** Direct (unproxied) URL used as a last-resort fallback. Never shown to the user. */
  rawUrl?: string;
  preferredHeight?: number;
  sources?: QualitySource[];
  mirrors?: string[];
  title?: string;
}

const MAX_AUTO_RETRIES = 3;
const LOAD_TIMEOUT_MS = 25000;

interface Level {
  index: number;
  height: number;
  bitrate: number;
  label: string;
}

type CapacitorLike = {
  Plugins?: {
    StatusBar?: { hide: () => Promise<void>; show: () => Promise<void> };
    ScreenOrientation?: { lock: (o: { orientation: string }) => Promise<void>; unlock: () => Promise<void> };
  };
};
type OrientationLike = { lock?: (o: string) => Promise<void>; unlock?: () => void };

function capacitor(): CapacitorLike | undefined {
  return typeof window === "undefined" ? undefined : (window as unknown as { Capacitor?: CapacitorLike }).Capacitor;
}
function orientation(): OrientationLike | undefined {
  return typeof screen === "undefined" ? undefined : (screen.orientation as unknown as OrientationLike | undefined);
}

export function HlsPlayer({ src, rawUrl, preferredHeight, sources, mirrors, title }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retriesRef = useRef(0);
  // Set once the rung the viewer asked for has failed, so the next reload
  // falls back to auto instead of pinning a dead feed again.
  const pinBrokenRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryNonce, setRetryNonce] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [mirrorIdx, setMirrorIdx] = useState(-1);
  const [buffering, setBuffering] = useState(false);

  const initialSourceIdx = (() => {
    if (!sources || sources.length === 0) return 0;
    if (preferredHeight) {
      const withH = sources.map((s, i) => ({ i, h: s.height ?? 0 })).filter((x) => x.h > 0);
      if (withH.length) {
        return withH.reduce((a, b) => (Math.abs(a.h - preferredHeight) <= Math.abs(b.h - preferredHeight) ? a : b)).i;
      }
    }
    const ranked = sources.map((s, i) => ({ i, h: s.height ?? 0 })).sort((a, b) => b.h - a.h);
    return ranked[0]?.i ?? 0;
  })();
  const [sourceIdx, setSourceIdx] = useState<number>(initialSourceIdx);
  const [useRaw, setUseRaw] = useState(false);
  const baseSrc = sources && sources.length ? sources[sourceIdx]?.url : src;
  const proxiedSrc = mirrorIdx >= 0 && mirrors && mirrors[mirrorIdx] ? mirrors[mirrorIdx] : baseSrc;
  const effectiveSrc = useRaw && rawUrl ? rawUrl : proxiedSrc;

  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [activeHeight, setActiveHeight] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [cssFullscreen] = useState(() => (typeof window !== "undefined" ? isAndroidTV() || isCapacitor() : false));

  const [isIdle, setIsIdle] = useState(false);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleTimer = useCallback(() => {
    setIsIdle(false);
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(() => {
      setIsIdle(true);
      setMenuOpen(false);
    }, 3000);
  }, []);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [resetIdleTimer]);

  // Native app / TV: go landscape + immersive on mount, restore on unmount.
  useEffect(() => {
    if (!cssFullscreen) return;
    const cap = capacitor();
    if (cap?.Plugins) {
      cap.Plugins.StatusBar?.hide().catch(() => {});
      document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
      cap.Plugins.ScreenOrientation?.lock({ orientation: "landscape" }).catch(() => {});
    } else {
      orientation()?.lock?.("landscape").catch(() => {});
    }
    return () => {
      const c = capacitor();
      if (c?.Plugins) {
        c.Plugins.ScreenOrientation?.unlock().catch(() => {});
        c.Plugins.StatusBar?.show().catch(() => {});
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      } else {
        try {
          orientation()?.unlock?.();
        } catch {
          /* not supported */
        }
      }
    };
  }, [cssFullscreen]);

  useEffect(() => {
    const onChange = () => setNativeFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async (e: MouseEvent) => {
    e.stopPropagation();
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen?.();
        setNativeFullscreen(true);
        await orientation()?.lock?.("landscape").catch(() => {});
      } else {
        await document.exitFullscreen?.();
        setNativeFullscreen(false);
        try {
          orientation()?.unlock?.();
        } catch {
          /* not supported */
        }
      }
    } catch {
      // Fullscreen can be refused (iframe, no user gesture). Nothing to report.
    }
  };

  const manualRetry = useCallback(() => {
    retriesRef.current = 0;
    pinBrokenRef.current = false;
    setError(null);
    setLoading(true);
    setRetryNonce((n) => n + 1);
  }, []);

  const tryMirror = useCallback(() => {
    if (!mirrors || mirrors.length === 0) return manualRetry();
    setMirrorIdx((i) => (i + 1) % mirrors.length);
    manualRetry();
  }, [mirrors, manualRetry]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !effectiveSrc) return;
    setError(null);
    setLoading(true);
    setRetrying(false);
    setLevels([]);
    setCurrentLevel(-1);
    setActiveHeight(null);

    let cancelled = false;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    const clearLoadTimer = () => {
      if (loadTimer) clearTimeout(loadTimer);
      loadTimer = undefined;
    };
    const onCanPlay = () => {
      if (cancelled) return;
      setLoading(false);
      setBuffering(false);
      retriesRef.current = 0;
      clearLoadTimer();
    };
    const onStall = () => !cancelled && setBuffering(true);
    const onPlaying = () => {
      if (cancelled) return;
      setBuffering(false);
      if (video.muted) video.muted = false;
    };

    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("canplaythrough", onCanPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onStall);
    video.addEventListener("stalled", onStall);

    loadTimer = setTimeout(() => {
      if (cancelled) return;
      if (video.readyState < 2) {
        setError("This stream is not responding right now.");
        setLoading(false);
      }
    }, LOAD_TIMEOUT_MS);

    const scheduleRetry = (reason: string) => {
      if (cancelled) return;
      if (!useRaw && rawUrl) {
        setUseRaw(true);
        setRetryNonce((n) => n + 1);
        return;
      }
      if (retriesRef.current < MAX_AUTO_RETRIES) {
        retriesRef.current += 1;
        setRetrying(true);
        const delay = 800 * retriesRef.current;
        setTimeout(() => {
          if (!cancelled) setRetryNonce((n) => n + 1);
        }, delay);
      } else {
        setRetrying(false);
        setError(reason);
        setLoading(false);
      }
    };

    let onErr: (() => void) | undefined;
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        // Never cap by player size: a small window used to pin every stream to
        // 720p even after the viewer picked 1080p from the quality menu.
        capLevelToPlayerSize: false,
        maxBufferLength: 30,
        // Segment links are signed and expire; a few quick retries cover the
        // gap while the master playlist is refreshed.
        fragLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
        manifestLoadingMaxRetry: 2,
        progressive: true,
        // Assume a decent connection so auto mode opens around 720p and
        // climbs, instead of starting on the lowest rung every time.
        abrEwmaDefaultEstimate: 2_500_000,
      });
      hlsRef.current = hls;
      hls.loadSource(effectiveSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        clearLoadTimer();
        const ls: Level[] = (data.levels || []).map((l, i) => ({
          index: i,
          height: l.height ?? 0,
          bitrate: l.bitrate ?? 0,
          label: l.height ? `${l.height}p` : `${Math.round((l.bitrate ?? 0) / 1000)} kbps`,
        }));
        setLevels(ls);
        if (!sources && preferredHeight && !pinBrokenRef.current && ls.length > 0) {
          // Pin the rung the viewer picked (a channel opened from a "1080"
          // category plays 1080p); the menu still lists every other rung.
          const withHeight = ls.filter((l) => l.height > 0);
          if (withHeight.length > 0) {
            const best = withHeight.reduce((a, b) =>
              Math.abs(a.height - preferredHeight) <= Math.abs(b.height - preferredHeight) ? a : b,
            );
            hls.startLevel = best.index;
            hls.currentLevel = best.index;
            setCurrentLevel(best.index);
            setActiveHeight(best.height);
          }
        }
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        const lvl = hls.levels?.[data.level];
        if (lvl) setActiveHeight(lvl.height ?? null);
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        // Media errors (codec hiccups) can usually be recovered in place;
        // anything else reloads from the master so expired links are re-minted.
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retriesRef.current < MAX_AUTO_RETRIES) {
          retriesRef.current += 1;
          hls.recoverMediaError();
          return;
        }
        // A pinned rung that keeps failing should not be pinned again; let
        // the reload pick from whatever rungs are still alive.
        if (hls.currentLevel !== -1 && !hls.autoLevelEnabled) pinBrokenRef.current = true;
        scheduleRetry("Stream unavailable.");
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = effectiveSrc;
      onErr = () => scheduleRetry("Stream unavailable.");
      video.addEventListener("error", onErr);
    } else {
      setError("Your browser cannot play HLS video.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
      clearLoadTimer();
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("canplaythrough", onCanPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onStall);
      video.removeEventListener("stalled", onStall);
      if (onErr) video.removeEventListener("error", onErr);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [effectiveSrc, retryNonce, preferredHeight, sources, rawUrl, useRaw]);

  const pickLevel = (idx: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.autoLevelCapping = -1;
    hls.nextLevel = idx;
    hls.currentLevel = idx;
    setCurrentLevel(idx);
    setMenuOpen(false);
  };
  const pickSource = (idx: number) => {
    setSourceIdx(idx);
    setMenuOpen(false);
  };

  const sourceMode = !!(sources && sources.length);
  const activeSourceLabel = sourceMode ? sources![sourceIdx]?.label : null;
  const autoLabel = activeHeight ? `Auto · ${activeHeight}p` : "Auto";
  const currentLabel = currentLevel === -1 ? autoLabel : (levels.find((l) => l.index === currentLevel)?.label ?? "—");

  const containerClass = cssFullscreen ? "fixed inset-0 z-[100] flex flex-col bg-black" : "";
  const videoWrapperClass = cssFullscreen
    ? "relative h-full w-full flex-1 bg-black"
    : "relative aspect-video w-full overflow-hidden rounded-md bg-black rule";

  const pill = "inline-flex items-center gap-1.5 bg-black/75 px-2.5 py-1 text-[12px] text-white";
  const menuItem = "flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-white/10";

  return (
    <div className={containerClass}>
      <div
        ref={containerRef}
        className={videoWrapperClass}
        onMouseMove={resetIdleTimer}
        onTouchStart={resetIdleTimer}
        onClick={resetIdleTimer}
      >
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          muted
          aria-label={title ? `${title} live video` : "Live video"}
          className="h-full w-full bg-black"
        />

        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${isIdle && !menuOpen && !loading && !error ? "opacity-0" : "opacity-100"}`}
        >
          {cssFullscreen && (
            <button
              type="button"
              aria-label="Back"
              onClick={() => window.history.back()}
              className="pointer-events-auto absolute left-4 top-4 z-[110] bg-black/60 p-2 text-white"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
          )}

          <div className="pointer-events-auto absolute right-3 top-3 z-10 flex items-start gap-2">
            {!error && (sourceMode || levels.length > 0) && (
              <div className="flex flex-col items-end gap-1">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((v) => !v);
                    resetIdleTimer();
                  }}
                  className={pill}
                >
                  <Settings className="h-3.5 w-3.5" aria-hidden />
                  {sourceMode ? activeSourceLabel : currentLabel}
                </button>
                {menuOpen && (
                  <div role="menu" className="mt-1 w-48 bg-black/95 py-1 text-white rule">
                    <div className="kicker px-3 py-1.5 text-white/60">Quality</div>
                    {sourceMode ? (
                      sources!.map((s, i) => (
                        <button key={`${s.label}-${i}`} type="button" role="menuitem" onClick={() => pickSource(i)} className={menuItem}>
                          <span>{s.label}</span>
                          {sourceIdx === i && <Check className="h-3.5 w-3.5" aria-hidden />}
                        </button>
                      ))
                    ) : (
                      <>
                        <button type="button" role="menuitem" onClick={() => pickLevel(-1)} className={menuItem}>
                          <span className="flex items-center gap-2">
                            <Wifi className="h-3.5 w-3.5" aria-hidden /> Auto
                          </span>
                          {currentLevel === -1 && <Check className="h-3.5 w-3.5" aria-hidden />}
                        </button>
                        {[...levels]
                          .sort((a, b) => b.height - a.height)
                          .map((l) => (
                            <button key={l.index} type="button" role="menuitem" onClick={() => pickLevel(l.index)} className={menuItem}>
                              <span>{l.label}</span>
                              {currentLevel === l.index && <Check className="h-3.5 w-3.5" aria-hidden />}
                            </button>
                          ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {!cssFullscreen && (
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={nativeFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                className={pill}
              >
                {nativeFullscreen ? <Minimize className="h-4 w-4" aria-hidden /> : <Maximize className="h-4 w-4" aria-hidden />}
              </button>
            )}
          </div>

          {loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black" role="status">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <div className="kicker text-white/70">
                {retrying ? `Reconnecting ${retriesRef.current}/${MAX_AUTO_RETRIES}` : "Loading stream"}
              </div>
            </div>
          )}

          {!loading && !error && buffering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40" role="status">
              <div className={`${pill} kicker`}>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Buffering
              </div>
            </div>
          )}

          {!loading && !error && (
            <div className={`absolute left-3 top-3 z-10 ${pill} kicker`}>
              <span className="live-dot" aria-hidden /> Live
            </div>
          )}

          {error && (
            <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center text-white" role="alert">
              <AlertTriangle className="h-8 w-8 text-accent" aria-hidden />
              <div>
                <div className="font-semibold">{error}</div>
                <div className="mt-1 text-[13px] text-white/70">Try another server or come back in a minute.</div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button type="button" onClick={tryMirror} className="btn btn-primary btn-sm">
                  <Zap className="h-4 w-4" aria-hidden /> Try another server
                </button>
                <button type="button" onClick={manualRetry} className="btn btn-sm border-white/40 text-white hover:border-white">
                  <RefreshCw className="h-4 w-4" aria-hidden /> Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
