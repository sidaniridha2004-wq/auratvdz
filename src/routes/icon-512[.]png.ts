import { createFileRoute } from "@tanstack/react-router";

// Serves icon-512.png from the server-side asset store. Replace with a real file in
// /public/icon-512.png and delete this route when you have one.
export const Route = createFileRoute("/icon-512.png")({
  server: {
    handlers: {
      GET: async () => {
        const { assetResponse } = await import("@/lib/static-assets.server");
        return assetResponse("icon-512.png");
      },
    },
  },
});
