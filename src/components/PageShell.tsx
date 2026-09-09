import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";

export interface Crumb {
  name: string;
  path: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="kicker flex flex-wrap items-center gap-1 text-muted-foreground">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={c.path} className="inline-flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
            {last ? (
              <span aria-current="page" className="text-foreground">
                {c.name}
              </span>
            ) : (
              <Link to={c.path} className="hover:text-foreground hover:underline">
                {c.name}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

interface ShellProps {
  crumbs?: Crumb[];
  kicker?: string;
  title: string;
  lede?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  narrow?: boolean;
}

/** Standard secondary-page layout: header, breadcrumbs, headline block, body, footer. */
export function PageShell({ crumbs, kicker, title, lede, aside, children, narrow }: ShellProps) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className={`wrap py-8 sm:py-12 ${narrow ? "max-w-[820px]" : ""}`}>
        {crumbs && crumbs.length > 0 && (
          <div className="mb-6">
            <Breadcrumbs items={crumbs} />
          </div>
        )}
        <header className="rule-heavy pt-4">
          {kicker && <div className="kicker text-primary">{kicker}</div>}
          <h1 className="mt-2 text-[2rem] sm:text-[2.75rem]">{title}</h1>
          {lede && <div className="mt-3 max-w-2xl text-[16px] leading-relaxed text-muted-foreground">{lede}</div>}
        </header>
        <div className={`mt-8 ${aside ? "grid gap-10 lg:grid-cols-[1fr_300px]" : ""}`}>
          <div className="min-w-0">{children}</div>
          {aside && <aside className="space-y-6">{aside}</aside>}
        </div>
      </main>
      <Footer />
    </div>
  );
}

/** Small boxed side note used in asides. */
export function SideNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="tile p-4">
      <div className="kicker mb-2">{title}</div>
      <div className="text-[14px] leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}
