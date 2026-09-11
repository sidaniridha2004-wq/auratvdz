import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { VodPlayer } from "@/components/VodPlayer";
import { getMovie, resolveStream, type MovieDetail, type StreamResolution } from "@/lib/media.functions";
import { ensureUnsandboxedPlayerFrames } from "@/lib/player-frame.client";
import { movieKey } from "@/lib/resume";
import { pageHead } from "@/lib/seo";

const searchSchema = z.object({
  /** Start position in seconds; 0 forces "start over". */
  t: z.coerce.number().int().min(0).max(360_000).optional().catch(undefined),
  /** Server to start on. */
  s: z.enum(["vixsrc", "vidapi", "multiembed", "vidfast"]).optional().catch(undefined),
});

type LoaderData = { movie: MovieDetail; stream: StreamResolution };

export const Route = createFileRoute("/play/movie/$id")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ t: search.t }),
  loader: async ({ params, deps }): Promise<LoaderData> => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw notFound();
    const detail = await getMovie({ data: { id } }).catch((error: unknown) => {
      if (error instanceof Error && /not found/i.test(error.message)) throw notFound();
      throw error;
    });
    const stream = await resolveStream({
      data: {
        kind: "movie",
        id,
        title: detail.movie.title,
        poster: detail.movie.backdrop ?? detail.movie.poster ?? undefined,
        startAt: deps.t,
      },
    });
    return { movie: detail.movie, stream };
  },
  head: ({ loaderData }) =>
    pageHead({
      title: loaderData ? `Now playing: ${(loaderData as LoaderData).movie.title}` : "Now playing",
      description: "Playback.",
      path: "/movies",
      noindex: true,
    }),
  component: PlayMovie,
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
        That film is not in the catalogue.{" "}
        <Link to="/movies" className="underline">
          Browse movies
        </Link>
      </p>
    </div>
  ),
});

function PlayMovie() {
  ensureUnsandboxedPlayerFrames();
  const { movie, stream } = Route.useLoaderData();
  const { t, s } = Route.useSearch();
  return (
    <div className="fixed inset-0 bg-black">
      <VodPlayer
        key={movie.id}
        stream={stream}
        preferredServer={s}
        poster={movie.backdrop ?? movie.poster}
        title={movie.title}
        subtitle={[movie.year, movie.runtime ? `${movie.runtime} min` : null].filter(Boolean).join(" · ")}
        backHref={`/title/movie/${movie.id}`}
        resumeKey={movieKey(movie.id)}
        startAt={t}
      />
    </div>
  );
}
