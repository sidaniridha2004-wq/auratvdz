import { createFileRoute } from "@tanstack/react-router";

// Serves og-image.png rendered on the server (see src/lib/brand-images.server.ts).
// To use a designed file instead, add /public/og-image.png and delete this route.
export const Route = createFileRoute("/og-image.png")({
  server: {
    handlers: {
      GET: async () => {
        const { brandImageResponse } = await import("@/lib/brand-images.server");
        return brandImageResponse("og-image.png");
      },
    },
  },
});
