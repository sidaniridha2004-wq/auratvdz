import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, SideNote } from "@/components/PageShell";
import { HOME_FAQ } from "@/content/faq";
import { pageHead } from "@/lib/seo";
import { SITE, breadcrumbJsonLd, faqJsonLd } from "@/lib/site";

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "FAQ", path: "/faq" },
];

export const Route = createFileRoute("/faq")({
  head: () =>
    pageHead({
      title: "Frequently asked questions",
      description: "Answers about AuraTV: cost, channels, playback problems, stream delay, TV and Chromecast support, custom channels and how to report a broken stream.",
      path: "/faq",
      jsonLd: [breadcrumbJsonLd(CRUMBS), faqJsonLd(HOME_FAQ)],
    }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <PageShell
      crumbs={CRUMBS}
      kicker="Help"
      title="Questions we get most"
      lede="If yours is not here, ask on the contact page. We reply within a day."
      aside={
        <>
          <SideNote title="Quick links">
            <Link to="/status" className="underline">
              Channel status
            </Link>
            <br />
            <Link to="/download" className="underline">
              Android app
            </Link>
            <br />
            <Link to="/settings/channels" className="underline">
              My channels
            </Link>
            <br />
            <Link to="/contact" className="underline">
              Contact
            </Link>
          </SideNote>
          <SideNote title="Response time">{SITE.responseTime}</SideNote>
        </>
      }
    >
      <dl className="divide-y divide-border">
        {HOME_FAQ.map((item, i) => (
          <div key={item.q} id={`q${i + 1}`} className="grid gap-2 py-5 sm:grid-cols-[2rem_1fr]">
            <span className="mono text-primary">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <dt className="font-sans text-[17px] font-semibold">{item.q}</dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{item.a}</dd>
            </div>
          </div>
        ))}
      </dl>
    </PageShell>
  );
}
