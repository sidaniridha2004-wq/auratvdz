import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Mic2, RefreshCw, Search, Tv } from "lucide-react";
import { PageShell, SideNote } from "@/components/PageShell";
import { ChannelLogo } from "@/components/ChannelLogo";
import { getYacineDirectory, getYacineEvents, type YacineEvent } from "@/lib/yacine.functions";
import { pageHead } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/site";

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Live events", path: "/live" },
];

export const Route = createFileRoute("/live")({
  loader: async () => {
    const [events, directory] = await Promise.allSettled([getYacineEvents(), getYacineDirectory()]);
    return {
      events: events.status === "fulfilled" ? events.value : [],
      directory: directory.status === "fulfilled" ? directory.value : null,
      eventError: events.status === "rejected",
      directoryError: directory.status === "rejected",
    };
  },
  head: () =>
    pageHead({
      title: "Live events and channel directory",
      description: "Matches on air right now and coming up, with the broadcasting channel and commentator, plus the full searchable channel directory.",
      path: "/live",
      jsonLd: breadcrumbJsonLd(CRUMBS),
    }),
  component: LivePage,
});

type EventState = "live" | "upcoming" | "finished";
const ORDER: Record<EventState, number> = { live: 0, upcoming: 1, finished: 2 };

function stateOf(event: YacineEvent): EventState {
  const now = Date.now() / 1000;
  if (now < event.startTime) return "upcoming";
  if (!event.endTime || now <= event.endTime) return "live";
  return "finished";
}

const fmtTime = (value: number) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value * 1000));

function Team({ name, logo }: { name: string; logo: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      {logo ? (
        <img src={logo} alt={`${name} crest`} loading="lazy" decoding="async" width={48} height={48} className="h-12 w-12 object-contain" />
      ) : (
        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted font-display text-lg text-primary" aria-hidden>
          {name.slice(0, 1)}
        </div>
      )}
      <span className="line-clamp-2 text-[13px] font-semibold" dir="auto">
        {name}
      </span>
    </div>
  );
}

function Badge({ s }: { s: EventState }) {
  if (s === "live")
    return (
      <span className="badge badge-live">
        <span className="live-dot" aria-hidden /> Live
      </span>
    );
  if (s === "finished") return <span className="badge badge-ft">Finished</span>;
  return <span className="badge badge-soon">Upcoming</span>;
}

function EventCard({ event }: { event: YacineEvent }) {
  const s = stateOf(event);
  const when = fmtTime(event.startTime);
  return (
    <article className="tile flex flex-col p-4">
      <div className="flex items-center justify-between gap-3">
        <Badge s={s} />
        <span className="kicker truncate" dir="auto">
          {event.competition}
        </span>
      </div>
      <div className="flex items-center gap-3 py-5" dir="rtl">
        <Team name={event.home.name} logo={event.home.logo} />
        <div className="w-20 shrink-0 text-center">
          <div className="font-display text-[22px] leading-none">{when.split(" ").pop()}</div>
          <div className="kicker mt-1">{when.split(" ")[0]}</div>
        </div>
        <Team name={event.away.name} logo={event.away.logo} />
      </div>
      <dl className="rule mt-auto grid gap-1.5 pt-3 text-[12px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Channel</dt>
          <Tv className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <dd className="truncate" dir="auto">
            {event.channel || "Channel to be confirmed"}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Commentary</dt>
          <Mic2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <dd className="truncate" dir="auto">
            {event.commentary || "Commentary to be confirmed"}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function Notice({ children }: { children: string }) {
  return <div className="tile border-primary p-5 text-[14px]">{children}</div>;
}

function LivePage() {
  const { events, directory, eventError, directoryError } = Route.useLoaderData();
  const [query, setQuery] = useState("");

  const ordered = useMemo(() => [...events].sort((a, b) => ORDER[stateOf(a)] - ORDER[stateOf(b)] || a.startTime - b.startTime), [events]);
  const liveCount = ordered.filter((e) => stateOf(e) === "live").length;

  const channels = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (directory?.channels ?? []).filter((item) => !term || `${item.name} ${item.categoryName}`.toLowerCase().includes(term));
  }, [directory, query]);

  return (
    <PageShell
      crumbs={CRUMBS}
      kicker={liveCount > 0 ? `${liveCount} on air` : "Schedule"}
      title="Live events"
      lede="Fixtures from the live metadata feed, with the channel carrying each one. Times are shown in your device's timezone."
      aside={
        <>
          <SideNote title="Looking for a channel?">
            The programme guide with playable channels is on the{" "}
            <Link to="/" hash="channels" className="underline">
              front page
            </Link>
            . The directory below is the raw upstream catalogue.
          </SideNote>
          <SideNote title="Something wrong?">
            Check the{" "}
            <Link to="/status" className="underline">
              status page
            </Link>{" "}
            or{" "}
            <Link to="/contact" className="underline">
              tell us
            </Link>
            . We answer within a day.
          </SideNote>
        </>
      }
    >
      <section aria-labelledby="events-h">
        <div className="rule-heavy mb-4 flex items-end justify-between pt-3">
          <h2 id="events-h" className="text-[1.5rem]">
            Matches
          </h2>
          <button type="button" onClick={() => window.location.reload()} className="btn btn-ghost btn-sm">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
          </button>
        </div>
        {eventError ? (
          <Notice>The events feed is not responding. Try again in a minute.</Notice>
        ) : ordered.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {ordered.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="tile p-8 text-center text-[14px] text-muted-foreground">No events are listed right now.</div>
        )}
      </section>

      <section aria-labelledby="dir-h" className="mt-12">
        <div className="rule-heavy mb-4 flex flex-col justify-between gap-3 pt-3 sm:flex-row sm:items-end">
          <div>
            <h2 id="dir-h" className="text-[1.5rem]">
              Channel directory
            </h2>
            {directory && (
              <p className="kicker mt-1">
                {directory.categories.length} categories, {directory.channels.length} channels
              </p>
            )}
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Search directory</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Channel or category" type="search" className="field pl-9" />
          </label>
        </div>
        {directoryError ? (
          <Notice>The channel directory could not be loaded.</Notice>
        ) : (
          <>
            <ul className="grid gap-px bg-border sm:grid-cols-2">
              {channels.slice(0, 180).map((item) => (
                <li key={`${item.categoryId}-${item.id}`}>
                  <Link
                    to="/watch/$channelId"
                    params={{ channelId: String(item.id) }}
                    search={{ name: item.name, logo: item.logo || undefined }}
                    className="flex min-h-14 items-center gap-3 bg-background px-3 py-2 hover:bg-card"
                  >
                    <ChannelLogo src={item.logo || undefined} name={item.name} group={item.categoryName} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold" dir="auto">
                        {item.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground" dir="auto">
                        {item.categoryName}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {channels.length > 180 && <p className="kicker mt-3 text-center">Showing 180 of {channels.length}. Narrow the search to see more.</p>}
            {channels.length === 0 && <div className="tile p-8 text-center text-[14px] text-muted-foreground">No channel matches your search.</div>}
          </>
        )}
      </section>
    </PageShell>
  );
}
