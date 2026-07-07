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
      <Link to="/watch/live/$slug" params={href.params} className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Play ${name}`} />
    ) : href.to === "/watch/tv/$key" ? (
      <Link to="/watch/tv/$key" params={href.params} search={href.search} className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Play ${name}`} />
    ) : (
      <Link to="/watch/$channelId" params={href.params} search={href.search} className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`Play ${name}`} />
    );

  return (
    <div
      className={`group card-hover relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-card-gradient shadow-card ${
        featured
          ? "border-primary/30"
          : "border-white/[0.06]"
      }`}
      title={`Play ${name}`}
      tabIndex={0}
    >
      {link}

      {/* LOGO PLATE — full-width, generous, cinematic */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-black">
        {/* Category-tinted radial wash — kept subtle so logos stay legible */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-20 transition duration-500 group-hover:opacity-35"
          style={{
            background: `radial-gradient(ellipse 80% 70% at 50% 40%, ${meta.color} 0%, transparent 65%)`,
          }}
        />
        {/* Subtle scanline / vignette */}
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55)_100%)]" />

        <div className="relative z-[1] flex h-full items-center justify-center p-5">
          <ChannelLogo src={logo} name={name} group={group} size={80} className="drop-shadow-[0_6px_20px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-105" />
        </div>

        {/* Favorite — top-right, above link */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle(slug);
          }}
          aria-label={fav ? "Remove favorite" : "Add favorite"}
          className={`absolute right-2 top-2 z-[25] grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/50 text-base backdrop-blur transition hover:bg-black/80 ${
            fav ? "text-yellow-300" : "text-white/60 hover:text-yellow-300"
          }`}
        >
          <span aria-hidden="true">{fav ? "★" : "☆"}</span>
        </button>

        {/* Play affordance — always visible on mobile, hover on desktop */}
        <div className="pointer-events-none absolute bottom-2 right-2 z-[15] grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow transition duration-300 sm:opacity-0 sm:group-hover:opacity-100 sm:translate-y-1 sm:group-hover:translate-y-0">
          <Play className="h-4 w-4 fill-current" />
        </div>

        {featured && (
          <span className="absolute left-2 top-2 z-[15] inline-flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary-foreground">
            <Sparkles className="h-2.5 w-2.5" /> Featured
          </span>
        )}
      </div>

      {/* META STRIP */}
      <div className="relative z-[5] flex flex-col gap-1.5 border-t border-white/[0.05] bg-black/30 p-3 pointer-events-none">
        <div className="truncate text-[14px] font-bold leading-tight text-foreground">{name}</div>
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] ${meta.bg} ${meta.text}`}>
            {meta.label}
          </span>
          <span className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">{group}</span>
        </div>
      </div>
    </div>
  );
}
