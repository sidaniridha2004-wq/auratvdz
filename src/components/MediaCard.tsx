import { Link } from "@tanstack/react-router";
import { ChevronRight, Play, Star } from "lucide-react";
import type { TitleSummary } from "@/lib/media.functions";

// Poster tiles for rows and grids. 2:3 like a printed one-sheet, lifted on
// hover with the caption sliding up over a gradient. Ranked rows print a big
// number beside the poster ("Top 10" style).

const WIDTHS = {
  sm: "w-[132px] sm:w-[156px]",
  md: "w-[150px] sm:w-[176px]",
  lg: "w-[170px] sm:w-[200px]",
  fill: "w-full",
} as const;

export function MediaCard({ item, size = "md", rank }: { item: TitleSummary; size?: keyof typeof WIDTHS; rank?: number }) {
  return (
    <Link
      to="/title/$kind/$id"
      params={{ kind: item.kind, id: String(item.id) }}
      className={`poster-card group relative block shrink-0 ${WIDTHS[size]} ${rank ? "pl-7 sm:pl-9" : ""}`}
      aria-label={`${item.title}${item.year ? ` (${item.year})` : ""}`}
    >
      {rank !== undefined && (
        <span
          className="pointer-events-none absolute -left-1 bottom-6 z-0 font-display text-[64px] leading-none text-foreground/20 transition-colors group-hover:text-primary/60 sm:text-[72px]"
          aria-hidden
        >
          {rank}
        </span>
      )}
      <div className="relative z-10 aspect-[2/3] overflow-hidden rounded-xl bg-muted ring-1 ring-white/10 transition-[transform,box-shadow] duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_-12px_rgba(0,0,0,.8)] group-hover:ring-white/25">
        {item.poster ? (
          <img
            src={item.poster}
            alt={`${item.title} poster`}
            loading="lazy"
            decoding="async"
            width={342}
            height={513}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center p-3 text-center font-display text-lg text-muted-foreground" aria-hidden>
            {item.title}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
        <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[.14em] text-white/90 backdrop-blur">
          {item.kind === "movie" ? "Film" : "Series"}
        </span>
        {item.rating !== null && item.rating > 0 && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-accent backdrop-blur">
            <Star className="h-3 w-3 fill-current" aria-hidden />
            {item.rating.toFixed(1)}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 translate-y-1 p-2.5 transition-transform duration-300 group-hover:translate-y-0">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <div className="line-clamp-2 text-[13px] font-semibold leading-tight text-white drop-shadow" dir="auto">
                {item.title}
              </div>
              <div className="mt-0.5 text-[11px] text-white/70">{item.year ?? "—"}</div>
            </div>
            <span className="grid h-8 w-8 shrink-0 scale-75 place-items-center rounded-full bg-primary text-primary-foreground opacity-0 shadow transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
              <Play className="ml-0.5 h-3.5 w-3.5 fill-current" aria-hidden />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function MediaRow({
  title,
  eyebrow,
  items,
  moreHref,
  ranked,
}: {
  title: string;
  eyebrow?: string;
  items: TitleSummary[];
  moreHref?: { to: string; search?: Record<string, unknown>; hash?: string };
  ranked?: boolean;
}) {
  if (!items.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          {eyebrow && <div className="kicker text-primary">{eyebrow}</div>}
          <h2 className="text-[1.35rem] sm:text-[1.6rem]">{title}</h2>
        </div>
        {moreHref && (
          <Link to={moreHref.to} search={moreHref.search} hash={moreHref.hash} className="kicker inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            See all <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-3 pt-1 sm:-mx-6 sm:gap-4 sm:px-6">
        {items.map((item, i) => (
          <MediaCard key={`${item.kind}-${item.id}`} item={item} size={ranked ? "lg" : "md"} rank={ranked ? i + 1 : undefined} />
        ))}
      </div>
    </section>
  );
}

export function MediaGrid({ items }: { items: TitleSummary[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
      {items.map((item) => (
        <MediaCard key={`${item.kind}-${item.id}`} item={item} size="fill" />
      ))}
    </div>
  );
}
