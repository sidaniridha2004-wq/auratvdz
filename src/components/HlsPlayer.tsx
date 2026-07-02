import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { RefreshCw, AlertTriangle, ExternalLink, Settings, Check, Wifi, Zap } from "lucide-react";

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
// Streams pass through /api/public/stream (which may cold-start) and some HLS
// manifests + init segments are slow to arrive on mobile networks. Keep this
// generous — a false "unavailable" error is worse than a longer spinner.
const LOAD_TIMEOUT_MS = 25000;

interface Level {
  index: number;
  height: number;
  bitrate: number;
  label: string;
}

export function HlsPlayer({ src, rawUrl, preferredHeight, sources, mirrors }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retriesRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryNonce, setRetryNonce] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [mirrorIdx, setMirrorIdx] = useState(-1); // -1 = original

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
  const baseSrc = sources && sources.length ? sources[sourceIdx]?.url : src;
  const effectiveSrc = mirrorIdx >= 0 && mirrors && mirrors[mirrorIdx] ? mirrors[mirrorIdx] : baseSrc;

  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [activeHeight, setActiveHeight] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
    const onLoaded = () => {
      if (!cancelled) {
        setLoading(false);
        retriesRef.current = 0;
      }
    };
    const onStall = () => {
      console.warn(`[player] stall waiting at t=${video.currentTime.toFixed(2)}s`);
    };
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("waiting", onStall);

    // 8s hard timeout on initial load
    const loadTimer = setTimeout(() => {
      if (cancelled || !loading) return;
      if (video.readyState < 2) {
        setError("Stream temporarily unavailable — try another server");
        setLoading(false);
      }
    }, LOAD_TIMEOUT_MS);

    const scheduleRetry = (reason: string) => {
      if (cancelled) return;
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
        lowLatencyMode: true,
        capLevelToPlayerSize: true,
        abrEwmaDefaultEstimate: 1_000_000,
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
        fragLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 500,
        levelLoadingRetryDelay: 500,
        fragLoadingRetryDelay: 500,
      });
      hlsRef.current = hls;
      hls.loadSource(effectiveSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
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
        console.warn(`[player] hls ${data.fatal ? "FATAL" : "warn"} type=${data.type} details=${data.details}`);
        if (!data.fatal) return;
        const type = data.type;
        if (type === Hls.ErrorTypes.NETWORK_ERROR) {
          try { hls.startLoad(); return; } catch { scheduleRetry("Network error reaching the stream."); }
        } else if (type === Hls.ErrorTypes.MEDIA_ERROR) {
          try { hls.recoverMediaError(); return; } catch { scheduleRetry("Playback decoder error."); }
        } else {
          scheduleRetry("Stream temporarily unavailable — try another server");
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = effectiveSrc;
      const onErr = () => scheduleRetry("Stream temporarily unavailable — try another server");
      video.addEventListener("error", onErr);
      return () => {
        cancelled = true;
        clearTimeout(loadTimer);
        video.removeEventListener("loadeddata", onLoaded);
        video.removeEventListener("waiting", onStall);
        video.removeEventListener("error", onErr);
      };
    } else {
      setError("HLS playback is not supported in this browser.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
      clearTimeout(loadTimer);
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("waiting", onStall);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-card ring-1 ring-white/5">
        <video ref={videoRef} controls autoPlay playsInline className="h-full w-full bg-black" />

        {/* Quality selector overlay with label */}
        {!error && (sourceMode || levels.length > 0) && (
          <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1">
            <div className="rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/80 backdrop-blur">
              Select Quality ▾
            </div>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              title="Higher quality requires faster internet."
              className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/90"
            >
              <Settings className="h-3.5 w-3.5" />
              {sourceMode ? activeSourceLabel : currentLabel}
            </button>
            {menuOpen && (
              <div className="mt-1 w-52 overflow-hidden rounded-xl border border-white/10 bg-black/95 py-1 text-sm text-white shadow-xl backdrop-blur">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/50">
                  Higher quality = faster net
                </div>
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

        {/* Shimmer skeleton while loading */}
        {loading && !error && (
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5" />
            <div className="absolute inset-y-0 -left-full w-1/2 animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              {retrying && (
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Reconnecting… {retriesRef.current}/{MAX_AUTO_RETRIES}
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold">{error}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Try a mirror server, or open the raw stream externally.
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button onClick={tryMirror} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
                <Zap className="h-4 w-4" /> Try Mirror Server
              </button>
              <button onClick={manualRetry} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/10">
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
              {rawUrl && (
                <a href={rawUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-card/60 px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary">
                  <ExternalLink className="h-4 w-4" /> Open in VLC
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
