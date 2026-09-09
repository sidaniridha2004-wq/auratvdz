import { createFileRoute } from "@tanstack/react-router";

// Serves icon-192.png from the server-side asset store. Replace with a real file in
// /public/icon-192.png and delete this route when you have one.
export const Route = createFileRoute("/icon-192.png")({
  server: {
    handlers: {
      GET: async () => {
        const { assetResponse } = await import("@/lib/static-assets.server");
        return assetResponse("icon-192.png");
      },
    },
  },
});
