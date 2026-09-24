import { createFileRoute } from "@tanstack/react-router";
import { probeYacineStream } from "@/lib/yacine-stream-probe.functions";

export const Route = createFileRoute("/channel-probe")({
  loader: () => probeYacineStream({ data: { name: "Alkass 1" } }),
  component: Probe,
});
function Probe() {
  const data = Route.useLoaderData();
  return <main className="min-h-screen bg-white p-6 text-black"><h1>Channel probe</h1><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(data, null, 2)}</pre></main>;
}
