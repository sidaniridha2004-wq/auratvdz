import { Link } from "@tanstack/react-router";
import { Play, Sparkles } from "lucide-react";
import { ChannelLogo } from "./ChannelLogo";
import { useFavorites } from "@/lib/favorites";
import { CATEGORY_META, categoryFor, type ChannelCategory } from "@/lib/channel-category";

interface Props {
  slug: string;
  name: string;
  group: string;
  logo?: string;
  href:
    | { to: "/watch/live/$slug"; params: { slug: string } }
    | { to: "/watch/tv/$key"; params: { key: string }; search?: { name?: string } }
    | { to: "/watch/$channelId"; params: { channelId: string }; search?: { name?: string; logo?: string } };
  featured?: boolean;
  category?: ChannelCategory;
}

export function ChannelCard({ slug, name, group, logo, href, featured, category }: Props) {
  const { isFav, toggle } = useFavorites();
  const cat = category ?? categoryFor(group, name);
  const meta = CATEGORY_META[cat];
  const fav = isFav(slug);

  // Entire card is the play surface — a single absolutely-positioned <Link>
  // covering the card catches every click. The favorite star sits above it
  // with stopPropagation so tapping ★ never triggers navigation.
  const link =
    href.to === "/watch/live/$slug" ? (
      <Link to="/watch/live/$slug" params={href.params} className="absolute inset-0 z-10" aria-label={`Play ${name}`} />
    ) : href.to === "/watch/tv/$key" ? (
      <Link to="/watch/tv/$key" params={href.params} search={href.search} className="absolute inset-0 z-10" aria-label={`Play ${name}`} />
    ) : (
      <Link to="/watch/$channelId" params={href.params} search={href.search} className="absolute inset-0 z-10" aria-label={`Play ${name}`} />
    );

  return (
    <div
      className={`group relative flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 shadow-card transition hover:-translate-y-1 hover:shadow-glow ${
        featured
          ? "border-yellow-400/40 bg-gradient-to-br from-yellow-500/10 via-card to-card"
          : "border-white/5 bg-card-gradient hover:border-primary/40"
      }`}
      title={`Play ${name} · ${meta.label}`}
    >
      {link}

      {/* Hover play overlay — desktop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[15] hidden items-center justify-center rounded-2xl bg-black/55 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100 sm:flex"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/70 ring-2 ring-white/70 shadow-glow">
          <Play className="h-6 w-6 fill-white text-white" />
        </div>
      </div>

      <div className="relative z-[20] flex items-start justify-between gap-2">
        <div className="relative">
          <ChannelLogo src={logo} name={name} group={group} className="shrink-0" />
          {/* Mobile persistent play badge in the bottom-right of the logo area */}
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card sm:hidden"
          >
            <Play className="h-2.5 w-2.5 fill-current" />
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle(slug);
          }}
          aria-label={fav ? "Remove favorite" : "Add favorite"}
          title={fav ? "Remove favorite" : "Add favorite"}
          className={`relative z-[25] rounded-full p-1.5 transition ${
            fav ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"
          }`}
        >
          <span aria-hidden="true">{fav ? "★" : "☆"}</span>
        </button>
      </div>

      <div className="relative z-[20] min-w-0 pointer-events-none">
        <div className="truncate text-[16px] font-bold leading-tight">{name}</div>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${meta.bg} ${meta.text}`}
          >
            {meta.label}
          </span>
          {featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-yellow-300">
              <Sparkles className="h-2.5 w-2.5" /> Featured
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-[11px] text-muted-foreground">{group}</div>
      </div>
    </div>
  );
}
