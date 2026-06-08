import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Search, Radio, ChevronRight } from "lucide-react";
import { getCategories, getCategoryChannels } from "@/lib/yacine.functions";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/")({
  component: Home,
  errorComponent: ({ error, reset }) => (
    <ErrorView message={error.message} reset={reset} />
  ),
});

function ErrorView({ message, reset }: { message: string; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <p className="text-destructive">{message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function Home() {
  const fetchCats = useServerFn(getCategories);
  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCats(),
    staleTime: 5 * 60_000,
  });

  const [selected, setSelected] = useState<number | null>(null);
  const [q, setQ] = useState("");

  // auto-select first category
  const activeId = selected ?? categories?.[0]?.id ?? null;

  const fetchChannels = useServerFn(getCategoryChannels);
  const { data: channels, isLoading: chLoading } = useQuery({
    queryKey: ["channels", activeId],
    queryFn: () => fetchChannels({ data: { categoryId: activeId! } }),
    enabled: activeId != null,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    if (!channels) return [];
    const visible = channels.filter((c) => c.is_hide === 0);
    if (!q.trim()) return visible;
    const needle = q.toLowerCase();
    return visible.filter((c) => c.name.toLowerCase().includes(needle));
  }, [channels, q]);

  const activeCategory = categories?.find((c) => c.id === activeId);

  return (
    <div className="min-h-screen bg-hero">
      <SiteHeader />

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-4 pt-12 pb-8 sm:px-6 sm:pt-20">
        <div className="flex flex-col gap-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
            <span className="live-dot" /> Streaming live now
          </div>
          <h1 className="max-w-3xl text-5xl font-bold leading-[0.95] sm:text-7xl">
            Every match.
            <br />
            <span className="text-primary">Every channel.</span>
            <br />
            One screen.
          </h1>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            Browse hundreds of live sports, entertainment and news channels —
            beIN SPORTS, MBC, France TV and more, in HD.
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Categories</h2>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            {categories?.length ?? 0} total
          </div>
        </div>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-2 pb-2">
            {isLoading && (
              <div className="flex gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-10 w-32 animate-pulse rounded-full bg-secondary" />
                ))}
              </div>
            )}
            {categories?.map((cat) => {
              const active = cat.id === activeId;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelected(cat.id)}
                  className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "border border-border bg-card/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Channels grid */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold">{activeCategory?.name ?? "Channels"}</h2>
            <p className="text-sm text-muted-foreground">
              {filtered.length} channel{filtered.length === 1 ? "" : "s"} available
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search channels…"
              className="w-full rounded-full border border-border bg-card/60 py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
        </div>

        {chLoading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-xl bg-card" />
            ))}
          </div>
        )}

        {!chLoading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            No channels found.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((ch) => (
            <Link
              key={ch.id}
              to="/watch/$channelId"
              params={{ channelId: String(ch.id) }}
              className="group relative flex aspect-video flex-col justify-between overflow-hidden rounded-xl bg-card-gradient p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-glow"
            >
              <div className="flex items-start justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-destructive">
                  <span className="live-dot" /> Live
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
              </div>
              <div className="flex items-end justify-between gap-2">
                {ch.logo ? (
                  <img
                    src={ch.logo}
                    alt={ch.name}
                    loading="lazy"
                    className="h-10 w-10 rounded-md bg-black/30 object-contain p-1"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-black/30 text-primary">
                    <Radio className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1 text-right">
                  <div className="truncate text-sm font-semibold">{ch.name}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        Powered by the unofficial{" "}
        <a
          href="https://github.com/aimadnet/yacinetv-api"
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          yacinetv-api
        </a>
        .
      </footer>
    </div>
  );
}
