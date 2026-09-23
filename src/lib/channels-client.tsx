import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ChannelRow } from "./channels.functions";
import { getYacineDirectory } from "./yacine.functions";
import type { M3uChannel } from "./m3u-channels";

export const CHANNELS_QUERY_KEY = ["channels"] as const;

export function rowToChannel(row: ChannelRow): M3uChannel {
  return {
    slug: row.slug,
    name: row.name,
    group: row.category,
    logo: row.logo_url,
    url: row.stream_url,
    matchAlias: row.match_alias ?? undefined,
  };
}

type Directory = Awaited<ReturnType<typeof getYacineDirectory>>;

function directoryToChannels(directory: Directory | undefined): M3uChannel[] {
  return (directory?.channels ?? []).map((channel) => ({
    slug: `yacine-${channel.id}`,
    name: channel.name,
    group: channel.categoryName,
    logo: channel.logo,
    url: "",
  }));
}

/**
 * Yacine rotates channel IDs, so keeping a directory for ten minutes can leave
 * cards pointing at ids that already return 404. Refresh it regularly and on
 * window focus; the master route also resolves a rotated id by channel name.
 */
function useDirectoryQuery() {
  const fetchDirectory = useServerFn(getYacineDirectory);
  return useQuery({
    queryKey: CHANNELS_QUERY_KEY,
    queryFn: () => fetchDirectory(),
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
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
