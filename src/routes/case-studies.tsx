import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, SideNote } from "@/components/PageShell";
import { CASE_STUDIES } from "@/content/faq";
import { pageHead } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/site";

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Case studies", path: "/case-studies" },
];

export const Route = createFileRoute("/case-studies")({
  head: () =>
    pageHead({
      title: "Case studies",
      description: "Three problems we had running a live TV guide and what we changed: kick-off loading time, channel coverage, and closing an open stream proxy.",
      path: "/case-studies",
      jsonLd: breadcrumbJsonLd(CRUMBS),
    }),
  component: CaseStudiesPage,
});

function CaseStudiesPage() {
  return (
    <PageShell
      crumbs={CRUMBS}
      kicker="Engineering notes"
      title="What broke, and what we changed"
      lede="Short write-ups of real problems on the site. Numbers are from our own logs."
      aside={
        <>
          <SideNote title="Contents">
            {CASE_STUDIES.map((c) => (
              <a key={c.slug} href={`#${c.slug}`} className="block underline">
                {c.title}
              </a>
            ))}
          </SideNote>
          <SideNote title="Have a suggestion?">
            <Link to="/contact" className="underline">
              Tell us what to fix next
            </Link>
            .
          </SideNote>
        </>
      }
    >
      <div className="space-y-12">
        {CASE_STUDIES.map((c) => (
          <article key={c.slug} id={c.slug} className="grid gap-6 sm:grid-cols-[1fr_180px]">
            <div>
              <div className="kicker text-primary">{c.kicker}</div>
              <h2 className="mt-1 text-[1.5rem]">{c.title}</h2>
              <dl className="mt-4 space-y-4 text-[15px] leading-relaxed">
                <div>
                  <dt className="kicker">Problem</dt>
                  <dd className="mt-1 text-muted-foreground">{c.problem}</dd>
                </div>
                <div>
                  <dt className="kicker">What we changed</dt>
                  <dd className="mt-1 text-muted-foreground">{c.fix}</dd>
                </div>
                <div>
                  <dt className="kicker">Result</dt>
                  <dd className="mt-1">{c.result}</dd>
                </div>
              </dl>
            </div>
            <aside className="tile self-start p-4 text-center">
              <div className="font-display text-[2.5rem] leading-none text-primary">{c.metric}</div>
              <div className="kicker mt-2">{c.metricLabel}</div>
            </aside>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
