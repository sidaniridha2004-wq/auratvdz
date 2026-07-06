import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { RefreshCw, AlertTriangle, ExternalLink, Settings, Check, Wifi, Zap, ArrowLeft, Maximize, Minimize } from "lucide-react";

/** Detect Android TV via user agent or lack of touch + large screen. */
function isAndroidTV(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android") && (ua.includes(" tv") || ua.includes("aft"))) return true;
  if (window.matchMedia("(pointer: none)").matches && window.innerWidth >= 960) return true;
  return false;
}

/** Detect if running inside Capacitor WebView. */
function isCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).Capacitor;
}

export interface QualitySource {
  label: string;
  url: string;
  height?: number;
}

interface Props {
  src?: string;
  rawUrl?: string;
  preferredHeight?: number;
  sources?: QualitySource[];
  /** Optional list of fallback source URLs to try when the primary fails. */
  mirrors?: string[];
}

const MAX_AUTO_RETRIES = 3;
const LOAD_TIMEOUT_MS = 25000;

interface Level {
  index: number;
  height: number;
  bitrate: number;
  label: string;
}

export function HlsPlayer({ src, rawUrl, preferredHeight, sources, mirrors }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retriesRef = useRef(0);
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
        return withH.reduce((a, b) =>
          Math.abs(a.h - preferredHeight) <= Math.abs(b.h - preferredHeight) ? a : b,
        ).i;
      }
    }
    const ranked = sources.map((s, i) => ({ i, h: s.height ?? 0 })).sort((a, b) => b.h - a.h);
    return ranked[0]?.i ?? 0;
  })();
  const [sourceIdx, setSourceIdx] = useState<number>(initialSourceIdx);
  const [useRaw, setUseRaw] = useState(false);
  const baseSrc = sources && sources.length ? sources[sourceIdx]?.url : src;
  const proxiedSrc = mirrorIdx >= 0 && mirrors && mirrors[mirrorIdx] ? mirrors[mirrorIdx] : baseSrc;
  const effectiveSrc = (useRaw && rawUrl) ? rawUrl : proxiedSrc;

  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [activeHeight, setActiveHeight] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [cssFullscreen, setCssFullscreen] = useState(() => {
    if (typeof window !== "undefined") {
      return isAndroidTV() || isCapacitor();
    }
    return false;
  });

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

  // Enter landscape automatically on mount for native apps and TVs
  useEffect(() => {
    if (cssFullscreen) {
      const cap = (window as any).Capacitor;
      if (cap && cap.Plugins) {
        // Hide status bar via Capacitor plugin
        if (cap.Plugins.StatusBar) cap.Plugins.StatusBar.hide().catch(() => {});
        // Request document fullscreen to trigger Android immersive mode
        // (hides both the status bar AND the bottom navigation/home bar)
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
        }
        if (cap.Plugins.ScreenOrientation) cap.Plugins.ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {});
      } else {
        try {
          if (screen.orientation && 'lock' in screen.orientation) {
            (screen.orientation.lock as any)('landscape').catch(() => {});
          }
        } catch (e) {}
      }
    }

    return () => {
      const cap = (window as any).Capacitor;
      if (cap && cap.Plugins) {
        if (cap.Plugins.ScreenOrientation) cap.Plugins.ScreenOrientation.unlock().catch(() => {});
        if (cap.Plugins.StatusBar) cap.Plugins.StatusBar.show().catch(() => {});
        // Exit fullscreen when leaving the player
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } else {
        try {
          if (screen.orientation && 'unlock' in screen.orientation) {
            screen.orientation.unlock();
          }
        } catch (e) {}
      }
    };
  }, [cssFullscreen]);
  
  useEffect(() => {
    const onFullscreenChange = () => {
      setNativeFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
          setNativeFullscreen(true);
          try {
            if (screen.orientation && (screen.orientation as any).lock) {
              await (screen.orientation as any).lock("landscape");
            }
          } catch (err) {}
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setNativeFullscreen(false);
          try {
            if (screen.orientation && (screen.orientation as any).unlock) {
              (screen.orientation as any).unlock();
            }
          } catch (err) {}
        }
      }
    } catch (err) {
      console.error("Fullscreen toggle failed:", err);
    }
  };

  const manualRetry = useCallback(() => {
    retriesRef.current = 0;
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
      if (loadTimer) { clearTimeout(loadTimer); loadTimer = undefined; }
    };
    const onCanPlay = () => {
      if (!cancelled) {
        setLoading(false);
        setBuffering(false);
        retriesRef.current = 0;
        clearLoadTimer();
      }
    };
    const onStall = () => {
      if (!cancelled) setBuffering(true);
    };
    const onPlaying = () => {
      if (!cancelled) {
        setBuffering(false);
        // Unmute immediately after autoplay starts — browser allows muted autoplay,
        // so we start muted and unmute the instant playback begins.
        if (video.muted) video.muted = false;
      }
    };
    const onWaiting = () => { if (!cancelled) setBuffering(true); };

    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("canplaythrough", onCanPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onStall);

    loadTimer = setTimeout(() => {
      if (cancelled) return;
      if (video.readyState < 2) {
        setError("Stream temporarily unavailable — try another server");
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

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        capLevelToPlayerSize: true,
        maxBufferLength: 30,
        abrEwmaDefaultEstimate: 400000, // Assume 400kbps connection initially to force fastest/lowest quality stream to load first
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
          label: l.height ? `${l.height}p` : `${Math.round((l.bitrate ?? 0) / 1000)}kbps`,
        }));
        setLevels(ls);
        if (!sources && preferredHeight && ls.length > 0) {
          const withHeight = ls.filter((l) => l.height > 0);
          if (withHeight.length > 0) {
            const best = withHeight.reduce((a, b) =>
              Math.abs(a.height - preferredHeight) <= Math.abs(b.height - preferredHeight) ? a : b,
            );
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
        scheduleRetry("Stream unavailable.");
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = effectiveSrc;
      const onErr = () => scheduleRetry("Stream unavailable.");
      video.addEventListener("error", onErr);
      return () => {
        cancelled = true;
        clearLoadTimer();
        video.removeEventListener("canplay", onCanPlay);
        video.removeEventListener("canplaythrough", onCanPlay);
        video.removeEventListener("playing", onPlaying);
        video.removeEventListener("waiting", onWaiting);
        video.removeEventListener("stalled", onStall);
        video.removeEventListener("error", onErr);
      };
    } else {
      setError("HLS playback not supported.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
      clearLoadTimer();
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("canplaythrough", onCanPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onStall);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [effectiveSrc, retryNonce, preferredHeight, sources]);

  const pickLevel = (idx: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = idx;
    setCurrentLevel(idx);
    setMenuOpen(false);
  };
  const pickSource = (idx: number) => { setSourceIdx(idx); setMenuOpen(false); };

  const sourceMode = !!(sources && sources.length);
  const activeSourceLabel = sourceMode ? sources![sourceIdx]?.label : null;
  const autoLabel = activeHeight ? `Auto · ${activeHeight}p` : "Auto";
  const currentLabel = currentLevel === -1 ? autoLabel : (levels.find((l) => l.index === currentLevel)?.label ?? "—");

  const containerClass = cssFullscreen ? "fixed inset-0 z-[100] flex flex-col bg-black" : "space-y-3";
  const videoWrapperClass = cssFullscreen ? "relative w-full h-full flex-1 bg-black" : "relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-card ring-1 ring-white/5";

  return (
    <div className={containerClass}>
      <div 
        ref={containerRef}
        className={videoWrapperClass}
        onMouseMove={resetIdleTimer}
        onTouchStart={resetIdleTimer}
        onClick={resetIdleTimer}
      >
        <video ref={videoRef} controls autoPlay playsInline muted className="h-full w-full bg-black" />

        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${isIdle && !menuOpen && !loading && !error ? "opacity-0" : "opacity-100"}`}>
          {cssFullscreen && (
            <button
              onClick={() => window.history.back()}
              className="pointer-events-auto absolute left-4 top-4 z-[110] rounded-full bg-black/50 p-2 text-white hover:bg-black/80 backdrop-blur"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
          )}

          <div className="pointer-events-auto absolute right-3 top-3 z-10 flex gap-2">
            {!error && (sourceMode || levels.length > 0) && (
              <div className="flex flex-col items-end gap-1">
                <div className="rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/80 backdrop-blur">
                  Quality ▾
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); resetIdleTimer(); }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/90 focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Settings className="h-3.5 w-3.5" />
                  {sourceMode ? activeSourceLabel : currentLabel}
                </button>
                {menuOpen && (
                  <div className="mt-1 w-52 overflow-hidden rounded-xl border border-white/10 bg-black/95 py-1 text-sm text-white shadow-xl backdrop-blur">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/50">Quality Settings</div>
                    {sourceMode ? (
                      sources!.map((s, i) => (
                        <button key={`${s.label}-${i}`} onClick={() => pickSource(i)}
                                className={`flex w-full items-center justify-between px-3 py-2 hover:bg-white/10 ${sourceIdx === i ? "bg-primary/20" : ""}`}>
                          <span>{s.label}</span>
                          {sourceIdx === i && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      ))
                    ) : (
                      <>
                        <button onClick={() => pickLevel(-1)}
                                className={`flex w-full items-center justify-between px-3 py-2 hover:bg-white/10 ${currentLevel === -1 ? "bg-primary/20" : ""}`}>
                          <span className="flex items-center gap-2"><Wifi className="h-3.5 w-3.5" /> Auto</span>
                          {currentLevel === -1 && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                        <div className="my-1 h-px bg-white/10" />
                        {[...levels].sort((a, b) => b.height - a.height).map((l) => (
                          <button key={l.index} onClick={() => pickLevel(l.index)}
                                  className={`flex w-full items-center justify-between px-3 py-2 hover:bg-white/10 ${currentLevel === l.index ? "bg-primary/20" : ""}`}>
                            <span>{l.label}</span>
                            {currentLevel === l.index && <Check className="h-3.5 w-3.5 text-primary" />}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {!cssFullscreen && (
              <div className="flex flex-col items-end gap-1">
                <div className="rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/80 backdrop-blur">
                  {nativeFullscreen ? "Exit" : "Expand"}
                </div>
                <button
                  onClick={toggleFullscreen}
                  className="inline-flex items-center justify-center rounded-full bg-black/70 p-1.5 text-white backdrop-blur hover:bg-black/90 focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {nativeFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </button>
              </div>
            )}
          </div>

          {loading && !error && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none bg-black">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <div className="text-xs uppercase tracking-[0.22em] text-white/70">
                  {retrying ? `Reconnecting… ${retriesRef.current}/${MAX_AUTO_RETRIES}` : "Loading stream"}
                </div>
              </div>
            </div>
          )}

          {!loading && !error && buffering && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white shadow-glow">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Buffering…
              </div>
            </div>
          )}

          {!loading && !error && (
            <div className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur">
              <span className="live-dot" /> Live
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center pointer-events-auto">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <div className="font-semibold">{error}</div>
                <div className="mt-1 text-sm text-muted-foreground">Try a mirror server or open externally.</div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button onClick={tryMirror} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                  <Zap className="h-4 w-4" /> Try Mirror
                </button>
                <button onClick={manualRetry} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/10">
                  <RefreshCw className="h-4 w-4" /> Retry
                </button>
                {rawUrl && (
                  <a href={rawUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-card/60 px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary">
                    <ExternalLink className="h-4 w-4" /> VLC
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
