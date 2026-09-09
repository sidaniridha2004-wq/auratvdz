import { createFileRoute, Link, useRouter, notFound, Navigate } from "@tanstack/react-router";
import { heightFromLabel } from "@/lib/quality";
import { useEffect } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/PageShell";
import { HlsPlayer } from "@/components/HlsPlayer";
import { ChannelLogo } from "@/components/ChannelLogo";
import { findChannelBySlug } from "@/lib/m3u-channels";
import { useChannels } from "@/lib/channels-client";
import { exitImmersiveMode } from "@/lib/tv-navigation";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/watch/live/$slug")({
  head: ({ params }) =>
    pageHead({
      title: `Watch ${params.slug.replace(/-/g, " ")}`,
      description: "Live stream player.",
      path: `/watch/live/${params.slug}`,
      noindex: true,
    }),
  component: WatchLive,
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
        This channel is not available right now.{" "}
        <Link to="/" hash="channels" className="underline">
          Browse channels
        </Link>
        .
      </div>
    </div>
  ),
});

function WatchLive() {
  const { slug } = Route.useParams();
  const { bySlug, isLoading } = useChannels();

  useEffect(() => () => exitImmersiveMode(), []);

  // Channels from the live API use `yacine-<id>` slugs; send them to the
  // dedicated player route so there is one code path per source.
  const yacineId = /^yacine-(\d+)$/.exec(slug)?.[1];
  if (yacineId) {
    const c = bySlug.get(slug);
    const q = c ? heightFromLabel(c.group) || heightFromLabel(c.name) || undefined : undefined;
    return <Navigate to="/watch/$channelId" params={{ channelId: yacineId }} search={{ name: c?.name, logo: c?.logo || undefined, q }} replace />;
  }

  if (!/^[a-z0-9-]{1,80}$/.test(slug)) throw notFound();

  const dbCh = bySlug.get(slug);
  if (isLoading && !dbCh) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="wrap py-24 text-center text-muted-foreground">Loading channel…</div>
      </div>
    );
  }
  // Hidden or removed channels never fall back to the static list.
  if (!dbCh) throw notFound();

  const staticCh = findChannelBySlug(slug);
  const logo = dbCh.logo || staticCh?.logo;
  const isBeinMax = /bein\s*sports?\s*max/i.test(dbCh.name);
  const preferredHeight = isBeinMax ? 720 : undefined;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="wrap py-5 sm:py-8">
        <Breadcrumbs
          items={[
            { name: "Home", path: "/" },
            { name: "Channels", path: "/#channels" },
            { name: dbCh.name, path: `/watch/live/${slug}` },
          ]}
        />
        <div className="mt-4 flex items-center gap-3">
          <ChannelLogo src={logo} name={dbCh.name} group={dbCh.group} size={44} />
          <div>
            <div className="kicker flex items-center gap-1.5 text-live">
              <span className="live-dot" aria-hidden /> Live
            </div>
            <h1 className="text-[1.5rem] leading-tight sm:text-[2rem]" dir="auto">
              {dbCh.name}
            </h1>
            <div className="text-[12px] text-muted-foreground" dir="auto">
              {dbCh.group}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <HlsPlayer key={slug} src={`/api/public/legacy-master?slug=${encodeURIComponent(slug)}`} preferredHeight={preferredHeight} title={dbCh.name} />
        </div>

        <p className="mt-4 text-[12px] text-muted-foreground">
          {preferredHeight ? `Starts at ${preferredHeight}p on beIN MAX. Use the quality menu to change it.` : "Quality adapts to your connection."}{" "}
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
