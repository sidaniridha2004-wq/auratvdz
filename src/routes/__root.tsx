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

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { TelegramPopup } from "../components/TelegramPopup";
import { InstallBanner } from "../components/InstallBanner";
import { MobileTabBar } from "../components/MobileTabBar";
import { I18nProvider } from "../lib/i18n";
import { ThemeProvider } from "../lib/theme";
import { FavoritesProvider } from "../lib/favorites";
import { CustomChannelsProvider } from "../lib/custom-channels";

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
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
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
        <h1 className="text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try refreshing or head back home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
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
      { property: "og:description", content: "Watch beIN Sports, Algeria TV, MBC, France TV live — free, HD, zero ads. Built for Algeria." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://auratvdz.lovable.app" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/86a5a06b-031f-4ac9-983d-cec0d52c751b/id-preview-5c4c47a8--5e919ac5-5ede-4361-b9c1-bc5b694f362f.lovable.app-1781263599454.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AuraTV — Live Sports & TV Streaming" },
      { name: "twitter:description", content: "Watch beIN Sports, Algeria TV, MBC, France TV live — free, HD, zero ads. Built for Algeria." },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/86a5a06b-031f-4ac9-983d-cec0d52c751b/id-preview-5c4c47a8--5e919ac5-5ede-4361-b9c1-bc5b694f362f.lovable.app-1781263599454.png" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "AuraTV" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/86a5a06b-031f-4ac9-983d-cec0d52c751b/id-preview-5c4c47a8--5e919ac5-5ede-4361-b9c1-bc5b694f362f.lovable.app-1781263599454.png" },
      { rel: "preconnect", href: "https://api.fontshare.com" },
      { rel: "preconnect", href: "https://cdn.fontshare.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&f[]=cabinet-grotesk@700,800,900&display=swap" },
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

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <FavoritesProvider>
            <CustomChannelsProvider>
              <Outlet />
              <TelegramPopup />
              <InstallBanner />
              <MobileTabBar />
            </CustomChannelsProvider>
          </FavoritesProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
