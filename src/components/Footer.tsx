import { Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/Wordmark";
import { SITE } from "@/lib/site";
import { useI18n } from "@/lib/i18n";

const COLS: Array<{ title: string; links: Array<{ to: string; hash?: string; label: string }> }> = [
  {
    title: "Watch",
    links: [
      { to: "/", hash: "matches", label: "Today's fixtures" },
      { to: "/", hash: "channels", label: "All channels" },
      { to: "/live", label: "Live events" },
      { to: "/status", label: "Channel status" },
      { to: "/settings/channels", label: "My channels" },
      { to: "/download", label: "Android app" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/about", label: "About & team" },
      { to: "/case-studies", label: "Case studies" },
      { to: "/faq", label: "FAQ" },
      { to: "/contact", label: "Contact & directions" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/privacy", label: "Privacy policy" },
      { to: "/terms", label: "Terms of use" },
      { to: "/dmca", label: "Copyright / DMCA" },
    ],
  },
];

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-16 rule-heavy">
      <div className="wrap grid gap-10 py-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-muted-foreground">{t("footer.tagline")}</p>
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{t("footer.disclaimer")}</p>
          <p className="mt-4 text-[13px]">
            <span className="kicker text-live">Response time</span>
            <br />
            <span className="text-muted-foreground">{SITE.responseTime}</span>
          </p>
          <a
            href={SITE.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-[14px] underline hover:text-primary"
          >
            Telegram: @Aura_TV
          </a>
        </div>

        {COLS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <div className="kicker mb-3">{col.title}</div>
            <ul className="space-y-2 text-[14px]">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} hash={l.hash} className="text-muted-foreground hover:text-foreground hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="rule">
        <div className="wrap flex flex-wrap items-center justify-between gap-2 py-4 text-[12px] text-muted-foreground">
          <span>© {new Date().getFullYear()} {SITE.legalName}. Algiers, Algeria.</span>
          <span>
            We do not host video. Rights holder?{" "}
            <Link to="/dmca" className="underline hover:text-foreground">
              Send a notice
            </Link>
            .
          </span>
        </div>
      </div>
    </footer>
  );
}
