import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "fr" | "ar";

type Dict = Record<string, string>;

const EN: Dict = {
  "nav.matches": "Matches",
  "nav.channels": "Channels",
  "nav.favorites": "Favorites",
  "nav.home": "Home",
  "nav.status": "Status",
  "nav.settings": "Settings",
  "nav.watch_live": "Watch live",
  "hero.tagline": "Watch beIN Sports, Algeria TV, MBC, France TV — live, free, HD. Built for Algeria.",
  "hero.today": "Today's matches",
  "hero.browse": "Browse channels",
  "hero.badge": "LIVE · HD\u00A0",
  "ticker.live": "LIVE",
  "ticker.today_matches": "today's matches",
  "ticker.next": "Next kickoff",
  "section.schedule": "Match Schedule",
  "section.channels": "Channel Universe",
  "section.fixtures": "Fixtures",
  "section.live_tv": "Live TV",
  "section.bein_primary": "beIN SPORTS MAX — Primary",
  "section.favorites": "My Favorites",
  "favorites.empty": "Tap ★ on any channel to save it here.",
  "day.yesterday": "yesterday",
  "day.today": "today",
  "day.tomorrow": "tomorrow",
  "search.channels": "Search channels…",
  "player.select_quality": "Select Quality",
  "player.quality_tip": "Higher quality requires faster internet.",
  "player.unavailable": "Stream temporarily unavailable — try another server",
  "player.mirror": "Try Mirror Server",
  "player.loading": "Loading stream…",
  "status.title": "Channel Status",
  "status.subtitle": "Automated uptime checks for every channel.",
  "status.up": "Online",
  "status.down": "Offline",
  "status.last_check": "Last check",
  "status.response": "Response",
  "status.reason": "Reason",
  "status.refresh": "Refresh now",
  "footer.tagline": "Live sports & TV, built for Algeria.",
  "footer.disclaimer": "Fixtures powered by syrlive · Streams are third-party sources.",
  "install.title": "Install AuraTV",
  "install.body": "Add to your home screen for one-tap access.",
  "install.dismiss": "Not now",
  "settings.title": "My Channels",
  "settings.subtitle": "Add your own streams — they stay on this device.",
  "settings.name": "Channel name",
  "settings.category": "Category",
  "settings.logo": "Logo URL (optional)",
  "settings.quality": "Quality label",
  "settings.stream_url": "Stream URL (.m3u8)",
  "settings.add_source": "+ Add another quality",
  "settings.save": "Save channel",
  "settings.remove": "Remove",
  "settings.empty": "No custom channels yet.",
};

const FR: Dict = {
  "nav.matches": "Matchs",
  "nav.channels": "Chaînes",
  "nav.favorites": "Favoris",
  "nav.home": "Accueil",
  "nav.status": "État",
  "nav.settings": "Réglages",
  "nav.watch_live": "Regarder en direct",
  "hero.tagline": "Regardez beIN Sports, Algeria TV, MBC, France TV — en direct, gratuit, HD. Fait pour l'Algérie.",
  "hero.today": "Matchs du jour",
  "hero.browse": "Parcourir les chaînes",
  "hero.badge": "LIVE · HD\u00A0",
  "ticker.live": "EN DIRECT",
  "ticker.today_matches": "matchs aujourd'hui",
  "ticker.next": "Prochain coup d'envoi",
  "section.schedule": "Calendrier des matchs",
  "section.channels": "Univers des chaînes",
  "section.fixtures": "Rencontres",
  "section.live_tv": "TV en direct",
  "section.bein_primary": "beIN SPORTS MAX — Serveur principal",
  "section.favorites": "Mes favoris",
  "favorites.empty": "Touchez ★ sur une chaîne pour l'enregistrer ici.",
  "day.yesterday": "hier",
  "day.today": "aujourd'hui",
  "day.tomorrow": "demain",
  "search.channels": "Rechercher…",
  "player.select_quality": "Choisir la qualité",
  "player.quality_tip": "Une qualité plus élevée nécessite une meilleure connexion.",
  "player.unavailable": "Flux temporairement indisponible — essayez un autre serveur",
  "player.mirror": "Serveur miroir",
  "player.loading": "Chargement…",
  "status.title": "État des chaînes",
  "status.subtitle": "Vérifications de disponibilité automatisées.",
  "status.up": "En ligne",
  "status.down": "Hors ligne",
  "status.last_check": "Dernière vérification",
  "status.response": "Réponse",
  "status.reason": "Raison",
  "status.refresh": "Actualiser",
  "footer.tagline": "Sport et TV en direct, fait pour l'Algérie.",
  "footer.disclaimer": "Programme fourni par syrlive · Les flux sont des sources tierces.",
  "install.title": "Installer AuraTV",
  "install.body": "Ajoutez à l'écran d'accueil pour un accès rapide.",
  "install.dismiss": "Plus tard",
  "settings.title": "Mes chaînes",
  "settings.subtitle": "Ajoutez vos propres flux — ils restent sur cet appareil.",
  "settings.name": "Nom de la chaîne",
  "settings.category": "Catégorie",
  "settings.logo": "URL du logo (optionnel)",
  "settings.quality": "Qualité",
  "settings.stream_url": "URL du flux (.m3u8)",
  "settings.add_source": "+ Ajouter une qualité",
  "settings.save": "Enregistrer",
  "settings.remove": "Supprimer",
  "settings.empty": "Aucune chaîne personnalisée.",
};

const AR: Dict = {
  "nav.matches": "المباريات",
  "nav.channels": "القنوات",
  "nav.favorites": "المفضلة",
  "nav.home": "الرئيسية",
  "nav.status": "الحالة",
  "nav.settings": "الإعدادات",
  "nav.watch_live": "شاهد مباشرة",
  "hero.tagline": "شاهد beIN Sports وقنوات الجزائر وMBC وقنوات فرنسا مباشرة، مجاناً وبجودة عالية. مصنوع للجزائر.",
  "hero.today": "مباريات اليوم",
  "hero.browse": "استعرض القنوات",
  "hero.badge": "LIVE · HD\u00A0",
  "ticker.live": "مباشر",
  "ticker.today_matches": "مباريات اليوم",
  "ticker.next": "أقرب مباراة",
  "section.schedule": "جدول المباريات",
  "section.channels": "قنواتنا",
  "section.fixtures": "المباريات",
  "section.live_tv": "بث مباشر",
  "section.bein_primary": "beIN SPORTS MAX — الخادم الأساسي",
  "section.favorites": "مفضلتي",
  "favorites.empty": "اضغط على ★ لحفظ قناة هنا.",
  "day.yesterday": "أمس",
  "day.today": "اليوم",
  "day.tomorrow": "غداً",
  "search.channels": "ابحث عن قناة…",
  "player.select_quality": "اختر الجودة",
  "player.quality_tip": "الجودة الأعلى تحتاج إنترنت أسرع.",
  "player.unavailable": "البث غير متوفر — جرّب خادماً آخر",
  "player.mirror": "خادم بديل",
  "player.loading": "جاري التحميل…",
  "status.title": "حالة القنوات",
  "status.subtitle": "فحص دوري لكل قناة.",
  "status.up": "يعمل",
  "status.down": "معطّل",
  "status.last_check": "آخر فحص",
  "status.response": "الاستجابة",
  "status.reason": "السبب",
  "status.refresh": "تحديث",
  "footer.tagline": "قنوات ومباريات مباشرة، صُنعت للجزائر.",
  "footer.disclaimer": "المباريات من syrlive · البث من مصادر خارجية.",
  "install.title": "ثبّت AuraTV",
  "install.body": "أضفه إلى الشاشة الرئيسية للوصول السريع.",
  "install.dismiss": "لاحقاً",
  "settings.title": "قنواتي",
  "settings.subtitle": "أضف روابط بثك الخاصة — تُحفظ على جهازك فقط.",
  "settings.name": "اسم القناة",
  "settings.category": "الفئة",
  "settings.logo": "رابط الشعار (اختياري)",
  "settings.quality": "الجودة",
  "settings.stream_url": "رابط البث (.m3u8)",
  "settings.add_source": "+ أضف جودة أخرى",
  "settings.save": "حفظ",
  "settings.remove": "حذف",
  "settings.empty": "لا قنوات مخصصة بعد.",
};

const DICTS: Record<Lang, Dict> = { en: EN, fr: FR, ar: AR };
const STORAGE_KEY = "auratv:lang";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: keyof typeof EN | string) => string;
  dir: "ltr" | "rtl";
}
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved === "en" || saved === "fr" || saved === "ar") setLangState(saved);
    } catch {}
  }, []);

  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", lang);
      document.documentElement.setAttribute("dir", dir);
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  };

  const value = useMemo<Ctx>(() => {
    const dict = DICTS[lang];
    return {
      lang,
      setLang,
      dir: lang === "ar" ? "rtl" : "ltr",
      t: (k) => dict[k as string] ?? EN[k as string] ?? (k as string),
    };
  }, [lang]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18nCtx);
  if (!c) {
    // Fallback: usable outside provider (SSR shell).
    return { lang: "en", setLang: () => {}, dir: "ltr", t: (k) => EN[k as string] ?? (k as string) };
  }
  return c;
}
