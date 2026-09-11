import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { VodPlayer } from "@/components/VodPlayer";
import { getShow, resolveStream, type Episode, type SeasonDetail, type ShowDetail, type StreamResolution } from "@/lib/media.functions";
import { ensureUnsandboxedPlayerFrames } from "@/lib/player-frame-guard";
import { episodeKey, showKey } from "@/lib/resume";
import { pageHead } from "@/lib/seo";

const paramsSchema = z.object({
  id: z.coerce.number().int().min(1),
  season: z.coerce.number().int().min(0).max(200),
  episode: z.coerce.number().int().min(1).max(2000),
});

const searchSchema = z.object({
  t: z.coerce.number().int().min(0).max(360_000).optional().catch(undefined),
  s: z.enum(["vixsrc", "vidapi", "multiembed", "vidfast"]).optional().catch(undefined),
});

type LoaderData = {
  show: ShowDetail;
  season: SeasonDetail | null;
  episode: Episode | null;
  next: { href: string; label: string } | null;
  stream: StreamResolution;
};

/** Next episode in this season, else the first of the following season. */
function nextOf(show: ShowDetail, season: SeasonDetail | null, current: { season: number; episode: number }): LoaderData["next"] {
  const inSeason = season?.episodes.find((e) => e.number === current.episode + 1);
  if (inSeason) {
    return {
      href: `/play/tv/${show.id}/${current.season}/${inSeason.number}`,
      label: `S${current.season} E${inSeason.number} · ${inSeason.name}`,
    };
  }
  const idx = show.seasons.findIndex((s) => s.number === current.season);
  const following = idx >= 0 ? show.seasons[idx + 1] : undefined;
  if (following && following.episodeCount > 0) {
    return { href: `/play/tv/${show.id}/${following.number}/1`, label: `${following.name} · Episode 1` };
  }
  return null;
}

export const Route = createFileRoute("/play/tv/$id/$season/$episode")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ t: search.t }),
  loader: async ({ params, deps }): Promise<LoaderData> => {
    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) throw notFound();
    const { id, season, episode } = parsed.data;
    const detail = await getShow({ data: { id, season } }).catch((error: unknown) => {
      if (error instanceof Error && /not found/i.test(error.message)) throw notFound();
      throw error;
    });
    const ep = detail.season?.episodes.find((e) => e.number === episode) ?? null;
    const stream = await resolveStream({
      data: {
        kind: "tv",
        id,
        season,
        episode,
        title: `${detail.show.title} S${season} E${episode}`,
        poster: ep?.still ?? detail.show.backdrop ?? detail.show.poster ?? undefined,
        startAt: deps.t,
      },
    });
    return {
      show: detail.show,
      season: detail.season,
      episode: ep,
      next: nextOf(detail.show, detail.season, { season, episode }),
      stream,
    };
  },
  head: ({ loaderData, params }) => {
    const d = loaderData as LoaderData | undefined;
    return pageHead({
      title: d ? `Now playing: ${d.show.title} S${params.season} E${params.episode}` : "Now playing",
      description: "Playback.",
      path: "/movies",
      noindex: true,
    });
  },
  component: PlayEpisode,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="grid min-h-screen place-items-center bg-black p-6 text-center text-white">
        <div>
          <p className="text-white/80">{error.message}</p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                router.invalidate();
                reset();
              }}
              className="btn btn-primary"
            >
              Retry
            </button>
            <Link to="/movies" className="btn btn-ghost text-white">
              Back to browse
            </Link>
          </div>
        </div>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-black p-6 text-center text-white/80">
      <p>
        That episode is not in the catalogue.{" "}
        <Link to="/movies" className="underline">
          Browse series
        </Link>
      </p>
    </div>
  ),
});

function PlayEpisode() {
  ensureUnsandboxedPlayerFrames();
  const { show, episode, next, stream } = Route.useLoaderData();
  const params = Route.useParams();
  const { t, s } = Route.useSearch();
  const season = Number(params.season);
  const number = Number(params.episode);
  return (
    <div className="fixed inset-0 bg-black">
      <VodPlayer
        key={`${show.id}-${season}-${number}`}
        stream={stream}
        preferredServer={s}
        poster={episode?.still ?? show.backdrop ?? show.poster}
        title={show.title}
        subtitle={`S${season} E${number}${episode?.name ? ` · ${episode.name}` : ""}`}
        backHref={`/title/tv/${show.id}?season=${season}`}
        next={next}
        resumeKey={episodeKey(show.id, season, number)}
        resumeMeta={{ season, episode: number }}
        pointerKey={showKey(show.id)}
        startAt={t}
      />
    </div>
  );
}
