import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ChannelRow } from "./channels.functions";
import { getYacineDirectory } from "./yacine.functions";
import { M3U_CHANNELS, type M3uChannel } from "./m3u-channels";

// The live API is preferred. The bundled catalogue keeps the public site
// usable when the upstream API or its Cloudflare edge temporarily returns 403.
export const CHANNELS_QUERY_KEY = ["channels"] as const;

type Directory = Awaited<ReturnType<typeof getYacineDirectory>>;

function directoryToChannels(directory: Directory | undefined): M3uChannel[] {
  const live = (directory?.channels ?? []).map((channel) => ({
    slug: `yacine-${channel.id}`,
    name: channel.name,
    group: channel.categoryName,
    logo: channel.logo,
    url: "",
  }));
  return live.length > 0 ? live : M3U_CHANNELS;
}

/** One shared query for every consumer, so the directory is fetched once per page. */
function useDirectoryQuery() {
  const fetchDirectory = useServerFn(getYacineDirectory);
  return useQuery({
    queryKey: CHANNELS_QUERY_KEY,
    queryFn: () => fetchDirectory(),
    staleTime: 10 * 60_000,
    retry: 2,
  });
}

export function useChannels() {
  const query = useDirectoryQuery();
  const channels = useMemo(() => directoryToChannels(query.data), [query.data]);
  const bySlug = useMemo(() => {
    const map = new Map<string, M3uChannel>();
    for (const channel of channels) map.set(channel.slug, channel);
    return map;
  }, [channels]);

  // Kept for the settings/admin views that still expect database rows.
  const rows: ChannelRow[] = [];

  return {
    channels,
    rows,
    bySlug,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function useChannelsBySlug() {
  return useChannels().bySlug;
}
