import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";
import { Breadcrumbs } from "@/components/PageShell";
import { HlsPlayer } from "@/components/HlsPlayer";
import { ChannelLogo } from "@/components/ChannelLogo";
import { exitImmersiveMode } from "@/lib/tv-navigation";
import { pageHead } from "@/lib/seo";

const watchSearchSchema = z.object({
  name: z.string().max(120).optional(),
  logo: z.string().url().max(500).optional().catch(undefined),
  // Resolution-specific categories (e.g. "beIN SPORTS 1080") pin the player to
  // that one rung. Matches open without it, so every quality stays available.
  q: z.coerce.number().int().min(100).max(2160).optional().catch(undefined),
});

export const Route = createFileRoute("/watch/$channelId")({
  validateSearch: watchSearchSchema,
  head: ({ params }) =>
    pageHead({
      title: `Watch channel ${params.channelId}`,
      description: "Live stream player.",
      path: `/watch/${params.channelId}`,
      noindex: true,
    }),
  component: Watch,
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

// beIN MAX 1080p rungs from this upstream are unreliable (the label often
// points at a different feed), so those channels start on the 720p rung.
function preferredHeightFor(name: string | undefined, id: number): number | undefined {
  const n = (name ?? "").toLowerCase();
  const isBeinMaxName = /bein\s*max/.test(n) || /\u0645\u0627\u0643\u0633/.test(name ?? "");
  const isBeinMaxId = id >= 1471 && id <= 1476;
  return isBeinMaxName || isBeinMaxId ? 720 : undefined;
}

function Watch() {
  const { channelId } = Route.useParams();
  const { name, logo } = Route.useSearch();
  const id = Number(channelId);
  if (!Number.isInteger(id) || id <= 0) throw notFound();

  const masterUrl = `/api/public/master?channelId=${id}`;
  const preferredHeight = preferredHeightFor(name, id);
  const title = name ?? `Channel ${id}`;

  useEffect(() => () => { void exitImmersiveMode(); }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="wrap py-5 sm:py-8">
        <Breadcrumbs
          items={[
            { name: "Home", path: "/" },
            { name: "Channels", path: "/#channels" },
            { name: title, path: `/watch/${id}` },
          ]}
        />

        <div className="mt-4 flex items-center gap-3">
          <ChannelLogo src={logo} name={title} size={44} />
          <div>
            <div className="kicker flex items-center gap-1.5 text-live">
              <span className="live-dot" aria-hidden /> Live
            </div>
            <h1 className="text-[1.5rem] leading-tight sm:text-[2rem]" dir="auto">
              {title}
            </h1>
          </div>
        </div>

        <div className="mt-5">
          <HlsPlayer key={id} src={masterUrl} preferredHeight={preferredHeight} title={title} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted-foreground">
          <p>
            {preferredHeight
              ? `Starts at ${preferredHeight}p on this channel. Use the quality menu to change it.`
              : "Quality adapts to your connection. Use the quality menu on the player to lock a resolution."}
          </p>
          <p>
            Not playing?{" "}
            <Link to="/faq" className="underline">
              Read the FAQ
            </Link>{" "}
            or{" "}
            <Link to="/contact" className="underline">
              report it
            </Link>
            .
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
