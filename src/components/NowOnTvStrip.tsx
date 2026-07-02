// Horizontal "Now on TV" strip — admin-curated highlights that appear
// under the hero. Reads via TanStack Query and stays in sync via realtime
// on the `now_on_tv` table + window-focus refetch.
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PlayCircle, Tv2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listNowOnTv, type NowOnTvRow } from "@/lib/now-on-tv.functions";
import { useChannelsBySlug } from "@/lib/channels-client";
import { ChannelLogo } from "@/components/ChannelLogo";

export const NOW_ON_TV_QUERY_KEY = ["now_on_tv"] as const;

export function useNowOnTv() {
  const qc = useQueryClient();
  const fetchNow = useServerFn(listNowOnTv);
  const query = useQuery({
    queryKey: NOW_ON_TV_QUERY_KEY,
    queryFn: () => fetchNow(),
    staleTime: 30_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("now-on-tv-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "now_on_tv" },
        () => qc.invalidateQueries({ queryKey: NOW_ON_TV_QUERY_KEY }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  useEffect(() => {
    const onFocus = () => qc.invalidateQueries({ queryKey: NOW_ON_TV_QUERY_KEY });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [qc]);

  const rows = (query.data ?? []) as NowOnTvRow[];
  return {
    rows,
    active: rows.filter((r) => r.is_active),
    isLoading: query.isLoading,
  };
}

export function NowOnTvStrip() {
  const { active, isLoading } = useNowOnTv();
  const bySlug = useChannelsBySlug();

  if (isLoading) {
    return (
      <div className="relative border-y border-white/[0.05] bg-black/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-hidden px-4 py-3 sm:px-6">
          <div className="skeleton h-9 w-32 shrink-0 rounded-full" />
          <div className="skeleton h-9 w-52 shrink-0 rounded-full" />
          <div className="skeleton h-9 w-40 shrink-0 rounded-full" />
        </div>
      </div>
    );
  }
  if (active.length === 0) return null;

  return (
    <section
      aria-label="Now on TV"
      className="relative border-y border-white/[0.05] bg-black/60 backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <Tv2 className="h-3.5 w-3.5 text-accent" />
          <span className="eyebrow">Now on TV</span>
        </div>
        <div className="relative -mx-4 flex-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-2">
            {active.map((item) => {
              const ch = bySlug.get(item.channel_slug);
              return (
                <Link
                  key={item.id}
                  to="/watch/live/$slug"
                  params={{ slug: item.channel_slug }}
                  className="group inline-flex shrink-0 items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 pr-4 transition hover:border-primary/40 hover:bg-white/[0.06]"
                >
                  <ChannelLogo
                    src={ch?.logo}
                    name={ch?.name ?? item.channel_slug}
                    group={ch?.group}
                    size={28}
                    className="shrink-0"
                  />
                  <div className="min-w-0 leading-tight">
                    <div className="truncate text-[13px] font-semibold text-foreground">{item.title}</div>
                    {item.subtitle && (
                      <div className="truncate text-[11px] text-muted-foreground">{item.subtitle}</div>
                    )}
                  </div>
                  <PlayCircle className="h-4 w-4 shrink-0 text-primary opacity-70 transition group-hover:opacity-100" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
