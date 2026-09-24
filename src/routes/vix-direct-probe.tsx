import { createFileRoute } from "@tanstack/react-router";
import { resolveFreshVixDirect } from "@/lib/vix-direct.functions";

export const Route = createFileRoute("/vix-direct-probe")({
  loader: async () => ({
    fightClub: await resolveFreshVixDirect({ data: { kind: "movie", id: 550 } }),
    odyssey: await resolveFreshVixDirect({ data: { kind: "movie", id: 1368337 } }),
    episode: await resolveFreshVixDirect({ data: { kind: "tv", id: 1399, season: 1, episode: 1 } }),
  }),
  component: Probe,
});
function Probe() {
  const data = Route.useLoaderData();
  const safe = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.ok ? { ...value, src: "[signed]" } : value]));
  return <main><h1>Vix direct probe</h1><pre>{JSON.stringify(safe, null, 2)}</pre></main>;
}
