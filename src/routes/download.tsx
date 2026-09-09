import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Smartphone, Tv, MonitorPlay } from "lucide-react";
import { PageShell, SideNote } from "@/components/PageShell";
import { pageHead } from "@/lib/seo";
import { SITE, breadcrumbJsonLd } from "@/lib/site";

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Android app", path: "/download" },
];

const appJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AuraTV for Android",
  operatingSystem: "Android 7.0+",
  applicationCategory: "EntertainmentApplication",
  offers: { "@type": "Offer", price: "0", priceCurrency: "DZD" },
  downloadUrl: SITE.apkUrl,
  publisher: { "@id": `${SITE.url}/#org` },
};

export const Route = createFileRoute("/download")({
  head: () =>
    pageHead({
      title: "Download the Android app",
      description: "Get AuraTV for Android phones, tablets and Android TV. Free APK, no account, remote-control navigation and picture-in-picture.",
      path: "/download",
      jsonLd: [breadcrumbJsonLd(CRUMBS), appJsonLd],
    }),
  component: DownloadPage,
});

const FEATURES = [
  { icon: Smartphone, title: "Phones and tablets", body: "Same guide as the website, plus picture-in-picture and background audio." },
  { icon: Tv, title: "Android TV and Fire TV", body: "Full remote-control navigation. Press OK on a channel and it plays; Back returns to the guide." },
  { icon: MonitorPlay, title: "Chromecast", body: "Cast any stream from your phone to the TV from the player menu." },
];

function DownloadPage() {
  return (
    <PageShell
      crumbs={CRUMBS}
      kicker="Android"
      title="AuraTV for Android"
      lede="The app is a free APK. It is not on Google Play, so you install it directly."
      aside={
        <>
          <SideNote title="Is it safe?">
            The APK is built from the same code as this website and signed by us. Android will ask you to allow installs from your browser the
            first time; that prompt is normal for apps outside Google Play.
          </SideNote>
          <SideNote title="iPhone or PC?">
            Use the website. On iPhone, open Safari, tap Share, then “Add to Home Screen”. On a PC any browser works.
          </SideNote>
        </>
      }
    >
      <div className="tile p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="kicker">Latest build</div>
            <div className="mt-1 text-[15px] text-muted-foreground">Android 7.0 or newer · about 12 MB · free</div>
          </div>
          <a href={SITE.apkUrl} className="btn btn-primary" download rel="noopener">
            <Download className="h-4 w-4" aria-hidden /> Download APK
          </a>
        </div>
      </div>

      <h2 className="rule-heavy mb-4 mt-10 pt-3 text-[1.4rem]">Works on</h2>
      <ul className="grid gap-px bg-border sm:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="bg-background p-5">
            <f.icon className="h-5 w-5 text-primary" aria-hidden />
            <h3 className="mt-3 font-sans text-[15px] font-semibold">{f.title}</h3>
            <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{f.body}</p>
          </li>
        ))}
      </ul>

      <h2 className="rule-heavy mb-4 mt-10 pt-3 text-[1.4rem]">Install in three steps</h2>
      <ol className="space-y-4">
        {[
          ["Download", "Tap the button above. If Chrome warns that the file could be harmful, choose “Download anyway”; it does this for every APK."],
          ["Allow the install", "Open the file. When Android asks, allow installs from this source. You can turn that back off afterwards."],
          ["Open AuraTV", "The app opens on the guide. On a TV, use the D-pad; on a phone, tap a channel."],
        ].map(([h, p], i) => (
          <li key={h} className="flex gap-4">
            <span className="mono w-6 shrink-0 pt-0.5 text-primary">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h3 className="font-sans text-[15px] font-semibold">{h}</h3>
              <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{p}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-10 text-[14px] text-muted-foreground">
        Having trouble?{" "}
        <Link to="/faq" className="underline">
          Read the FAQ
        </Link>{" "}
        or{" "}
        <Link to="/contact" className="underline">
          contact us
        </Link>
        . {SITE.responseTime}
      </p>
    </PageShell>
  );
}
