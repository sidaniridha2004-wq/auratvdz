import { createFileRoute } from "@tanstack/react-router";

// Serves og-image.png from the server-side asset store. Replace with a real file in
// /public/og-image.png and delete this route when you have one.
export const Route = createFileRoute("/og-image.png")({
  server: {
    handlers: {
      GET: async () => {
        const { assetResponse } = await import("@/lib/static-assets.server");
        return assetResponse("og-image.png");
      },
    },
  },
});
