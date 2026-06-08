import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";

interface Props {
  src: string;
  rawUrl?: string;
  onFallback?: () => void;
}

const MAX_AUTO_RETRIES = 3;

export function HlsPlayer({ src, rawUrl, onFallback }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retriesRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryNonce, setRetryNonce] = useState(0);
  const [retrying, setRetrying] = useState(false);

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
        manifestLoadingMaxRetry: 2,
        levelLoadingMaxRetry: 2,
        fragLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 500,
        levelLoadingRetryDelay: 500,
        fragLoadingRetryDelay: 500,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

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
  }, [src, retryNonce]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-card">
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          className="h-full w-full"
        />
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
                Try another quality, retry the connection, or open in an external player.
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
              {onFallback && (
                <button
                  onClick={onFallback}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
                >
                  Next quality
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
