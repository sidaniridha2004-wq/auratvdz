import { useEffect, useState } from "react";
import { X, Send } from "lucide-react";

const DISMISS_KEY = "auratv:telegram-popup-dismissed";
const DISMISS_DAYS = 7;

export function TelegramPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const at = parseInt(raw, 10);
        if (Date.now() - at < DISMISS_DAYS * 86_400_000) return;
      }
    } catch {
      // localStorage blocked — show anyway
    }
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-up"
      onClick={close}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-card p-6 shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#229ED9]/20 text-[#229ED9]">
            <Send className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
              Join the community
            </div>
            <h2 className="font-display text-xl font-bold">AuraTV on Telegram</h2>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          Get instant notifications for new streams, match reminders, quality fixes, and channel
          updates. Join our Telegram channel — it's free.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href="https://t.me/Aura_TV"
            target="_blank"
            rel="noreferrer"
            onClick={close}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#229ED9] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            <Send className="h-4 w-4" /> Open Telegram
          </a>
          <button
            onClick={close}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
