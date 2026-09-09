// "Now on TV": editor-picked highlights shown under the hero. Reads through
// TanStack Query and refreshes on realtime changes to `now_on_tv` and on
// window focus.
import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
      .on("postgres_changes", { event: "*", schema: "public", table: "now_on_tv" }, () => qc.invalidateQueries({ queryKey: NOW_ON_TV_QUERY_KEY }))
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
  return { rows, active: rows.filter((r) => r.is_active), isLoading: query.isLoading };
}

export function NowOnTvStrip() {
  const { active, isLoading } = useNowOnTv();
  const bySlug = useChannelsBySlug();

  if (isLoading) {
    return (
      <div className="rule-b bg-card">
        <div className="wrap flex items-center gap-2 overflow-hidden py-2.5">
          <div className="skeleton h-9 w-40 shrink-0" />
          <div className="skeleton h-9 w-56 shrink-0" />
          <div className="skeleton h-9 w-44 shrink-0" />
        </div>
      </div>
    );
  }
  if (active.length === 0) return null;

  return (
    <section aria-label="Now on TV" className="rule-b bg-card">
      <div className="wrap flex items-center gap-3 py-2.5">
        <span className="kicker hidden shrink-0 sm:inline">Now on TV</span>
        <ul className="-mx-4 flex flex-1 gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {active.map((item) => {
            const ch = bySlug.get(item.channel_slug);
            const name = ch?.name ?? item.channel_slug;
            return (
              <li key={item.id} className="shrink-0">
                <Link
                  to="/watch/live/$slug"
                  params={{ slug: item.channel_slug }}
                  aria-label={`Watch ${item.title} on ${name}`}
                  className="tile tile-hover inline-flex items-center gap-2.5 py-1.5 pl-1.5 pr-3"
                >
                  <ChannelLogo src={ch?.logo} name={name} group={ch?.group} size={28} className="shrink-0" />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-[13px] font-semibold" dir="auto">
                      {item.title}
                    </span>
                    {item.subtitle && (
                      <span className="block truncate text-[11px] text-muted-foreground" dir="auto">
                        {item.subtitle}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
