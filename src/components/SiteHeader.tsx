import { Link } from "@tanstack/react-router";
import { Tv } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="group flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-glow transition-transform group-hover:scale-105">
            <Tv className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold tracking-tight">YacineTV</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Live · HD · Free
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/"
            className="rounded-md px-3 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
            activeProps={{ className: "rounded-md px-3 py-2 bg-secondary text-foreground" }}
            activeOptions={{ exact: true }}
          >
            Home
          </Link>
          <a
            href="https://github.com/aimadnet/yacinetv-api"
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-3 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            API
          </a>
        </nav>
      </div>
    </header>
  );
}
