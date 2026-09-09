import { createFileRoute } from "@tanstack/react-router";

// Serves icon-512.png rendered on the server (see src/lib/brand-images.server.ts).
// To use a designed file instead, add /public/icon-512.png and delete this route.
export const Route = createFileRoute("/icon-512.png")({
  server: {
    handlers: {
      GET: async () => {
        const { brandImageResponse } = await import("@/lib/brand-images.server");
        return brandImageResponse("icon-512.png");
      },
    },
  },
});
