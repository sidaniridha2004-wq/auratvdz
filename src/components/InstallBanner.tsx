// Small "install the app" bar. Shows the native install prompt when the
// browser offers one; otherwise links to the download page. Dismissal is
// remembered on the device.
import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Mark } from "@/components/Wordmark";
import { useI18n } from "@/lib/i18n";

const KEY = "auratv:install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function InstallBanner() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      // storage unavailable: show once per session instead
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // Browsers without the prompt (iOS Safari, Firefox): show a link instead
    // after the visitor has had a moment on the page.
    const timer = window.setTimeout(() => setVisible(true), 12_000);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    dismiss();
  };

  if (!visible || pathname.startsWith("/watch") || pathname === "/download") return null;

  return (
    <div role="dialog" aria-label={t("install.title")} className="fixed inset-x-3 bottom-[4.25rem] z-40 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[360px]">
      <div className="tile flex items-center gap-3 p-3">
        <Mark size={36} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">{t("install.title")}</div>
          <div className="truncate text-[12px] text-muted-foreground">{t("install.body")}</div>
        </div>
        {deferred ? (
          <button type="button" onClick={install} className="btn btn-primary btn-sm">
            {t("install.cta")}
          </button>
        ) : (
          <Link to="/download" onClick={dismiss} className="btn btn-primary btn-sm">
            Get app
          </Link>
        )}
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="btn btn-ghost btn-sm px-2">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
