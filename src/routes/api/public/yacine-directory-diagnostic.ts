import { createFileRoute } from "@tanstack/react-router";
import { fetchYacineDirectory } from "@/lib/yacine-api.server";
import { discoverYacineConfig } from "@/lib/yacine-discovery.server";
import { normaliseChannelName } from "@/lib/match-channel";

export const Route = createFileRoute("/api/public/yacine-directory-diagnostic")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const name = url.searchParams.get("name")?.trim().slice(0, 120) ?? "";
        if (!name) return Response.json({ error: "missing name" }, { status: 400 });

        await discoverYacineConfig();
        const directory = await fetchYacineDirectory();
        const wanted = normaliseChannelName(name);
        const matches = directory.channels
          .filter((channel) => {
            const candidate = normaliseChannelName(channel.name);
            return candidate === wanted || candidate.includes(wanted) || wanted.includes(candidate);
          })
          .slice(0, 30)
          .map((channel) => ({
            id: channel.id,
            name: channel.name,
            categoryName: channel.categoryName,
          }));

        return Response.json(
          {
            query: name,
            updatedAt: directory.updatedAt,
            categoryCount: directory.categories.length,
            channelCount: directory.channels.length,
            warnings: directory.warnings.slice(0, 20),
            matches,
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
