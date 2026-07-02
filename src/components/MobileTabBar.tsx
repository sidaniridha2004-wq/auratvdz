import { Link, useLocation } from "@tanstack/react-router";
import { Home, Calendar, Radio, Star } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useFavorites } from "@/lib/favorites";

export function MobileTabBar() {
  const { t } = useI18n();
  const location = useLocation();
  const { count } = useFavorites();
  const hash = location.hash;
  const isHome = location.pathname === "/" && !hash;

  const items = [
    { to: "/", hash: "", icon: Home, label: t("nav.home"), active: isHome },
    { to: "/", hash: "matches", icon: Calendar, label: t("nav.matches"), active: hash === "matches" },
    { to: "/", hash: "channels", icon: Radio, label: t("nav.channels"), active: hash === "channels" },
    { to: "/", hash: "favorites", icon: Star, label: t("nav.favorites"), active: hash === "favorites", badge: count },
  ] as const;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/90 backdrop-blur-xl sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-4">
        {items.map((it) => (
          <Link
            key={it.label}
            to={it.to}
            hash={it.hash || undefined}
            className={`relative flex flex-col items-center gap-1 py-3 text-[11px] font-medium ${
              it.active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <it.icon className="h-6 w-6" />
            <span>{it.label}</span>
            {"badge" in it && it.badge ? (
              <span className="absolute right-3 top-2 rounded-full bg-primary px-1.5 text-[9px] font-bold text-primary-foreground">
                {it.badge}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}
