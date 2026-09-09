import { Link } from "@tanstack/react-router";
import { Play, Star } from "lucide-react";
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

/**
 * A row in the programme guide. Logo, name, category, one play affordance.
 * The whole tile is the link; the star is a separate button.
 */
export function ChannelCard({ slug, name, group, logo, href, featured, category }: Props) {
  const { isFav, toggle } = useFavorites();
  const cat = category ?? categoryFor(group, name);
  const meta = CATEGORY_META[cat];
  const fav = isFav(slug);
  const yacineId = /^yacine-(\d+)$/.exec(slug)?.[1];
  const linkCls = "absolute inset-0 z-10 focus:outline-none focus-visible:outline-2 focus-visible:outline-primary";

  const link = yacineId ? (
    <Link to="/watch/$channelId" params={{ channelId: yacineId }} search={{ name, logo }} className={linkCls} aria-label={`Watch ${name}`} />
  ) : href.to === "/watch/live/$slug" ? (
    <Link to="/watch/live/$slug" params={href.params} className={linkCls} aria-label={`Watch ${name}`} />
  ) : href.to === "/watch/tv/$key" ? (
    <Link to="/watch/tv/$key" params={href.params} search={href.search} className={linkCls} aria-label={`Watch ${name}`} />
  ) : (
    <Link to="/watch/$channelId" params={href.params} search={href.search} className={linkCls} aria-label={`Watch ${name}`} />
  );

  return (
    <article className={`tile tile-hover group relative flex items-center gap-3 p-3 ${featured ? "border-primary" : ""}`}>
      {link}
      <ChannelLogo src={logo} name={name} group={group} size={44} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-sans text-[14px] font-semibold leading-tight" dir="auto">
          {name}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="kicker" style={{ color: meta.color }}>
            {meta.label}
          </span>
          <span className="truncate" dir="auto">
            {group}
          </span>
        </div>
      </div>
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground"
      >
        <Play className="h-3.5 w-3.5 fill-current" />
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle(slug);
        }}
        aria-label={fav ? `Remove ${name} from favourites` : `Add ${name} to favourites`}
        aria-pressed={fav}
        className={`absolute -right-1 -top-1 z-20 grid h-7 w-7 place-items-center rounded-full border border-border bg-card ${fav ? "text-accent" : "text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}`}
      >
        <Star className={`h-3.5 w-3.5 ${fav ? "fill-current" : ""}`} />
      </button>
    </article>
  );
}
