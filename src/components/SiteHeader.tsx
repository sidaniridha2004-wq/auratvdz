import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/auratv-logo.png.asset.json";
import { Flame, Radio } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="group flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            <div className="absolute inset-0 -z-10 rounded-2xl bg-primary/40 blur-xl transition group-hover:bg-primary/60" />
            <img
              src={logoAsset.url}
              alt="AuraTV"
              className="h-11 w-11 rounded-2xl object-cover shadow-glow transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3"
            />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate font-display text-xl font-bold tracking-tight">
              <span className="text-aurora">AuraTV</span>
            </div>
            <div className="truncate text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Live · HD · Free
            </div>
          </div>
        </Link>
        <nav className="flex shrink-0 items-center gap-1 text-sm">
          <a
            href="/#matches"
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-muted-foreground transition hover:bg-white/10 hover:text-foreground sm:inline-flex"
          >
            <Flame className="h-4 w-4" /> Matches
          </a>
          <a
            href="/#channels"
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-muted-foreground transition hover:bg-white/10 hover:text-foreground sm:inline-flex"
          >
            <Radio className="h-4 w-4" /> Channels
          </a>
          <a
            href="/#matches"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground shadow-glow transition hover:scale-105"
          >
            Watch live
          </a>
        </nav>
      </div>
    </header>
  );
}

