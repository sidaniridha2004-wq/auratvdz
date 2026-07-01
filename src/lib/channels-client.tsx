// Client-side channel data source. The homepage and admin panel both read
// through useChannels(): initial data comes from `listChannels()`
// (Supabase → public SELECT policy → anon key), and a realtime subscription
// on `public.channels` invalidates the query on every INSERT/UPDATE/DELETE
// so admin edits show up instantly — no reload needed. A window focus
// listener triggers a refetch as a safety net when realtime is delayed.
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listChannels, type ChannelRow } from "./channels.functions";
import type { M3uChannel } from "./m3u-channels";

export const CHANNELS_QUERY_KEY = ["channels"] as const;

/** Map a DB row into the M3uChannel shape used across the UI. */
export function rowToChannel(r: ChannelRow): M3uChannel {
  return {
    slug: r.slug,
    name: r.name,
    group: r.category,
    logo: r.logo_url,
    url: r.stream_url,
    matchAlias: r.match_alias ?? undefined,
  };
}

export function useChannels() {
  const qc = useQueryClient();
  const fetchChannels = useServerFn(listChannels);
  const query = useQuery({
    queryKey: CHANNELS_QUERY_KEY,
    queryFn: () => fetchChannels(),
    staleTime: 30_000,
  });

  // Realtime: any change to public.channels re-fetches the list.
  useEffect(() => {
    const ch = supabase
      .channel("channels-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "channels" },
        () => qc.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  // Fallback: refetch when the tab regains focus (e.g. after editing in /admin).
  useEffect(() => {
    const onFocus = () => qc.invalidateQueries({ queryKey: CHANNELS_QUERY_KEY });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [qc]);

  const rows = query.data ?? [];
  const active = useMemo(
    () => rows.filter((r) => r.is_active).map(rowToChannel),
    [rows],
  );
  const bySlug = useMemo(() => {
    const m = new Map<string, M3uChannel>();
    for (const c of active) m.set(c.slug, c);
    return m;
  }, [active]);

  return {
    channels: active,
    rows,
    bySlug,
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

/** Lightweight lookup — reads the same cached query without adding a realtime channel. */
export function useChannelsBySlug() {
  const fetchChannels = useServerFn(listChannels);
  const query = useQuery({
    queryKey: CHANNELS_QUERY_KEY,
    queryFn: () => fetchChannels(),
    staleTime: 30_000,
  });
  return useMemo(() => {
    const m = new Map<string, M3uChannel>();
    for (const r of query.data ?? []) if (r.is_active) m.set(r.slug, rowToChannel(r));
    return m;
  }, [query.data]);
}
