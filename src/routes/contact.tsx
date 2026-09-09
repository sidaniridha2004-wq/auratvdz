import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Mail, MapPin, Send } from "lucide-react";
import { PageShell, SideNote } from "@/components/PageShell";
import { pageHead } from "@/lib/seo";
import { SITE, breadcrumbJsonLd, localBusinessJsonLd } from "@/lib/site";

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Contact", path: "/contact" },
];

const { lat, lng } = SITE.geo;
const d = 0.02;
const MAP_EMBED = "https://www.openstreetmap.org/export/embed.html?bbox=" + [lng - d, lat - d, lng + d, lat + d].join("%2C") + "&layer=mapnik&marker=" + lat + "%2C" + lng;
const DIRECTIONS = "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lng;
const MAP_LINK = "https://www.openstreetmap.org/?mlat=" + lat + "&mlon=" + lng + "#map=15/" + lat + "/" + lng;

export const Route = createFileRoute("/contact")({
  validateSearch: z.object({ subject: z.string().max(160).optional().catch(undefined) }),
  head: () =>
    pageHead({
      title: "Contact us",
      description: `Report a broken channel, a wrong kick-off time or a takedown request. ${SITE.responseTime} Telegram, email and our Algiers address.`,
      path: "/contact",
      jsonLd: [breadcrumbJsonLd(CRUMBS), localBusinessJsonLd()],
    }),
  component: ContactPage,
});

const TOPICS = ["Channel not working", "Wrong match time or channel", "Android app problem", "Takedown request", "Something else"];

function ContactPage() {
  const { subject } = Route.useSearch();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(subject?.startsWith("Channel") ? TOPICS[0] : TOPICS[4]);
  const [detail, setDetail] = useState(subject ?? "");
  const [from, setFrom] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = detail.trim();
    if (body.length < 5) return setError("Tell us a little more so we can reproduce it.");
    if (from && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) return setError("That email address does not look right.");
    setError(null);
    const text = `${topic}\n\n${body}${from ? `\n\nReply to: ${from}` : ""}`;
    const to = topic === "Takedown request" ? SITE.dmcaEmail : SITE.contactEmail;
    // No server mailbox is involved: the message goes out through the
    // visitor's own mail app, so nothing personal is stored on our side.
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(`[AuraTV] ${topic}`)}&body=${encodeURIComponent(text)}`;
    void navigate({ to: "/thank-you", search: { topic } });
  };

  return (
    <PageShell
      crumbs={CRUMBS}
      kicker="Contact"
      title="Talk to a person"
      lede={SITE.responseTime}
      aside={
        <>
          <SideNote title="Fastest">
            <a href={SITE.telegram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 underline">
              <Send className="h-3.5 w-3.5" aria-hidden /> Telegram: @Aura_TV
            </a>
          </SideNote>
          <SideNote title="Email">
            <a href={`mailto:${SITE.contactEmail}`} className="inline-flex items-center gap-1.5 underline">
              <Mail className="h-3.5 w-3.5" aria-hidden /> {SITE.contactEmail}
            </a>
            <br />
            Rights holders:{" "}
            <a href={`mailto:${SITE.dmcaEmail}`} className="underline">
              {SITE.dmcaEmail}
            </a>
          </SideNote>
          <SideNote title="Address">
            <address className="not-italic">
              {SITE.legalName}
              <br />
              {SITE.address.street && (
                <>
                  {SITE.address.street}
                  <br />
                </>
              )}
              {SITE.address.postal} {SITE.address.city}, Algeria
            </address>
          </SideNote>
        </>
      }
    >
      <form onSubmit={submit} className="tile space-y-5 p-5" noValidate>
        <label className="block">
          <span className="kicker mb-1.5 block">What is it about?</span>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} className="field">
            {TOPICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="kicker mb-1.5 block">Details</span>
          <textarea
            required
            rows={5}
            maxLength={2000}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Channel name, what you saw, your device and browser"
            className="field min-h-[8rem] resize-y"
          />
        </label>
        <label className="block">
          <span className="kicker mb-1.5 block">Your email (optional, for a reply)</span>
          <input type="email" value={from} onChange={(e) => setFrom(e.target.value)} autoComplete="email" className="field" />
        </label>
        {error && (
          <p role="alert" className="text-[13px] text-primary">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary">
            Send message
          </button>
          <span className="text-[12px] text-muted-foreground">Opens in your mail app. Nothing is stored on our servers.</span>
        </div>
      </form>

      <h2 className="rule-heavy mb-4 mt-12 pt-3 text-[1.4rem]">Where we are</h2>
      <div className="tile overflow-hidden p-0">
        <iframe
          title={`Map showing ${SITE.legalName} in ${SITE.address.city}`}
          src={MAP_EMBED}
          width="100%"
          height="320"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block w-full border-0"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-[14px]">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-4 w-4" aria-hidden /> {SITE.address.city}, {SITE.address.region}
          </span>
          <span className="flex gap-2">
            <a href={DIRECTIONS} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
              Get directions
            </a>
            <a href={MAP_LINK} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
              Open in OpenStreetMap
            </a>
          </span>
        </div>
      </div>

      <p className="mt-8 text-[14px] text-muted-foreground">
        Before writing, the{" "}
        <Link to="/faq" className="underline">
          FAQ
        </Link>{" "}
        and{" "}
        <Link to="/status" className="underline">
          status page
        </Link>{" "}
        answer the most common questions.
      </p>
    </PageShell>
  );
}
