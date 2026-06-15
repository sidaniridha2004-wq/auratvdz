import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Radio } from "lucide-react";
import { z } from "zod";
import { SiteHeader } from "@/components/SiteHeader";
import { HlsPlayer } from "@/components/HlsPlayer";

const watchSearchSchema = z.object({
  name: z.string().optional(),
});

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

// beIN MAX feeds are unreliable above 720p — lock those channels.
function preferredHeightFor(key: string, name: string | undefined): number | undefined {
  const all = `${key} ${name ?? ""}`.toLowerCase();
  if (/bein.*max/.test(all) || /ماكس/.test(name ?? "")) return 720;
  return undefined;
}

function WatchTv() {
  const { key } = Route.useParams();
  const { name } = Route.useSearch();
  const display = name ?? key;
  const masterUrl = `/api/public/auratv-master?key=${encodeURIComponent(key)}`;
  const preferredHeight = preferredHeightFor(key, name);

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
          <HlsPlayer key={key} src={masterUrl} preferredHeight={preferredHeight} />
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          {preferredHeight
            ? `Locked to ${preferredHeight}p for this channel — tap the gear icon to switch quality.`
            : "Quality switches automatically based on your connection. Tap the gear icon on the player to lock a specific resolution."}
        </p>
      </div>
    </div>
  );
}
