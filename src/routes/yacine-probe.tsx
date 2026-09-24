import { createFileRoute } from "@tanstack/react-router";
import { probeYacineEvents } from "@/lib/yacine-probe.functions";

export const Route = createFileRoute("/yacine-probe")({
  loader: () => probeYacineEvents(),
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
