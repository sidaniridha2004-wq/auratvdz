import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, SideNote } from "@/components/PageShell";
import { pageHead } from "@/lib/seo";
import { SITE, breadcrumbJsonLd } from "@/lib/site";

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Terms of use", path: "/terms" },
];

export const Route = createFileRoute("/terms")({
  head: () =>
    pageHead({
      title: "Terms of use",
      description: "The rules for using AuraTV: what the service is, what we do not guarantee, acceptable use, and how to reach us.",
      path: "/terms",
      jsonLd: breadcrumbJsonLd(CRUMBS),
    }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <PageShell
      crumbs={CRUMBS}
      kicker="Legal"
      title="Terms of use"
      lede="Last updated 9 September 2026. Using the site or the app means you accept these terms."
      aside={
        <>
          <SideNote title="Also see">
            <Link to="/privacy" className="underline">
              Privacy policy
            </Link>
            <br />
            <Link to="/dmca" className="underline">
              DMCA and takedowns
            </Link>
          </SideNote>
        </>
      }
    >
      <div className="prose-basic">
        <h2>The service</h2>
        <p>
          AuraTV is a programme guide and a media player. It lists television channels and sports fixtures and plays streams that are made
          available by third parties. AuraTV does not record, store or originate any video.
        </p>

        <h2>No guarantee</h2>
        <p>
          Streams come and go and we cannot promise any channel will be available at any time. The service is provided as is. To the extent
          allowed by law we are not liable for missed matches, data charges or anything that follows from using the site.
        </p>

        <h2>Acceptable use</h2>
        <ul>
          <li>Do not attempt to overload, probe or scrape the site or the stream relay.</li>
          <li>Do not use the relay for anything other than playing channels listed on this site.</li>
          <li>Do not redistribute streams obtained through AuraTV.</li>
          <li>Channels you add under My channels are your responsibility; only add streams you have the right to watch.</li>
        </ul>
        <p>We may block addresses that break these rules without notice.</p>

        <h2>Rights holders</h2>
        <p>
          If you own the rights to content reachable through a link on this site, the <Link to="/dmca">DMCA page</Link> explains how to have
          it removed. We act on valid notices within one working day.
        </p>

        <h2>Advertising</h2>
        <p>The site is supported by advertising. Advertisers do not influence which channels or matches are listed.</p>

        <h2>Changes and contact</h2>
        <p>
          We may change these terms; the date at the top will be updated. Questions go to{" "}
          <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
        </p>
      </div>
    </PageShell>
  );
}
