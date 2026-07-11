import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { HlsPlayer } from "@/components/HlsPlayer";
import { ChannelLogo } from "@/components/ChannelLogo";
import { findChannelBySlug } from "@/lib/m3u-channels";
import { useChannels } from "@/lib/channels-client";
import { exitImmersiveMode } from "@/lib/tv-navigation";

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
        Channel not found or currently unavailable.
      </div>
    </div>
  ),
});

function WatchLive() {
  const { slug } = Route.useParams();
  const { bySlug, isLoading } = useChannels();
  const staticCh = findChannelBySlug(slug);
  const dbCh = bySlug.get(slug);

  // Wait for the channel list before deciding — otherwise a hidden channel
  // could briefly play from the static fallback while the query loads.
  if (isLoading && !dbCh) {
    return (
      <div className="min-h-screen bg-hero">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-6 py-24 text-center text-muted-foreground">
          Loading channel…
        </div>
      </div>
    );
  }
  // If the admin has hidden or removed this channel, refuse to play — never
  // fall back to the static m3u list here.
  if (!dbCh) throw notFound();
  const ch = dbCh;
  const logo = dbCh.logo || staticCh?.logo;

  const isBeinMax = /bein\s*sports?\s*max/i.test(ch.name);
  const preferredHeight = isBeinMax ? 720 : undefined;
  
  let rawStreamUrl = ch.url;
  let proxied = "";
  if (ch.url) {
    const parts = ch.url.split("|");
    rawStreamUrl = parts[0];
    let proxyUrl = `/api/public/stream?url=${encodeURIComponent(rawStreamUrl)}`;
    
    // Parse standard IPTV pipe headers (e.g. |User-Agent=...|Origin=...|Referer=...)
    // Use indexOf-based split so values containing "=" (query strings, tokens) survive.
    for (let i = 1; i < parts.length; i++) {
      const seg = parts[i];
      const eq = seg.indexOf("=");
      if (eq <= 0) continue;
      const key = seg.slice(0, eq).toLowerCase();
      const value = seg.slice(eq + 1);
      if (!value) continue;
      if (key === "user-agent") proxyUrl += `&ua=${encodeURIComponent(value)}`;
      if (key === "origin") proxyUrl += `&origin=${encodeURIComponent(value)}`;
      if (key === "referer") proxyUrl += `&referer=${encodeURIComponent(value)}`;
    }
    proxied = proxyUrl;
  }

  useEffect(() => {
    return () => {
      exitImmersiveMode();
    };
  }, []);

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
            src={logo}
            name={ch.name}
            group={ch.group}
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
          <HlsPlayer
            key={slug}
            src={proxied}
            rawUrl={rawStreamUrl}
            preferredHeight={preferredHeight}
          />
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
