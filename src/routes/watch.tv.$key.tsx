import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { useMemo, useEffect } from "react";
import { z } from "zod";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/PageShell";
import { ChannelLogo } from "@/components/ChannelLogo";
import { HlsPlayer, type QualitySource } from "@/components/HlsPlayer";
import { useCustomChannels } from "@/lib/custom-channels";
import { exitImmersiveMode } from "@/lib/tv-navigation";
import { pageHead } from "@/lib/seo";

const watchSearchSchema = z.object({ name: z.string().max(120).optional() });
const KEY_RE = /^[a-z0-9_.-]{1,80}$/i;

export const Route = createFileRoute("/watch/tv/$key")({
  validateSearch: watchSearchSchema,
  head: ({ params }) =>
    pageHead({
      title: `Watch ${params.key}`,
      description: "Live stream player.",
      path: `/watch/tv/${params.key}`,
      noindex: true,
    }),
  component: WatchTv,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="wrap py-24 text-center">
          <p className="text-destructive">{error.message}</p>
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="btn btn-primary mt-4"
          >
            Retry
          </button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="wrap py-24 text-center text-muted-foreground">
        Channel not found.{" "}
        <Link to="/" hash="channels" className="underline">
          Browse channels
        </Link>
        .
      </div>
    </div>
  ),
});

function preferredHeightFor(key: string, name: string | undefined): number | undefined {
  const all = `${key} ${name ?? ""}`.toLowerCase();
  if (/bein.*max/.test(all) || /\u0645\u0627\u0643\u0633/.test(name ?? "")) return 720;
  return undefined;
}

function heightFromLabel(label: string): number {
  const n = label.toUpperCase();
  const num = parseInt(n.match(/(\d{3,4})/)?.[1] ?? "0", 10);
  if (num) return num;
  if (n.includes("4K")) return 2160;
  if (n.includes("FHD") || n.includes("FULL") || n.includes("HEVC")) return 1080;
  if (n.includes("HD")) return 720;
  if (n.includes("SD")) return 480;
  return 0;
}

function WatchTv() {
  const { key } = Route.useParams();
  const { name } = Route.useSearch();
  if (!KEY_RE.test(key)) throw notFound();

  const isCustom = key.startsWith("custom-");
  const { find } = useCustomChannels();
  const custom = isCustom ? find(key) : undefined;
  const display = custom?.name ?? name ?? key;
  const preferredHeight = preferredHeightFor(key, display);

  useEffect(() => () => exitImmersiveMode(), []);

  // Channels the visitor added themselves play directly from their own URL.
  // Routing arbitrary user URLs through the server proxy would turn it back
  // into an open proxy, so we deliberately do not do that.
  const customSources: QualitySource[] = useMemo(() => {
    if (!custom) return [];
    return custom.sources
      .filter((s) => /^https?:\/\//i.test(s.url))
      .map((s) => ({ label: s.quality || "Stream", url: s.url, height: heightFromLabel(s.quality) }))
      .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
  }, [custom]);

  const crumbs = [
    { name: "Home", path: "/" },
    { name: isCustom ? "My channels" : "Channels", path: isCustom ? "/settings/channels" : "/#channels" },
    { name: display, path: `/watch/tv/${key}` },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="wrap py-5 sm:py-8">
        <Breadcrumbs items={crumbs} />
        <div className="mt-4 flex items-center gap-3">
          <ChannelLogo src={custom?.logo} name={display} size={44} />
          <div>
            <div className="kicker flex items-center gap-1.5 text-live">
              <span className="live-dot" aria-hidden /> Live
            </div>
            <h1 className="text-[1.5rem] leading-tight sm:text-[2rem]" dir="auto">
              {display}
            </h1>
          </div>
        </div>

        <div className="mt-5">
          {isCustom ? (
            customSources.length === 0 ? (
              <div className="tile p-12 text-center text-[14px] text-muted-foreground">
                This channel has no valid stream URL.{" "}
                <Link to="/settings/channels" className="underline">
                  Edit my channels
                </Link>
                .
              </div>
            ) : (
              <HlsPlayer key={key} sources={customSources} preferredHeight={preferredHeight} title={display} />
            )
          ) : (
            <HlsPlayer key={key} src={`/api/public/auratv-master?key=${encodeURIComponent(key)}`} preferredHeight={preferredHeight} title={display} />
          )}
        </div>

        <p className="mt-4 text-[12px] text-muted-foreground">
          {isCustom
            ? "Streams you add yourself play directly from their source and are stored only on this device."
            : "Quality adapts to your connection. Use the quality menu on the player to lock a resolution."}{" "}
          <Link to="/faq" className="underline">
            Playback help
          </Link>
          .
        </p>
      </main>
      <Footer />
    </div>
  );
}
