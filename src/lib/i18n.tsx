import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "en" | "fr" | "ar";

type Dict = Record<string, string>;

const EN: Dict = {
  "nav.matches": "Fixtures",
  "nav.channels": "Channels",
  "nav.favorites": "Saved",
  "nav.home": "Home",
  "nav.status": "Status",
  "nav.settings": "My channels",
  "nav.watch_live": "Watch live",
  "hero.tagline": "Today's football, the channel showing it, and a player that works. Free, no account.",
  "hero.today": "Today's fixtures",
  "hero.browse": "Browse channels",
  "hero.badge": "Live",
  "ticker.live": "Live",
  "ticker.today_matches": "matches today",
  "ticker.next": "Next kick-off",
  "section.schedule": "Match schedule",
  "section.channels": "Channel guide",
  "section.fixtures": "Fixtures",
  "section.live_tv": "Live TV",
  "section.bein_primary": "beIN Sports MAX",
  "section.favorites": "Saved channels",
  "favorites.empty": "Press the star on a channel and it will show up here.",
  "day.yesterday": "yesterday",
  "day.today": "today",
  "day.tomorrow": "tomorrow",
  "search.channels": "Find a channel",
  "player.select_quality": "Quality",
  "player.quality_tip": "Drop the quality if the picture keeps stalling.",
  "player.unavailable": "This source is down right now. Try another one.",
  "player.mirror": "Try another source",
  "player.loading": "Connecting",
  "status.title": "Channel status",
  "status.subtitle": "We check every channel automatically and post the result here.",
  "status.up": "Online",
  "status.down": "Offline",
  "status.last_check": "Last check",
  "status.response": "Response",
  "status.reason": "Reason",
  "status.refresh": "Check again",
  "footer.tagline": "Live sport and TV guide for Algeria.",
  "footer.disclaimer": "AuraTV does not host any video. Streams come from third-party sources and are removed on request.",
  "install.title": "Put AuraTV on your home screen",
  "install.body": "One tap to today's fixtures. No app store needed.",
  "install.cta": "Add to home screen",
  "install.dismiss": "Not now",
  "settings.title": "My channels",
  "settings.subtitle": "Add your own stream links. They stay on this device and are never uploaded.",
  "settings.name": "Channel name",
  "settings.category": "Category",
  "settings.logo": "Logo URL (optional)",
  "settings.quality": "Quality label",
  "settings.stream_url": "Stream URL (.m3u8)",
  "settings.add_source": "Add another quality",
  "settings.save": "Save channel",
  "settings.remove": "Remove",
  "settings.empty": "You have not added any channels yet.",
};

const FR: Dict = {
  "nav.matches": "Matchs",
  "nav.channels": "Chaînes",
  "nav.favorites": "Enregistrées",
  "nav.home": "Accueil",
  "nav.status": "État",
  "nav.settings": "Mes chaînes",
  "nav.watch_live": "Regarder en direct",
  "hero.tagline": "Le foot du jour, la chaîne qui le diffuse, et un lecteur qui marche. Gratuit, sans compte.",
  "hero.today": "Matchs du jour",
  "hero.browse": "Voir les chaînes",
  "hero.badge": "Direct",
  "ticker.live": "En direct",
  "ticker.today_matches": "matchs aujourd'hui",
  "ticker.next": "Prochain coup d'envoi",
  "section.schedule": "Calendrier",
  "section.channels": "Guide des chaînes",
  "section.fixtures": "Rencontres",
  "section.live_tv": "TV en direct",
  "section.bein_primary": "beIN Sports MAX",
  "section.favorites": "Chaînes enregistrées",
  "favorites.empty": "Appuyez sur l'étoile d'une chaîne pour la retrouver ici.",
  "day.yesterday": "hier",
  "day.today": "aujourd'hui",
  "day.tomorrow": "demain",
  "search.channels": "Chercher une chaîne",
  "player.select_quality": "Qualité",
  "player.quality_tip": "Baissez la qualité si l'image saccade.",
  "player.unavailable": "Cette source est hors ligne pour le moment. Essayez-en une autre.",
  "player.mirror": "Autre source",
  "player.loading": "Connexion",
  "status.title": "État des chaînes",
  "status.subtitle": "Chaque chaîne est vérifiée automatiquement et le résultat est publié ici.",
  "status.up": "En ligne",
  "status.down": "Hors ligne",
  "status.last_check": "Dernière vérification",
  "status.response": "Réponse",
  "status.reason": "Raison",
  "status.refresh": "Vérifier à nouveau",
  "footer.tagline": "Sport et TV en direct, guide pour l'Algérie.",
  "footer.disclaimer": "AuraTV n'héberge aucune vidéo. Les flux proviennent de sources tierces et sont retirés sur demande.",
  "install.title": "Ajoutez AuraTV à votre écran d'accueil",
  "install.body": "Les matchs du jour en un geste, sans passer par un store.",
  "install.cta": "Ajouter à l'écran d'accueil",
  "install.dismiss": "Plus tard",
  "settings.title": "Mes chaînes",
  "settings.subtitle": "Ajoutez vos propres liens. Ils restent sur cet appareil et ne sont jamais envoyés.",
  "settings.name": "Nom de la chaîne",
  "settings.category": "Catégorie",
  "settings.logo": "URL du logo (facultatif)",
  "settings.quality": "Qualité",
  "settings.stream_url": "URL du flux (.m3u8)",
  "settings.add_source": "Ajouter une qualité",
  "settings.save": "Enregistrer",
  "settings.remove": "Supprimer",
  "settings.empty": "Vous n'avez encore ajouté aucune chaîne.",
};

const AR: Dict = {
  "nav.matches": "المباريات",
  "nav.channels": "القنوات",
  "nav.favorites": "المحفوظة",
  "nav.home": "الرئيسية",
  "nav.status": "الحالة",
  "nav.settings": "قنواتي",
  "nav.watch_live": "شاهد مباشرة",
  "hero.tagline": "مباريات اليوم، القناة الناقلة، ومشغّل يعمل فعلاً. مجاناً وبدون حساب.",
  "hero.today": "مباريات اليوم",
  "hero.browse": "تصفح القنوات",
  "hero.badge": "مباشر",
  "ticker.live": "مباشر",
  "ticker.today_matches": "مباراة اليوم",
  "ticker.next": "المباراة القادمة",
  "section.schedule": "جدول المباريات",
  "section.channels": "دليل القنوات",
  "section.fixtures": "المباريات",
  "section.live_tv": "بث مباشر",
  "section.bein_primary": "beIN Sports MAX",
  "section.favorites": "القنوات المحفوظة",
  "favorites.empty": "اضغط على النجمة بجانب أي قناة لتظهر هنا.",
  "day.yesterday": "أمس",
  "day.today": "اليوم",
  "day.tomorrow": "غداً",
  "search.channels": "ابحث عن قناة",
  "player.select_quality": "الجودة",
  "player.quality_tip": "اخفض الجودة إذا كان البث يتقطع.",
  "player.unavailable": "هذا المصدر متوقف حالياً. جرّب مصدراً آخر.",
  "player.mirror": "مصدر آخر",
  "player.loading": "جارٍ الاتصال",
  "status.title": "حالة القنوات",
  "status.subtitle": "نفحص كل قناة تلقائياً وننشر النتيجة هنا.",
  "status.up": "يعمل",
  "status.down": "متوقف",
  "status.last_check": "آخر فحص",
  "status.response": "الاستجابة",
  "status.reason": "السبب",
  "status.refresh": "أعد الفحص",
  "footer.tagline": "دليل المباريات والقنوات المباشرة للجزائر.",
  "footer.disclaimer": "AuraTV لا يستضيف أي فيديو. البث من مصادر خارجية ويُحذف عند الطلب.",
  "install.title": "أضف AuraTV إلى شاشتك الرئيسية",
  "install.body": "مباريات اليوم بضغطة واحدة، بدون متجر تطبيقات.",
  "install.cta": "أضف إلى الشاشة الرئيسية",
  "install.dismiss": "لاحقاً",
  "settings.title": "قنواتي",
  "settings.subtitle": "أضف روابط البث الخاصة بك. تبقى على جهازك ولا تُرسل إلى أي مكان.",
  "settings.name": "اسم القناة",
  "settings.category": "الفئة",
  "settings.logo": "رابط الشعار (اختياري)",
  "settings.quality": "الجودة",
  "settings.stream_url": "رابط البث (.m3u8)",
  "settings.add_source": "أضف جودة أخرى",
  "settings.save": "حفظ القناة",
  "settings.remove": "حذف",
  "settings.empty": "لم تضف أي قناة بعد.",
};

const DICTS: Record<Lang, Dict> = { en: EN, fr: FR, ar: AR };
const STORAGE_KEY = "auratv:lang";

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "fr" || v === "ar";
}

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: string) => string;
  dir: "ltr" | "rtl";
}

const FALLBACK: Ctx = {
  lang: "en",
  setLang: () => {},
  dir: "ltr",
  t: (k) => EN[k] ?? k,
};

const I18nCtx = createContext<Ctx>(FALLBACK);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isLang(saved)) setLangState(saved);
    } catch {
      // storage blocked; keep default
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<Ctx>(() => {
    const dict = DICTS[lang];
    return {
      lang,
      setLang,
      dir: lang === "ar" ? "rtl" : "ltr",
      t: (k) => dict[k] ?? EN[k] ?? k,
    };
  }, [lang, setLang]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): Ctx {
  return useContext(I18nCtx);
}
