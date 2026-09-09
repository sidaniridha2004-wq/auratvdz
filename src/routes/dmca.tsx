import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, SideNote } from "@/components/PageShell";
import { pageHead } from "@/lib/seo";
import { SITE, breadcrumbJsonLd } from "@/lib/site";

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "DMCA", path: "/dmca" },
];

export const Route = createFileRoute("/dmca")({
  head: () =>
    pageHead({
      title: "DMCA and takedown requests",
      description: "How rights holders can have a link removed from AuraTV. What to include in a notice and how quickly we act.",
      path: "/dmca",
      jsonLd: breadcrumbJsonLd(CRUMBS),
    }),
  component: DmcaPage,
});

function DmcaPage() {
  return (
    <PageShell
      crumbs={CRUMBS}
      kicker="Legal"
      title="Takedown requests"
      lede="AuraTV hosts no video. If a link on this site points to material you own the rights to, tell us and we will remove it within one working day."
      aside={
        <>
          <SideNote title="Send notices to">
            <a href={`mailto:${SITE.dmcaEmail}`} className="underline">
              {SITE.dmcaEmail}
            </a>
          </SideNote>
          <SideNote title="Also see">
            <Link to="/terms" className="underline">
              Terms of use
            </Link>
            <br />
            <Link to="/privacy" className="underline">
              Privacy policy
            </Link>
          </SideNote>
        </>
      }
    >
      <div className="prose-basic">
        <h2>What to include</h2>
        <ol>
          <li>The exact page address on AuraTV where the link appears (for example a /watch/… URL).</li>
          <li>A description of the work you say is infringed and evidence that you hold the rights or act for the holder.</li>
          <li>Your name, organisation, postal address and an email address we can reply to.</li>
          <li>A statement that you believe in good faith the use is not authorised, and that the notice is accurate.</li>
          <li>A physical or electronic signature.</li>
        </ol>

        <h2>What happens next</h2>
        <p>
          We confirm receipt, disable the link and reply to you, normally the same day and always within one working day. Because streams are
          relayed from third parties, we also stop relaying the source in question so it cannot reappear under another name.
        </p>

        <h2>Counter-notices</h2>
        <p>If you believe a link was removed by mistake, write to the same address with the page URL and your reasoning; we will review it.</p>

        <h2>Repeat sources</h2>
        <p>Third-party sources that attract repeated valid notices are removed from the directory permanently.</p>
      </div>
    </PageShell>
  );
}
