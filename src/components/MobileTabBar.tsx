import { Link, useLocation } from "@tanstack/react-router";
import { CalendarDays, Home, Play, Radio, Star } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useFavorites } from "@/lib/favorites";

// Bottom tab bar (mobile only). The centre "Watch" item doubles as the
// sticky mobile call-to-action: it is always visible, always red, and always
// one tap from playback.
export function MobileTabBar() {
  const { t } = useI18n();
  const location = useLocation();
  const { count } = useFavorites();
  const hash = location.hash;
  const path = location.pathname;

  // Hide on the player pages so it never overlaps the video.
  if (path.startsWith("/watch") || path.startsWith("/play")) return null;

  const item = (active: boolean) =>
    `flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${active ? "text-foreground" : "text-muted-foreground"}`;

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 bg-background rule sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5 items-end">
        <Link to="/" className={item(path === "/" && !hash)}>
          <Home className="h-5 w-5" aria-hidden />
          {t("nav.home")}
        </Link>
        <Link to="/" hash="matches" className={item(path === "/" && hash === "matches")}>
          <CalendarDays className="h-5 w-5" aria-hidden />
          {t("nav.matches")}
        </Link>
        <Link
          to="/"
          hash="channels"
          aria-label="Watch live TV now"
          className="-mt-4 flex flex-col items-center gap-0.5 text-[11px] font-semibold text-foreground"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
            <Play className="h-5 w-5 fill-current" aria-hidden />
          </span>
          Watch
        </Link>
        <Link to="/live" className={item(path === "/live")}>
          <Radio className="h-5 w-5" aria-hidden />
          Live
        </Link>
        <Link to="/" hash="favorites" className={`relative ${item(path === "/" && hash === "favorites")}`}>
          <Star className="h-5 w-5" aria-hidden />
          {t("nav.favorites")}
          {count > 0 && (
            <span className="absolute right-3 top-1 rounded-sm bg-accent px-1 text-[9px] font-bold text-accent-foreground">
              {count}
            </span>
          )}
        </Link>
      </div>
    </nav>
  );
}
