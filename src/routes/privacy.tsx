import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, SideNote } from "@/components/PageShell";
import { pageHead } from "@/lib/seo";
import { SITE, breadcrumbJsonLd } from "@/lib/site";

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Privacy policy", path: "/privacy" },
];

const UPDATED = "9 September 2026";

export const Route = createFileRoute("/privacy")({
  head: () =>
    pageHead({
      title: "Privacy policy",
      description: "What AuraTV stores (very little), what stays on your device, which third parties are involved, and how to contact us about your data.",
      path: "/privacy",
      jsonLd: breadcrumbJsonLd(CRUMBS),
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PageShell
      crumbs={CRUMBS}
      kicker="Legal"
      title="Privacy policy"
      lede={`Last updated ${UPDATED}. The short version: there are no accounts, your preferences stay on your device, and we keep server logs for a week.`}
      aside={
        <>
          <SideNote title="Also see">
            <Link to="/terms" className="underline">
              Terms of use
            </Link>
            <br />
            <Link to="/dmca" className="underline">
              DMCA and takedowns
            </Link>
          </SideNote>
          <SideNote title="Questions">
            <a href={`mailto:${SITE.contactEmail}`} className="underline">
              {SITE.contactEmail}
            </a>
          </SideNote>
        </>
      }
    >
      <div className="prose-basic">
        <h2>Who we are</h2>
        <p>
          {SITE.legalName}, {SITE.address.city}, Algeria, operates {SITE.url.replace("https://", "")} and the AuraTV Android app. Contact:{" "}
          {SITE.contactEmail}.
        </p>

        <h2>What we collect</h2>
        <p>
          <strong>Nothing you type.</strong> There is no sign-up. The contact form opens your own mail app; we only receive what you choose to
          send.
        </p>
        <p>
          <strong>Server logs.</strong> When you load a page or play a stream through our relay, our hosting provider records the IP address,
          the URL requested, the time and the browser identifier. We use these to spot abuse and broken channels. Logs are deleted after 7 days.
        </p>
        <p>
          <strong>Analytics.</strong> We use Google Analytics 4 with IP anonymisation and without advertising features to count visits and see
          which pages are used. You can block it with any content blocker and the site works exactly the same.
        </p>

        <h2>What stays on your device</h2>
        <p>
          Language, dark or light theme, favourite channels, channels you add yourself, and whether you closed the install or Telegram
          notices are kept in your browser's local storage. They are never sent to us. Clearing site data removes them.
        </p>

        <h2>Third parties</h2>
        <ul>
          <li>Supabase (database hosting) stores the channel list and editor picks. It receives your IP address when the page loads them.</li>
          <li>Stream providers deliver the video itself. Our relay forwards the request; the provider sees our server, not your address.</li>
          <li>Google (Analytics), OpenStreetMap (the map on the contact page) and Fontshare (web fonts) load from their own servers.</li>
          <li>Advertising slots, where present, are served by the network named in the slot and are subject to that network's policy.</li>
        </ul>

        <h2>Cookies</h2>
        <p>We set no cookies ourselves. Google Analytics sets its own first-party cookies; blocking them has no effect on the site.</p>

        <h2>Children</h2>
        <p>The service is not directed at children under 13 and we knowingly collect no information from them.</p>

        <h2>Your rights</h2>
        <p>
          Because we hold almost nothing about you, requests are simple: write to {SITE.contactEmail} and we will confirm what, if anything,
          exists in our logs for the address you give us and delete it on request.
        </p>

        <h2>Changes</h2>
        <p>We will update the date at the top of this page when the policy changes and mention material changes on our Telegram channel.</p>
      </div>
    </PageShell>
  );
}
