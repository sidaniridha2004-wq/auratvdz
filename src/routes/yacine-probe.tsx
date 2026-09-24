import { createFileRoute } from "@tanstack/react-router";
import { probeYacineEvents } from "@/lib/yacine-probe.functions";
import { getYacineDirectory } from "@/lib/yacine.functions";

export const Route = createFileRoute("/yacine-probe")({
  loader: async () => {
    const [probe, directory] = await Promise.all([probeYacineEvents(), getYacineDirectory().catch(() => null)]);
    const candidates = (directory?.channels ?? []).filter((item) => /alkass|al\s*kass|kass|الكاس|الكأس/i.test(`${item.name} ${item.categoryName}`));
    return { ...probe, directoryCount: directory?.channels.length ?? 0, candidates };
  },
  component: ProbePage,
});

function ProbePage() {
  const data = Route.useLoaderData();
  return (
    <main className="min-h-screen bg-white p-6 text-black">
      <h1>Yacine event probe</h1>
      <pre className="mt-4 whitespace-pre-wrap text-xs">{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}
