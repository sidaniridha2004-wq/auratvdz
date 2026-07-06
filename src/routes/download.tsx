import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Smartphone, Shield, Zap, Star, ChevronDown, Tv, Globe, CheckCircle } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/download")({
  component: DownloadPage,
});

// APK download link
const APK_GITHUB_URL = "https://github.com/sidaniridha2004-wq/streambox-tv/raw/refs/heads/main/AuraTVs.apk";

const features = [
  {
    icon: Tv,
    title: "TV & Mobile",
    description: "Optimized for Android TV, phones, and tablets. Full landscape & immersive mode support.",
  },
  {
    icon: Zap,
    title: "Instant Streams",
    description: "Lightning-fast channel loading with adaptive quality that starts in seconds.",
  },
  {
    icon: Shield,
    title: "Always Updated",
    description: "The app connects directly to the live website — no manual updates needed ever.",
  },
  {
    icon: Globe,
    title: "100+ Channels",
    description: "Live sports, news, entertainment and more — all in one place.",
  },
];

const steps = [
  {
    number: "01",
    title: "Download the APK",
    description: "Tap the download button above to get the latest AuraTV APK from GitHub.",
  },
  {
    number: "02",
    title: "Allow Unknown Sources",
    description: 'Go to Settings → Security → enable "Install unknown apps" for your browser or file manager.',
  },
  {
    number: "03",
    title: "Install & Open",
    description: "Open the downloaded file, tap Install, then launch AuraTV and enjoy!",
  },
];

const faqs = [
  {
    q: "Is the app free?",
    a: "Yes, AuraTV is completely free to download and use. No subscriptions, no hidden fees.",
  },
  {
    q: "Why do I need to allow unknown sources?",
    a: "Because the app is not distributed through the Google Play Store, Android requires you to manually allow installation from outside the store. This is safe — the APK is hosted directly on our official GitHub page.",
  },
  {
    q: "Will I get updates automatically?",
    a: "The app connects directly to auratvdz.lovable.app, so content and streams are always up to date without reinstalling. For app-level updates, just download the latest APK from GitHub.",
  },
  {
    q: "Does it work on Android TV?",
    a: "Yes! AuraTV is fully optimized for Android TV with D-pad navigation, immersive fullscreen mode, and landscape layout.",
  },
  {
    q: "What Android version do I need?",
    a: "Android 6.0 (Marshmallow) or higher is required. Most phones and TVs from 2016 onwards are supported.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-2xl border border-white/8 bg-white/4 overflow-hidden cursor-pointer select-none"
      onClick={() => setOpen((v) => !v)}
    >
      <div className="flex items-center justify-between px-6 py-4 gap-4">
        <span className="font-medium text-white/90">{q}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/50 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </div>
      {open && <div className="px-6 pb-5 text-sm text-white/60 leading-relaxed border-t border-white/8 pt-4">{a}</div>}
    </div>
  );
}

export default function DownloadPage() {
  const [clicked, setClicked] = useState(false);

  const handleDownload = () => {
    setClicked(true);
    setTimeout(() => setClicked(false), 3000);
    window.open(APK_GITHUB_URL, "_blank");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-4 pt-20 pb-24 text-center">
        {/* background glow blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute left-1/4 top-40 h-64 w-64 rounded-full bg-purple-500/8 blur-[80px]" />
          <div className="absolute right-1/4 top-20 h-48 w-48 rounded-full bg-pink-500/8 blur-[80px]" />
        </div>

        {/* badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
          <Smartphone className="h-3.5 w-3.5" /> Android App · Free
        </div>

        <h1 className="mx-auto max-w-2xl text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
          Watch Live TV
          <br />
          <span className="bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Anywhere, Anytime
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-base text-white/60 sm:text-lg">
          Download the AuraTV Android app for the best live streaming experience — built for TV, phone, and tablet.
        </p>

        {/* CTA buttons */}
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button
            onClick={handleDownload}
            className="group relative inline-flex items-center gap-3 rounded-2xl bg-primary px-8 py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-300 hover:scale-105 hover:shadow-primary/50 hover:shadow-xl active:scale-95"
          >
            {clicked ? (
              <>
                <CheckCircle className="h-5 w-5 animate-bounce" />
                Downloading…
              </>
            ) : (
              <>
                <Download className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
                Download APK
              </>
            )}
            <span className="absolute -top-2 -right-2 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
              FREE
            </span>
          </button>
        </div>

        <p className="mt-4 text-xs text-white/35">Android 6.0+ required · APK ~15 MB · Always free</p>

        {/* phone mockup */}
        <div className="relative mx-auto mt-16 max-w-[240px]">
          <div className="rounded-[2.5rem] border-4 border-white/10 bg-black shadow-2xl shadow-black/60 overflow-hidden aspect-[9/19]">
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-gray-900 via-black to-gray-950 p-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 ring-2 ring-primary/40">
                <Tv className="h-8 w-8 text-primary" />
              </div>
              <span className="text-lg font-bold text-white">AuraTV</span>
              <span className="text-xs text-white/40">Live · HD</span>
              <div className="mt-3 w-full space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-7 rounded-xl bg-white/5 animate-pulse"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="absolute -bottom-6 left-1/2 h-12 w-40 -translate-x-1/2 rounded-full bg-primary/20 blur-2xl" />
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="mb-2 text-center text-2xl font-bold text-white">Why AuraTV?</h2>
        <p className="mb-10 text-center text-sm text-white/50">Everything you need in one clean app</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group rounded-2xl border border-white/8 bg-white/4 p-6 transition hover:border-primary/30 hover:bg-primary/5"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary transition group-hover:scale-110">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1 font-semibold text-white">{title}</h3>
              <p className="text-sm text-white/55 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Install guide ── */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="mb-2 text-center text-2xl font-bold text-white">How to Install</h2>
        <p className="mb-10 text-center text-sm text-white/50">Ready in under a minute</p>
        <div className="space-y-4">
          {steps.map(({ number, title, description }) => (
            <div key={number} className="flex gap-5 rounded-2xl border border-white/8 bg-white/4 px-6 py-5">
              <span className="mt-0.5 shrink-0 text-3xl font-black text-primary/30 leading-none">{number}</span>
              <div>
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="mt-1 text-sm text-white/55 leading-relaxed">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Ratings strip ── */}
      <section className="mx-auto max-w-3xl px-4 py-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 px-6 py-6 text-center sm:flex-row sm:text-left">
          <div className="flex shrink-0 gap-0.5 text-yellow-400">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="h-5 w-5 fill-current" />
            ))}
          </div>
          <div>
            <p className="font-semibold text-white">Loved by thousands of viewers</p>
            <p className="text-sm text-white/50">Completely free · No account required · No ads in-app</p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="mb-2 text-center text-2xl font-bold text-white">Frequently Asked Questions</h2>
        <p className="mb-8 text-center text-sm text-white/50">Everything you need to know</p>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="px-4 pb-24 text-center">
        <div className="mx-auto max-w-xl rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-purple-500/5 to-transparent p-10">
          <Download className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h2 className="text-2xl font-bold text-white">Ready to watch?</h2>
          <p className="mt-2 text-sm text-white/55">Download once. Stream forever. It's free.</p>
          <button
            onClick={handleDownload}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-105 hover:shadow-primary/50 active:scale-95"
          >
            <Download className="h-4 w-4" /> Download APK Free
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
