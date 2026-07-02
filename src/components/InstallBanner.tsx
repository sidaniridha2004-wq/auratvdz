import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const KEY = "auratv:install-dismissed";

// Very small install-hint banner. Uses beforeinstallprompt when available;
// otherwise shows a generic "add to home screen" hint on mobile.
export function InstallBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<(Event & { prompt?: () => void }) | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {}
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as Event & { prompt?: () => void });
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    // Fallback: show for mobile after 5s even without the event
    const t = setTimeout(() => {
      if (isMobile) setVisible(true);
    }, 5000);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler as EventListener);
      clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  };

  if (!visible) return null;
  return (
    <div className="fixed bottom-20 left-1/2 z-40 w-[92%] max-w-md -translate-x-1/2 rounded-2xl border border-white/10 bg-card/95 p-3 shadow-glow backdrop-blur sm:bottom-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{t("install.title")}</div>
          <div className="truncate text-xs text-muted-foreground">{t("install.body")}</div>
        </div>
        <button
          onClick={() => {
            deferred?.prompt?.();
            dismiss();
          }}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          Install
        </button>
        <button
          aria-label={t("install.dismiss")}
          onClick={dismiss}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
