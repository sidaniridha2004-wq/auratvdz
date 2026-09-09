import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, Mic2, Radio, RefreshCw, Search, Trophy } from "lucide-react";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";
import {
  getYacineDirectory,
  getYacineEvents,
  type YacineEvent,
} from "@/lib/yacine.functions";

export const Route = createFileRoute("/live")({
  loader: async () => {
    const [events, directory] = await Promise.allSettled([
      getYacineEvents(),
      getYacineDirectory(),
    ]);
    return {
      events: events.status === "fulfilled" ? events.value : [],
      directory: directory.status === "fulfilled" ? directory.value : null,
      eventError: events.status === "rejected",
      directoryError: directory.status === "rejected",
    };
  },
  component: LivePage,
});

const state = (event: YacineEvent) => {
  const now = Date.now() / 1000;
  return now < event.startTime
    ? "upcoming"
    : !event.endTime || now <= event.endTime
      ? "live"
      : "finished";
};
const eventTime = (value: number) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value * 1000));

function Team({ name, logo }: { name: string; logo: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center">
      {logo ? (
        <img src={logo} alt="" loading="lazy" className="h-16 w-16 rounded-2xl bg-white/5 object-contain p-2" />
      ) : (
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/5 text-xl font-black text-primary">
          {name.slice(0, 1)}
        </div>
      )}
      <span className="line-clamp-2 text-sm font-semibold" dir="auto">{name}</span>
    </div>
  );
}

function EventCard({ event }: { event: YacineEvent }) {
  const status = state(event);
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-card-gradient shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2 truncate" dir="auto">
          <Trophy className="h-4 w-4 shrink-0 text-primary" /> {event.competition}
        </span>
        <b className={`rounded-full px-2.5 py-1 text-[10px] uppercase ${status === "live" ? "bg-emerald-500/15 text-emerald-300" : "bg-orange-500/15 text-orange-300"}`}>
          {status}
        </b>
      </div>
      <div className="flex items-center gap-3 px-4 py-6" dir="rtl">
        <Team name={event.home.name} logo={event.home.logo} />
        <div className="w-24 shrink-0 text-center">
          <div className="text-xs text-muted-foreground">{eventTime(event.startTime)}</div>
          <strong className="font-display text-2xl text-primary">VS</strong>
        </div>
        <Team name={event.away.name} logo={event.away.logo} />
      </div>
      <div className="grid gap-2 border-t border-white/10 bg-black/10 px-4 py-3 text-xs text-muted-foreground sm:grid-cols-2">
        <span className="flex items-center gap-2"><Radio className="h-4 w-4 text-primary" />{event.channel || "Channel TBA"}</span>
        <span className="flex items-center gap-2 sm:justify-end"><Mic2 className="h-4 w-4 text-accent" />{event.commentary || "Commentary TBA"}</span>
      </div>
    </article>
  );
}

function ErrorBox({ children }: { children: string }) {
  return <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">{children}</div>;
}

function LivePage() {
  const { events, directory, eventError, directoryError } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const ordered = useMemo(
    () => [...events].sort((a, b) => ({ live: 0, upcoming: 1, finished: 2 })[state(a)] - ({ live: 0, upcoming: 1, finished: 2 })[state(b)] || a.startTime - b.startTime),
    [events],
  );
  const channels = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (directory?.channels ?? []).filter((item) =>
      !term || `${item.name} ${item.categoryName}`.toLowerCase().includes(term),
    );
  }, [directory, query]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-7xl space-y-12 px-4 py-8 pb-24 sm:px-6 sm:py-12">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-card-gradient px-5 py-8 shadow-card sm:px-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.14),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,.12),transparent_45%)]" />
          <div className="relative max-w-3xl">
            <div className="mb-4 text-xs font-bold uppercase tracking-[.16em] text-emerald-300">● Live data</div>
            <h1 className="font-display text-3xl font-black sm:text-5xl">Live matches & channel directory</h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
              Current fixtures, teams, broadcast channels and commentary from the live metadata feed. Times use your device’s timezone.
            </p>
          </div>
        </section>

        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-primary"><CalendarDays className="h-5 w-5" /> Schedule</div>
              <h2 className="mt-2 font-display text-2xl font-black sm:text-3xl">Live & upcoming matches</h2>
            </div>
            <button onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold hover:bg-white/10"><RefreshCw className="h-4 w-4" /> Refresh</button>
          </div>
          {eventError ? <ErrorBox>Could not load live events.</ErrorBox> : ordered.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{ordered.map((event) => <EventCard key={event.id} event={event} />)}</div>
          ) : <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-muted-foreground">No events are listed right now.</div>}
        </section>

        <section>
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-primary"><Radio className="h-5 w-5" /> Directory</div>
              <h2 className="mt-2 font-display text-2xl font-black sm:text-3xl">API channel catalogue</h2>
              {directory && <p className="mt-2 text-sm text-muted-foreground">{directory.categories.length} categories · {directory.channels.length} channels</p>}
            </div>
            <label className="relative block w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search channel or category" className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-3 text-sm outline-none focus:border-primary/60" />
            </label>
          </div>
          {directoryError ? <ErrorBox>Could not load the channel directory.</ErrorBox> : (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-card-gradient">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3">
                {channels.slice(0, 180).map((item) => (
                  <div key={`${item.categoryId}-${item.id}`} className="flex min-h-16 items-center gap-3 border-b border-white/10 px-4 py-3 hover:bg-white/5">
                    {item.logo ? <img src={item.logo} alt="" loading="lazy" className="h-10 w-10 rounded-lg bg-white/5 object-contain p-1" /> : <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/5 font-black text-primary">{item.name[0]}</div>}
                    <div className="min-w-0"><div className="truncate text-sm font-semibold" dir="auto">{item.name}</div><div className="truncate text-xs text-muted-foreground" dir="auto">{item.categoryName}</div></div>
                  </div>
                ))}
              </div>
              {channels.length > 180 && <div className="p-3 text-center text-xs text-muted-foreground">Showing 180 results. Refine your search to narrow the list.</div>}
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-6 text-muted-foreground">
          Metadata only. Use content you are authorized to access. Existing AuraTV channels remain in the <Link to="/" hash="channels" className="font-semibold text-primary">channels section</Link>.
        </aside>
      </main>
      <Footer />
    </div>
  );
}
