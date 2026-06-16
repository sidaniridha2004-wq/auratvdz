import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { RefreshCw, AlertTriangle, ExternalLink, Settings, Check, Wifi } from "lucide-react";

export interface QualitySource {
  label: string;
  url: string;
  height?: number;
}

interface Props {
  src?: string;
  rawUrl?: string;
  /**
   * If set, on first manifest parse we lock playback to the variant whose
   * height matches (or is closest to) this value instead of letting ABR pick.
   */
  preferredHeight?: number;
  /**
   * If provided, the player switches between these explicit source URLs
   * instead of relying on a single HLS master's ABR ladder. Used for
   * AuraTV JSON channels where each quality is its own playlist.
   */
  sources?: QualitySource[];
}

const MAX_AUTO_RETRIES = 3;

interface Level {
  index: number;
  height: number;
  bitrate: number;
  label: string;
}

export function HlsPlayer({ src, rawUrl, preferredHeight, sources }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retriesRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryNonce, setRetryNonce] = useState(0);
  const [retrying, setRetrying] = useState(false);

  // Source-mode: pick an initial source index (preferred height, else best)
  const initialSourceIdx = (() => {
    if (!sources || sources.length === 0) return 0;
    if (preferredHeight) {
      const withH = sources
        .map((s, i) => ({ i, h: s.height ?? 0 }))
        .filter((x) => x.h > 0);
      if (withH.length) {
        return withH.reduce((a, b) =>
          Math.abs(a.h - preferredHeight) <= Math.abs(b.h - preferredHeight) ? a : b,
        ).i;
      }
    }
    // highest height first, else first
    const ranked = sources
      .map((s, i) => ({ i, h: s.height ?? 0 }))
      .sort((a, b) => b.h - a.h);
    return ranked[0]?.i ?? 0;
  })();
  const [sourceIdx, setSourceIdx] = useState<number>(initialSourceIdx);
  const effectiveSrc = sources && sources.length ? sources[sourceIdx]?.url : src;

  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 = auto
  const [activeHeight, setActiveHeight] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const manualRetry = useCallback(() => {
    retriesRef.current = 0;
    setError(null);
    setLoading(true);
    setRetryNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
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
    video.addEventListener("loadeddata", onLoaded);

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
        // Adaptive bitrate – let hls.js pick & switch automatically
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
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        const ls: Level[] = (data.levels || []).map((l, i) => ({
          index: i,
          height: l.height ?? 0,
          bitrate: l.bitrate ?? 0,
          label: l.height ? `${l.height}p` : `${Math.round((l.bitrate ?? 0) / 1000)}kbps`,
        }));
        setLevels(ls);

        // Lock to a preferred rung when caller asks for it (e.g. beIN MAX
        // streams whose 1080p label often points at a different feed).
        if (preferredHeight && ls.length > 0) {
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
        const type = data.type;
        if (type === Hls.ErrorTypes.NETWORK_ERROR) {
          try {
            hls.startLoad();
            return;
          } catch {
            scheduleRetry("Network error reaching the stream.");
          }
        } else if (type === Hls.ErrorTypes.MEDIA_ERROR) {
          try {
            hls.recoverMediaError();
            return;
          } catch {
            scheduleRetry("Playback decoder error.");
          }
        } else {
          scheduleRetry("This stream is currently unavailable.");
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      const onErr = () => scheduleRetry("This stream is currently unavailable.");
      video.addEventListener("error", onErr);
      return () => {
        cancelled = true;
        video.removeEventListener("loadeddata", onLoaded);
        video.removeEventListener("error", onErr);
      };
    } else {
      setError("HLS playback is not supported in this browser.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", onLoaded);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src, retryNonce, preferredHeight]);

  const pickLevel = (idx: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = idx; // -1 means auto
    setCurrentLevel(idx);
    setMenuOpen(false);
  };

  const autoLabel = activeHeight ? `Auto · ${activeHeight}p` : "Auto";
  const currentLabel =
    currentLevel === -1
      ? autoLabel
      : (levels.find((l) => l.index === currentLevel)?.label ?? "—");

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-card ring-1 ring-white/5">
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          className="h-full w-full bg-black"
        />

        {/* Quality selector overlay */}
        {!error && levels.length > 0 && (
          <div className="absolute right-3 top-3 z-10">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/90"
            >
              <Settings className="h-3.5 w-3.5" />
              {currentLabel}
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-black/90 py-1 text-sm text-white shadow-xl backdrop-blur">
                <button
                  onClick={() => pickLevel(-1)}
                  className="flex w-full items-center justify-between px-3 py-2 hover:bg-white/10"
                >
                  <span className="flex items-center gap-2">
                    <Wifi className="h-3.5 w-3.5" /> Auto
                  </span>
                  {currentLevel === -1 && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
                <div className="my-1 h-px bg-white/10" />
                {[...levels]
                  .sort((a, b) => b.height - a.height)
                  .map((l) => (
                    <button
                      key={l.index}
                      onClick={() => pickLevel(l.index)}
                      className="flex w-full items-center justify-between px-3 py-2 hover:bg-white/10"
                    >
                      <span>{l.label}</span>
                      {currentLevel === l.index && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {loading && !error && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            {retrying && (
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Reconnecting… attempt {retriesRef.current}/{MAX_AUTO_RETRIES}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold">{error}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Try again, or open the raw stream in an external player.
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={manualRetry}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
              {rawUrl && (
                <a
                  href={rawUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
                >
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
