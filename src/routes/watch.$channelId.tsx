import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, Radio, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { z } from "zod";
import { getChannel, probeStream } from "@/lib/yacine.functions";
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
  const probe = useServerFn(probeStream);

  const { data: streams, isLoading } = useQuery({
    queryKey: ["channel", id],
    queryFn: () => fetchChannel({ data: { channelId: id } }),
    staleTime: 30_000,
    retry: 2,
  });

  // Validate each quality in parallel — chips reflect what's actually reachable
  const probeQueries = useQueries({
    queries: (streams ?? []).map((s, i) => ({
      queryKey: ["probe", id, i, s.url],
      queryFn: () =>
        probe({ data: { url: s.url, referer: s.referer, userAgent: s.user_agent } }),
      staleTime: 60_000,
      retry: 1,
    })),
  });

  const probedStatus = useMemo(
    () =>
      probeQueries.map((q) => ({
        loading: q.isLoading,
        ok: q.data?.ok ?? false,
        done: !q.isLoading,
      })),
    [probeQueries],
  );

  // Auto-pick the first reachable quality once probes resolve
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  useEffect(() => setActiveIdx(null), [id]);

  useEffect(() => {
    if (activeIdx != null || !streams || streams.length === 0) return;
    const firstReachable = probedStatus.findIndex((p) => p.done && p.ok);
    if (firstReachable >= 0) {
      setActiveIdx(firstReachable);
      return;
    }
    const allDone = probedStatus.length > 0 && probedStatus.every((p) => p.done);
    if (allDone) setActiveIdx(0); // nothing reachable — still try first
  }, [streams, probedStatus, activeIdx]);

  const active = activeIdx != null ? streams?.[activeIdx] : undefined;
  const proxied = active ? buildProxyUrl(active.url, active.referer, active.user_agent) : "";

  const tryNextQuality = useCallback(() => {
    if (!streams || streams.length <= 1) return;
    // jump to next reachable, else next index
    const start = (activeIdx ?? 0) + 1;
    for (let i = 0; i < streams.length; i++) {
      const idx = (start + i) % streams.length;
      if (probedStatus[idx]?.ok || !probedStatus[idx]?.done) {
        setActiveIdx(idx);
        return;
      }
    }
    setActiveIdx((i) => ((i ?? 0) + 1) % streams.length);
  }, [streams, activeIdx, probedStatus]);

  const allProbing =
    streams && streams.length > 0 && probedStatus.length > 0 && probedStatus.every((p) => p.loading);
  const noneReachable =
    streams && streams.length > 0 && probedStatus.every((p) => p.done && !p.ok);

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
          {isLoading || activeIdx == null || !active ? (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl bg-black shadow-card">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              {allProbing && (
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Checking available qualities…
                </div>
              )}
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

        {noneReachable && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            No qualities are currently reachable. The channel may be offline.
          </div>
        )}

        {streams && streams.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Quality
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {probedStatus.filter((p) => p.ok).length} / {streams.length} reachable
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {streams.map((s, i) => {
                const st = probedStatus[i];
                const isActive = i === activeIdx;
                const isOk = st?.ok;
                const isChecking = st?.loading;
                return (
                  <button
                    key={i}
                    onClick={() => setActiveIdx(i)}
                    disabled={st?.done && !st.ok}
                    title={
                      isChecking
                        ? "Checking…"
                        : isOk
                          ? "Reachable"
                          : "Unreachable — try another quality"
                    }
                    className={`group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-glow"
                        : isOk
                          ? "border border-border bg-card/60 text-foreground hover:border-primary/50"
                          : "border border-border bg-card/30 text-muted-foreground line-through opacity-60"
                    } disabled:cursor-not-allowed`}
                  >
                    {isChecking ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isOk ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {s.name || `Stream ${i + 1}`}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
