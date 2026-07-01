import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/auratv-logo.png.asset.json";
import { Flame, Radio, Star, Sun, Moon, Activity } from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useFavorites } from "@/lib/favorites";

export function SiteHeader() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const { count } = useFavorites();
  const langs: Lang[] = ["ar", "fr", "en"];

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="group flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            <div className="absolute inset-0 -z-10 rounded-2xl bg-primary/40 blur-xl transition group-hover:bg-primary/60" />
            <img
              src={logoAsset.url}
              alt="AuraTV"
              className="h-10 w-10 rounded-2xl object-cover shadow-glow transition-transform duration-500 group-hover:scale-105"
            />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate font-display text-lg font-bold tracking-tight">
              <span className="text-aurora">AuraTV</span>
            </div>
            <div className="truncate text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {t("hero.badge")}
            </div>
          </div>
        </Link>

        <nav className="ml-auto flex shrink-0 items-center gap-1 text-sm">
          <Link
            to="/"
            hash="matches"
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-muted-foreground transition hover:bg-white/10 hover:text-foreground md:inline-flex"
          >
            <Flame className="h-4 w-4" /> {t("nav.matches")}
          </Link>
          <Link
            to="/"
            hash="channels"
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-muted-foreground transition hover:bg-white/10 hover:text-foreground md:inline-flex"
          >
            <Radio className="h-4 w-4" /> {t("nav.channels")}
          </Link>
          {count > 0 && (
            <Link
              to="/"
              hash="favorites"
              className="hidden items-center gap-1.5 rounded-full bg-yellow-400/10 px-3 py-2 font-semibold text-yellow-300 transition hover:bg-yellow-400/20 md:inline-flex"
            >
              <Star className="h-4 w-4 fill-current" /> {count}
            </Link>
          )}
          <Link
            to="/status"
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-muted-foreground transition hover:bg-white/10 hover:text-foreground lg:inline-flex"
          >
            <Activity className="h-4 w-4" /> {t("nav.status")}
          </Link>
          <Link
            to="/settings/channels"
            aria-label={t("nav.settings")}
            className="hidden rounded-full p-2 text-muted-foreground transition hover:bg-white/10 hover:text-foreground lg:inline-flex"
          >
            <Settings className="h-4 w-4" />
          </Link>

          {/* Lang switcher */}
          <div className="hidden overflow-hidden rounded-full border border-white/10 bg-white/5 text-[10px] font-bold uppercase sm:flex">
            {langs.map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2 py-1.5 transition ${
                  lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Theme toggle */}
          <button
            aria-label="Toggle theme"
            onClick={toggle}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </nav>
      </div>
    </header>
  );
}
