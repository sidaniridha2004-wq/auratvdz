import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { InstallBanner } from "../components/InstallBanner";
import { TelegramPopup } from "../components/TelegramPopup";
import { MobileTabBar } from "../components/MobileTabBar";
import { SiteHeader } from "../components/SiteHeader";
import { Footer } from "../components/Footer";
import { I18nProvider } from "../lib/i18n";
import { ThemeProvider } from "../lib/theme";
import { FavoritesProvider } from "../lib/favorites";
import { CustomChannelsProvider } from "../lib/custom-channels";
import { AdminProvider } from "../lib/admin";
import { initTvNavigation, isCapacitor } from "../lib/tv-navigation";
import { SITE, siteJsonLd } from "../lib/site";

// Google Analytics 4. Set VITE_GA_MEASUREMENT_ID (e.g. G-XXXXXXXXXX) in the
// environment; when it is absent nothing is injected.
const GA_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim() ?? "";
const GA_SRC_BASE = "https://www.googletagmanager.com/gtag/js?id=";
const GA_OK = /^G-[A-Z0-9]{4,16}$/.test(GA_ID);

function NotFoundComponent() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="wrap py-16 sm:py-24">
        <div className="rule-heavy max-w-2xl pt-4">
          <div className="kicker text-primary">Error 404</div>
          <h1 className="mt-2 text-[2.5rem] sm:text-[3.5rem]">We couldn’t find that page.</h1>
          <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">
            The address may be mistyped, or the channel may have moved. Everything on AuraTV is reachable from the links below.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              { to: "/", hash: "channels", t: "Browse all channels", d: "Sports, news, films and kids’ TV." },
              { to: "/", hash: "matches", t: "Today’s fixtures", d: "Kick-off times and where to watch." },
              { to: "/live", t: "Live events", d: "What is on air right now." },
              { to: "/faq", t: "Help & FAQ", d: "Streams not playing? Start here." },
              { to: "/contact", t: "Contact us", d: SITE.responseTime },
              { to: "/status", t: "Channel status", d: "Uptime checks for every channel." },
            ].map((l) => (
              <li key={l.t}>
                <Link to={l.to} hash={l.hash} className="tile tile-hover block p-4">
                  <div className="font-semibold">{l.t}</div>
                  <div className="mt-1 text-[13px] text-muted-foreground">{l.d}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="kicker text-primary">Something went wrong</div>
        <h1 className="mt-2 text-[1.75rem]">This page didn’t load</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">Try again, or head back to the front page.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="btn btn-primary"
          >
            Try again
          </button>
          <a href="/" className="btn btn-outline">
            Front page
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0f0e0c" },
      { name: "application-name", content: SITE.name },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: SITE.name },
      { name: "format-detection", content: "telephone=no" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "sitemap", type: "application/xml", href: "/sitemap.xml" },
    ],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(siteJsonLd()) },
      ...(GA_OK
        ? [
            { src: GA_SRC_BASE + GA_ID, async: true },
            {
              children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true});`,
            },
          ]
        : []),
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    initTvNavigation();
    if (!isCapacitor()) return;
    let remove: (() => void) | undefined;
    import("@capacitor/app")
      .then(({ App }) => {
        const p = App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) window.history.back();
          else App.exitApp();
        });
        Promise.resolve(p).then((h) => {
          remove = () => h.remove();
        });
      })
      .catch(() => {
        /* plugin not present */
      });
    return () => remove?.();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <FavoritesProvider>
            <CustomChannelsProvider>
              <AdminProvider>
                <Outlet />
                <InstallBanner />
                <TelegramPopup />
                <MobileTabBar />
              </AdminProvider>
            </CustomChannelsProvider>
          </FavoritesProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
