// One-time invitation to the Telegram channel. Appears after a short delay,
// never on player pages, and stays dismissed once closed.
import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Send, X } from "lucide-react";
import { SITE } from "@/lib/site";

const KEY = "auratv:telegram-popup-dismissed";

export function TelegramPopup() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    const timer = window.setTimeout(() => setOpen(true), 25_000);
    return () => window.clearTimeout(timer);
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  if (!open || pathname.startsWith("/watch")) return null;

  return (
    <div role="dialog" aria-labelledby="tg-title" className="fixed bottom-[4.25rem] left-3 right-3 z-40 sm:bottom-4 sm:left-4 sm:right-auto sm:w-[340px]">
      <div className="tile p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="kicker text-primary">Telegram</div>
            <h2 id="tg-title" className="mt-1 font-sans text-[15px] font-semibold">
              Kick-off reminders and outage notices
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              We post when a big match starts and when a channel goes down. No spam, leave any time.
            </p>
          </div>
          <button type="button" onClick={close} aria-label="Close" className="btn btn-ghost btn-sm px-2">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <a href={SITE.telegram} target="_blank" rel="noopener noreferrer" onClick={close} className="btn btn-primary btn-sm">
            <Send className="h-3.5 w-3.5" aria-hidden /> Join the channel
          </a>
          <button type="button" onClick={close} className="btn btn-ghost btn-sm">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
