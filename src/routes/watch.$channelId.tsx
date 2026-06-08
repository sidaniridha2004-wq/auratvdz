import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Radio } from "lucide-react";
import { z } from "zod";
import { getChannel } from "@/lib/yacine.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { HlsPlayer } from "@/components/HlsPlayer";

const watchSearchSchema = z.object({
  name: z.string().optional(),
  logo: z.string().optional(),
});

export const Route = createFileRoute("/watch/$channelId")({
  validateSearch: watchSearchSchema,
  component: Watch,
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

function buildProxyUrl(url: string, referer: string, ua: string) {
  const params = new URLSearchParams({ url });
  if (referer) params.set("referer", referer);
  if (ua) params.set("ua", ua);
  return `/api/public/stream?${params.toString()}`;
}

function Watch() {
  const { channelId } = Route.useParams();
  const { name, logo } = Route.useSearch();
  const id = Number(channelId);
  if (!Number.isFinite(id)) throw notFound();

  const fetchChannel = useServerFn(getChannel);
  const { data: streams, isLoading } = useQuery({
    queryKey: ["channel", id],
    queryFn: () => fetchChannel({ data: { channelId: id } }),
    staleTime: 30_000,
    retry: 2,
  });

  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => setActiveIdx(0), [id]);

  const active = streams?.[activeIdx];
  const proxied = active ? buildProxyUrl(active.url, active.referer, active.user_agent) : "";

  const tryNextQuality = useCallback(() => {
    if (!streams || streams.length <= 1) return;
    setActiveIdx((i) => (i + 1) % streams.length);
  }, [streams]);

  return (
    <div className="min-h-screen bg-hero">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All channels
        </Link>

        <div className="mt-4 flex items-center gap-3">
          {logo ? (
            <img
              src={logo}
              alt={name ?? "channel"}
              className="h-12 w-12 rounded-xl bg-card object-contain p-1.5 shadow-card"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card text-primary shadow-card">
              <Radio className="h-6 w-6" />
            </div>
          )}
          <div>
            <div className="text-xs uppercase tracking-widest text-destructive">
              <span className="live-dot mr-1.5" /> Live now
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">{name ?? `Channel #${id}`}</h1>
          </div>
        </div>

        <div className="mt-6">
          {isLoading || !active ? (
            <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-black shadow-card">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <HlsPlayer
              key={`${id}-${activeIdx}`}
              src={proxied}
              rawUrl={active.url}
              onFallback={streams && streams.length > 1 ? tryNextQuality : undefined}
            />
          )}
        </div>

        {streams && streams.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              Quality
            </div>
            <div className="flex flex-wrap gap-2">
              {streams.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    i === activeIdx
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "border border-border bg-card/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.name || `Stream ${i + 1}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
