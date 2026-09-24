import { createFileRoute } from "@tanstack/react-router";
import { probeYacineStream } from "@/lib/yacine-stream-probe.functions";
import { probeAuraProxy } from "@/lib/proxy-probe.functions";

export const Route = createFileRoute("/channel-probe")({
  loader: async () => {
    const [upstream, proxy] = await Promise.all([probeYacineStream({ data: { name: "Alkass 1" } }), probeAuraProxy()]);
    return { upstream, proxy };
  },
  component: Probe,
});
function Probe() {
  const data = Route.useLoaderData();
  return <main className="min-h-screen bg-white p-6 text-black"><h1>Channel probe</h1><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(data, null, 2)}</pre></main>;
}
