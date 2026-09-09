import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listChannels, type ChannelRow } from "./channels.functions";
import { getYacineDirectory } from "./yacine.functions";
import type { M3uChannel } from "./m3u-channels";

export const CHANNELS_QUERY_KEY = ["channels"] as const;
export const YACINE_CHANNELS_QUERY_KEY = ["yacine-directory"] as const;

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

export function useChannels() {
  const queryClient = useQueryClient();
  const fetchChannels = useServerFn(listChannels);
  const fetchYacineDirectory = useServerFn(getYacineDirectory);

  const databaseQuery = useQuery({
    queryKey: CHANNELS_QUERY_KEY,
    queryFn: () => fetchChannels(),
    staleTime: 30_000,
  });
  const yacineQuery = useQuery({
    queryKey: YACINE_CHANNELS_QUERY_KEY,
    queryFn: () => fetchYacineDirectory(),
    staleTime: 10 * 60_000,
    retry: 2,
  });

  useEffect(() => {
    const channel = supabase
      .channel("channels-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "channels" },
        () => queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    const onFocus = () => {
      queryClient.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: YACINE_CHANNELS_QUERY_KEY });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [queryClient]);

  const rows = databaseQuery.data ?? [];
  const databaseChannels = useMemo(
    () => rows.filter((row) => row.is_active).map(rowToChannel),
    [rows],
  );
  const yacineChannels = useMemo<M3uChannel[]>(
    () =>
      (yacineQuery.data?.channels ?? []).map((channel) => ({
        slug: `yacine-${channel.id}`,
        name: channel.name,
        group: channel.categoryName,
        logo: channel.logo,
        url: "",
      })),
    [yacineQuery.data],
  );
  const active = useMemo(
    () => [...databaseChannels, ...yacineChannels],
    [databaseChannels, yacineChannels],
  );
  const bySlug = useMemo(() => {
    const map = new Map<string, M3uChannel>();
    for (const channel of active) map.set(channel.slug, channel);
    return map;
  }, [active]);

  return {
    channels: active,
    rows,
    bySlug,
    isLoading: databaseQuery.isLoading && yacineQuery.isLoading,
    error:
      active.length > 0
        ? null
        : ((databaseQuery.error ?? yacineQuery.error) as Error | null),
  };
}

export function useChannelsBySlug() {
  const fetchChannels = useServerFn(listChannels);
  const fetchYacineDirectory = useServerFn(getYacineDirectory);
  const databaseQuery = useQuery({
    queryKey: CHANNELS_QUERY_KEY,
    queryFn: () => fetchChannels(),
    staleTime: 30_000,
  });
  const yacineQuery = useQuery({
    queryKey: YACINE_CHANNELS_QUERY_KEY,
    queryFn: () => fetchYacineDirectory(),
    staleTime: 10 * 60_000,
  });

  return useMemo(() => {
    const map = new Map<string, M3uChannel>();
    for (const row of databaseQuery.data ?? []) {
      if (row.is_active) map.set(row.slug, rowToChannel(row));
    }
    for (const channel of yacineQuery.data?.channels ?? []) {
      map.set(`yacine-${channel.id}`, {
        slug: `yacine-${channel.id}`,
        name: channel.name,
        group: channel.categoryName,
        logo: channel.logo,
        url: "",
      });
    }
    return map;
  }, [databaseQuery.data, yacineQuery.data]);
}
