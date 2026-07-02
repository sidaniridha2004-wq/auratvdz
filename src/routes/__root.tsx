import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { TelegramPopup } from "../components/TelegramPopup";
import { InstallBanner } from "../components/InstallBanner";
import { MobileTabBar } from "../components/MobileTabBar";
import { AdminHotkey } from "../components/AdminHotkey";
import { I18nProvider } from "../lib/i18n";
import { ThemeProvider } from "../lib/theme";
import { FavoritesProvider } from "../lib/favorites";
import { CustomChannelsProvider } from "../lib/custom-channels";
import { AdminProvider } from "../lib/admin";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. Try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Go home
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
      { name: "theme-color", content: "#0f0f0f" },
      { title: "AuraTV — Live Sports & TV Streaming" },
      {
        name: "description",
        content:
          "Watch beIN Sports, Algeria TV, MBC, France TV live — free, HD, zero ads. Built for Algeria.",
      },
      { property: "og:site_name", content: "AuraTV" },
      { property: "og:title", content: "AuraTV — Live Sports & TV Streaming" },
      {
        property: "og:description",
        content:
          "Watch beIN Sports, Algeria TV, MBC, France TV live — free, HD, zero ads. Built for Algeria.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://auratvdz.lovable.app" },
      { property: "og:image", content: "https://auratvdz.lovable.app/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AuraTV — Live Sports & TV Streaming" },
      {
        name: "twitter:description",
        content:
          "Watch beIN Sports, Algeria TV, MBC, France TV live — free, HD, zero ads. Built for Algeria.",
      },
      { name: "twitter:image", content: "https://auratvdz.lovable.app/og-image.png" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "AuraTV" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "preconnect", href: "https://api.fontshare.com" },
      { rel: "preconnect", href: "https://cdn.fontshare.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&f[]=cabinet-grotesk@700,800,900&display=swap",
      },
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
        <Analytics />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <FavoritesProvider>
            <CustomChannelsProvider>
              <AdminProvider>
                <div className="pb-20 sm:pb-0">
                  <Outlet />
                </div>
                <TelegramPopup />
                <InstallBanner />
                <MobileTabBar />
                <AdminHotkey />
              </AdminProvider>
            </CustomChannelsProvider>
          </FavoritesProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
