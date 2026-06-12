import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/auratv-logo.png.asset.json";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="group flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-2xl bg-primary/30 blur-xl transition group-hover:bg-primary/50" />
            <img
              src={logoAsset.url}
              alt="AuraTV"
              className="h-11 w-11 rounded-2xl object-cover shadow-glow transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3"
            />
          </div>
          <div className="leading-tight">
            <div className="font-display text-xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 bg-clip-text text-transparent">
                AuraTV
              </span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Live · HD · Free
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/"
            className="rounded-md px-3 py-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            activeProps={{ className: "rounded-md px-3 py-2 bg-secondary text-foreground" }}
            activeOptions={{ exact: true }}
          >
            Home
          </Link>
        </nav>
      </div>
    </header>
  );
}
