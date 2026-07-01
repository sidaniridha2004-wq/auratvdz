import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/auratv-logo.png.asset.json";
import { useI18n, type Lang } from "@/lib/i18n";

export function Footer() {
  const { t, lang, setLang } = useI18n();
  const langs: Lang[] = ["ar", "fr", "en"];
  return (
    <footer className="mt-20 border-t border-white/10 bg-black/40 backdrop-blur">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <img src={logoAsset.url} alt="AuraTV" className="h-10 w-10 rounded-xl object-cover" />
            <div>
              <div className="font-display text-lg font-bold text-aurora">AuraTV</div>
              <div className="text-xs text-muted-foreground">{t("footer.tagline")}</div>
            </div>
          </div>
        </div>
        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Quick links
          </div>
          <ul className="space-y-2 text-sm">
            <li><Link to="/" hash="matches" className="hover:text-foreground text-muted-foreground">{t("nav.matches")}</Link></li>
            <li><Link to="/" hash="channels" className="hover:text-foreground text-muted-foreground">{t("nav.channels")}</Link></li>
            <li><Link to="/" hash="favorites" className="hover:text-foreground text-muted-foreground">{t("nav.favorites")}</Link></li>
            <li><Link to="/status" className="hover:text-foreground text-muted-foreground">{t("nav.status")}</Link></li>
            
          </ul>
        </div>
        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Language
          </div>
          <div className="inline-flex overflow-hidden rounded-full border border-white/10 bg-white/5">
            {langs.map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1.5 text-xs font-semibold uppercase transition ${
                  lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            About
          </div>
          <p className="text-xs text-muted-foreground">{t("footer.disclaimer")}</p>
          <a
            href="https://t.me/Aura_TV"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex text-xs text-primary hover:underline"
          >
            @Aura_TV on Telegram
          </a>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
        © 2026 AuraTV · Made for Algeria 🇩🇿
      </div>
    </footer>
  );
}
