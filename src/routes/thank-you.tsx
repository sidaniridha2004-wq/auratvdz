import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Check } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { pageHead } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/thank-you")({
  validateSearch: z.object({ topic: z.string().max(80).optional().catch(undefined) }),
  head: () =>
    pageHead({
      title: "Thanks, we got it",
      description: "Your message is on its way. Here is what happens next.",
      path: "/thank-you",
      noindex: true,
    }),
  component: ThankYouPage,
});

function ThankYouPage() {
  const { topic } = Route.useSearch();
  return (
    <PageShell
      crumbs={[
        { name: "Home", path: "/" },
        { name: "Contact", path: "/contact" },
        { name: "Thank you", path: "/thank-you" },
      ]}
      kicker="Sent"
      title="Thanks. We read every message."
      lede={SITE.responseTime}
      narrow
    >
      <div className="tile p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-live/15 text-live">
            <Check className="h-4 w-4" aria-hidden />
          </span>
          <div className="text-[15px] leading-relaxed">
            {topic ? (
              <p>
                Your mail app should now be open with a message about <strong>{topic.toLowerCase()}</strong>. If it did not open, write to{" "}
                <a href={`mailto:${SITE.contactEmail}`} className="underline">
                  {SITE.contactEmail}
                </a>{" "}
                directly.
              </p>
            ) : (
              <p>
                If your mail app did not open, write to{" "}
                <a href={`mailto:${SITE.contactEmail}`} className="underline">
                  {SITE.contactEmail}
                </a>
                .
              </p>
            )}
            <p className="mt-3 text-muted-foreground">
              For channel outages, the fix is usually live within the hour; you can follow progress on the{" "}
              <Link to="/status" className="underline">
                status page
              </Link>
              . For anything else, expect a reply from Ridha or Oussama within 24 hours.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link to="/" className="btn btn-primary">
          Back to today's matches
        </Link>
        <a href={SITE.telegram} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
          Follow on Telegram
        </a>
      </div>
    </PageShell>
  );
}
