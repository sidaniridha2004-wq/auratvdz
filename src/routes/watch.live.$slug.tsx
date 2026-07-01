import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { HlsPlayer } from "@/components/HlsPlayer";
import { ChannelLogo } from "@/components/ChannelLogo";
import { findChannelBySlug } from "@/lib/m3u-channels";

export const Route = createFileRoute("/watch/live/$slug")({
  component: WatchLive,
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

function WatchLive() {
  const { slug } = Route.useParams();
  const ch = findChannelBySlug(slug);
  if (!ch) throw notFound();

  const isBeinMax = /bein\s*sports?\s*max/i.test(ch.name);
  const preferredHeight = isBeinMax ? 720 : undefined;
  const proxied = `/api/public/stream?url=${encodeURIComponent(ch.url)}`;

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
          <ChannelLogo
            src={ch.logo}
            name={ch.name}
            className="h-12 w-12 rounded-xl bg-card p-1.5 shadow-card"
          />
          <div>
            <div className="text-xs uppercase tracking-widest text-destructive">
              <span className="live-dot mr-1.5" /> Live · Primary server
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">{ch.name}</h1>
            <div className="text-xs text-muted-foreground">{ch.group}</div>
          </div>
        </div>

        <div className="mt-6">
          <HlsPlayer key={slug} src={proxied} rawUrl={ch.url} preferredHeight={preferredHeight} />
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          {preferredHeight
            ? `Locked to ~${preferredHeight}p for beIN MAX — tap the gear icon to switch.`
            : "Quality auto-switches. Tap the gear icon on the player to pick a specific rung."}
        </p>
      </div>
    </div>
  );
}
