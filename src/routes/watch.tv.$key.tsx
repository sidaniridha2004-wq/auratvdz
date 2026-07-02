import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ArrowLeft, Radio } from "lucide-react";
import { z } from "zod";
import { SiteHeader } from "@/components/SiteHeader";
import { HlsPlayer, type QualitySource } from "@/components/HlsPlayer";
import { getAuraChannelStreams } from "@/lib/auratv-channels.functions";
import { useCustomChannels } from "@/lib/custom-channels";

const watchSearchSchema = z.object({ name: z.string().optional() });

export const Route = createFileRoute("/watch/tv/$key")({
  validateSearch: watchSearchSchema,
  component: WatchTv,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="min-h-screen bg-hero">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <p className="text-destructive">{error.message}</p>
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            Retry
          </button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-hero">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-24 text-center text-muted-foreground">
        Channel not found.
      </div>
    </div>
  ),
});

function preferredHeightFor(key: string, name: string | undefined): number | undefined {
  const all = `${key} ${name ?? ""}`.toLowerCase();
  if (/bein.*max/.test(all) || /ماكس/.test(name ?? "")) return 720;
  return undefined;
}

function heightFromLabel(label: string): number {
  const n = label.toUpperCase();
  const num = parseInt(n.match(/(\d{3,4})/)?.[1] ?? "0", 10);
  if (num) return num;
  if (n.includes("4K")) return 2160;
  if (n.includes("FHD") || n.includes("FULL")) return 1080;
  if (n.includes("HEVC")) return 1080;
  if (n.includes("HD")) return 720;
  if (n.includes("SD")) return 480;
  return 0;
}

function WatchTv() {
  const { key } = Route.useParams();
  const { name } = Route.useSearch();
  const isCustom = key.startsWith("custom-");
  const { find } = useCustomChannels();
  const custom = isCustom ? find(key) : undefined;
  const display = custom?.name ?? name ?? key;
  const preferredHeight = preferredHeightFor(key, display);

  const fetchStreams = useServerFn(getAuraChannelStreams);
  const {
    data: rawStreams,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["aura-streams", key],
    queryFn: () => fetchStreams({ data: { key } }),
    staleTime: 5 * 60_000,
    enabled: !isCustom,
  });

  const sources: QualitySource[] = useMemo(() => {
    if (isCustom && custom) {
      return custom.sources
        .map((s) => ({
          label: s.quality || "Stream",
          url: `/api/public/stream?url=${encodeURIComponent(s.url)}`,
          height: heightFromLabel(s.quality),
        }))
        .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
    }
    if (!rawStreams) return [];
    return rawStreams
      .map((s) => ({
        label: s.quality,
        url: `/api/public/stream?url=${encodeURIComponent(s.url)}`,
        height: heightFromLabel(s.quality),
      }))
      .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
  }, [rawStreams, isCustom, custom]);

  const loading = isCustom ? false : isLoading;
  const showEmpty =
    (!loading && !isCustom && (error || sources.length === 0)) ||
    (isCustom && sources.length === 0);

  return (
    <div className="min-h-screen bg-hero">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card text-primary shadow-card">
            <Radio className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-destructive">
              <span className="live-dot mr-1.5" /> Live now
            </div>
            <h1 className="text-2xl font-bold capitalize sm:text-3xl">{display}</h1>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="aspect-video w-full animate-pulse rounded-2xl bg-card" />
          ) : showEmpty ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-muted-foreground">
              No working streams for this channel.
            </div>
          ) : (
            <HlsPlayer
              key={key}
              sources={sources}
              preferredHeight={preferredHeight}
              mirrors={sources.map((s) => s.url)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
