import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Wordmark } from "@/components/Wordmark";
import { useI18n, type Lang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useFavorites } from "@/lib/favorites";

const NAV: Array<{ to: string; hash?: string; label: string; key?: string }> = [
  { to: "/", hash: "matches", label: "Fixtures", key: "nav.matches" },
  { to: "/", hash: "channels", label: "Channels", key: "nav.channels" },
  { to: "/live", label: "Live" },
  { to: "/status", label: "Status", key: "nav.status" },
  { to: "/about", label: "About" },
  { to: "/faq", label: "FAQ" },
  { to: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const { count } = useFavorites();
  const [open, setOpen] = useState(false);
  const langs: Lang[] = ["ar", "fr", "en"];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const today = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Algiers",
  }).format(new Date());

  return (
    <header className="sticky top-0 z-40 bg-background/95 rule-b backdrop-blur-sm">
      {/* Top line: date + language + theme, like a newspaper masthead */}
      <div className="wrap hidden h-8 items-center justify-between text-[11px] text-muted-foreground md:flex">
        <span className="kicker">{today} · Algiers</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            {langs.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`kicker px-1.5 py-0.5 ${lang === l ? "text-foreground underline" : "hover:text-foreground"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={toggle}
            className="inline-flex h-6 w-6 items-center justify-center hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <div className="wrap flex h-14 items-center gap-4 md:rule">
        <Link to="/" aria-label="AuraTV home" className="shrink-0">
          <Wordmark />
        </Link>

        <nav aria-label="Primary" className="ml-6 hidden items-center gap-5 text-[14px] md:flex">
          {NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              hash={item.hash}
              className="text-muted-foreground hover:text-foreground hover:underline"
              activeProps={{ className: "text-foreground" }}
              activeOptions={{ exact: true, includeHash: false }}
            >
              {item.key ? t(item.key) : item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {count > 0 && (
            <Link to="/" hash="favorites" className="kicker hidden text-accent hover:underline sm:inline">
              ★ {count}
            </Link>
          )}
          <Link to="/download" className="btn btn-outline btn-sm hidden sm:inline-flex">
            Get the app
          </Link>
          <Link to="/" hash="channels" className="btn btn-primary btn-sm">
            Watch now
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label="Mobile" className="wrap rule pb-4 md:hidden">
          <ul className="grid grid-cols-2 gap-x-6">
            {NAV.map((item) => (
              <li key={item.label} className="rule-b">
                <Link
                  to={item.to}
                  hash={item.hash}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-[15px]"
                >
                  {item.key ? t(item.key) : item.label}
                </Link>
              </li>
            ))}
            <li className="rule-b">
              <Link to="/download" onClick={() => setOpen(false)} className="block py-3 text-[15px]">
                Android app
              </Link>
            </li>
            <li className="rule-b">
              <Link to="/settings/channels" onClick={() => setOpen(false)} className="block py-3 text-[15px]">
                {t("settings.title")}
              </Link>
            </li>
          </ul>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {langs.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={`kicker px-2 py-1 ${lang === l ? "text-foreground underline" : "text-muted-foreground"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button type="button" onClick={toggle} className="btn btn-ghost btn-sm">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Light" : "Dark"}
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
