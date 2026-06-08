import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

interface Props {
  src: string;
  poster?: string;
}

export function HlsPlayer({ src, poster }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setError(null);
    setLoading(true);

    let hls: Hls | null = null;
    const onLoaded = () => setLoading(false);
    video.addEventListener("loadeddata", onLoaded);

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          setError("Stream unavailable. Try another quality.");
          setLoading(false);
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else {
      setError("HLS not supported in this browser.");
      setLoading(false);
    }

    return () => {
      video.removeEventListener("loadeddata", onLoaded);
      hls?.destroy();
    };
  }, [src]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-card">
      <video
        ref={videoRef}
        poster={poster}
        controls
        autoPlay
        playsInline
        className="h-full w-full"
      />
      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-muted-foreground">
          {error}
        </div>
      )}
    </div>
  );
}
