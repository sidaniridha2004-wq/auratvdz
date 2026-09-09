import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import type { TitleSummary } from "@/lib/media.functions";

// Poster tile used in rows and grids. Ratio 2:3 like a printed one-sheet;
// text sits under the poster rather than over it so it stays legible.

export function MediaCard({ item, size = "md" }: { item: TitleSummary; size?: "sm" | "md" }) {
  const width = size === "sm" ? "w-[124px] sm:w-[140px]" : "w-full";
  return (
    <Link
      to="/title/$kind/$id"
      params={{ kind: item.kind, id: String(item.id) }}
      className={`group block shrink-0 ${width}`}
      aria-label={`${item.title}${item.year ? ` (${item.year})` : ""}`}
    >
      <div className="tile tile-hover relative aspect-[2/3] overflow-hidden bg-muted">
        {item.poster ? (
          <img
            src={item.poster}
            alt={`${item.title} poster`}
            loading="lazy"
            decoding="async"
            width={342}
            height={513}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center p-3 text-center font-display text-lg text-muted-foreground" aria-hidden>
            {item.title}
          </div>
        )}
        <span className="kicker absolute left-2 top-2 bg-background/90 px-1.5 py-0.5 text-[10px]">
          {item.kind === "movie" ? "Film" : "Series"}
        </span>
      </div>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="line-clamp-1 text-[14px] font-semibold group-hover:underline" dir="auto">
            {item.title}
          </div>
          <div className="kicker text-muted-foreground">{item.year ?? "—"}</div>
        </div>
        {item.rating !== null && (
          <span className="kicker inline-flex shrink-0 items-center gap-1 text-accent">
            <Star className="h-3 w-3 fill-current" aria-hidden />
            {item.rating.toFixed(1)}
          </span>
        )}
      </div>
    </Link>
  );
}

export function MediaRow({ title, items, moreHref }: { title: string; items: TitleSummary[]; moreHref?: { to: string; search?: Record<string, unknown> } }) {
  if (!items.length) return null;
  return (
    <section className="rule-heavy pt-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[1.35rem]">{title}</h2>
        {moreHref && (
          <Link to={moreHref.to} search={moreHref.search} className="kicker text-muted-foreground hover:text-foreground hover:underline">
            See all
          </Link>
        )}
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:px-0">
        {items.map((item) => (
          <MediaCard key={`${item.kind}-${item.id}`} item={item} size="sm" />
        ))}
      </div>
    </section>
  );
}

export function MediaGrid({ items }: { items: TitleSummary[] }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6">
      {items.map((item) => (
        <MediaCard key={`${item.kind}-${item.id}`} item={item} />
      ))}
    </div>
  );
}
