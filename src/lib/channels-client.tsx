import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ChannelRow } from "./channels.functions";
import { getYacineDirectory } from "./yacine.functions";
import type { M3uChannel } from "./m3u-channels";

// The homepage refresh button already invalidates this key. It now represents
// the Yacine API directory instead of the legacy Supabase channel catalogue.
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

function directoryToChannels(
  directory: Awaited<ReturnType<typeof getYacineDirectory>> | undefined,
): M3uChannel[] {
  return (directory?.channels ?? []).map((channel) => ({
    slug: `yacine-${channel.id}`,
    name: channel.name,
    group: channel.categoryName,
    logo: channel.logo,
    url: "",
  }));
}

export function useChannels() {
  const fetchDirectory = useServerFn(getYacineDirectory);
  const query = useQuery({
    queryKey: CHANNELS_QUERY_KEY,
    queryFn: () => fetchDirectory(),
    staleTime: 10 * 60_000,
    retry: 2,
  });

  const channels = useMemo(
    () => directoryToChannels(query.data),
    [query.data],
  );
  const bySlug = useMemo(() => {
    const map = new Map<string, M3uChannel>();
    for (const channel of channels) map.set(channel.slug, channel);
    return map;
  }, [channels]);

  // Keep the old return shape so settings/admin views continue to compile,
  // while legacy database channels remain hidden everywhere in the public UI.
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
  const fetchDirectory = useServerFn(getYacineDirectory);
  const query = useQuery({
    queryKey: CHANNELS_QUERY_KEY,
    queryFn: () => fetchDirectory(),
    staleTime: 10 * 60_000,
    retry: 2,
  });

  return useMemo(() => {
    const map = new Map<string, M3uChannel>();
    for (const channel of directoryToChannels(query.data)) {
      map.set(channel.slug, channel);
    }
    return map;
  }, [query.data]);
}
