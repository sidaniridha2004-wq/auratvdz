import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, SideNote } from "@/components/PageShell";
import { TEAM } from "@/content/faq";
import { pageHead } from "@/lib/seo";
import { SITE, absoluteUrl, breadcrumbJsonLd } from "@/lib/site";

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "About", path: "/about" },
];

const peopleJsonLd = TEAM.map((m) => ({
  "@context": "https://schema.org",
  "@type": "Person",
  name: m.name,
  jobTitle: m.role,
  image: absoluteUrl(m.photo),
  worksFor: { "@id": `${SITE.url}/#org` },
}));

export const Route = createFileRoute("/about")({
  head: () =>
    pageHead({
      title: "About AuraTV",
      description: "Who runs AuraTV, why it exists, and how we keep the programme guide accurate. A two-person project from Algiers.",
      path: "/about",
      jsonLd: [breadcrumbJsonLd(CRUMBS), ...peopleJsonLd],
    }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <PageShell
      crumbs={CRUMBS}
      kicker="About"
      title="A TV guide that actually plays"
      lede={`AuraTV started in ${SITE.founded} because finding which channel had the match, and then finding a stream that worked, took longer than the warm-up. We put the schedule and the player on the same page.`}
      aside={
        <>
          <SideNote title="Response time">{SITE.responseTime}</SideNote>
          <SideNote title="Get in touch">
            <Link to="/contact" className="underline">
              Contact page
            </Link>
            ,{" "}
            <a href={SITE.telegram} target="_blank" rel="noopener noreferrer" className="underline">
              Telegram
            </a>{" "}
            or{" "}
            <a href={`mailto:${SITE.contactEmail}`} className="underline">
              {SITE.contactEmail}
            </a>
            .
          </SideNote>
        </>
      }
    >
      <div className="prose-basic">
        <h2>What we do</h2>
        <p>
          Every match day we publish the fixtures, the channel carrying each one and the commentator, then link straight to the player. The
          channel guide covers beIN Sports, Algerian, French and Arabic channels, sorted by category so you are never more than two taps from
          the picture.
        </p>
        <h2>What we do not do</h2>
        <p>
          We do not host video and we do not sell subscriptions. AuraTV is a guide and a player. If a rights holder asks us to remove a link we
          do it the same day; the process is on the{" "}
          <Link to="/dmca">DMCA page</Link>.
        </p>
        <h2>How we keep it accurate</h2>
        <p>
          The channel directory is refreshed from its source several times an hour and every stream is tested automatically. Results are
          public on the <Link to="/status">status page</Link>. Kick-off times and channel assignments are checked by hand each morning.
        </p>
      </div>

      <h2 className="rule-heavy mb-5 mt-12 pt-3 text-[1.4rem]">The team</h2>
      <ul className="grid gap-6 sm:grid-cols-2">
        {TEAM.map((m) => (
          <li key={m.name} className="flex gap-4">
            <img src={m.photo} alt={`${m.name}, ${m.role}`} width={96} height={96} loading="lazy" decoding="async" className="h-24 w-24 shrink-0 rounded-md object-cover" />
            <div>
              <h3 className="font-sans text-[16px] font-semibold">{m.name}</h3>
              <div className="kicker mt-0.5 text-primary">{m.role}</div>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{m.bio}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="tile mt-12 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="kicker">Read more</div>
          <div className="mt-1 text-[15px]">How we fixed slow kick-off loading and closed an open proxy.</div>
        </div>
        <Link to="/case-studies" className="btn btn-outline btn-sm">
          Case studies
        </Link>
      </div>
    </PageShell>
  );
}
