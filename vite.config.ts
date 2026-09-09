// @lovable.dev/vite-tanstack-config already wires tanstackStart, viteReact,
// tailwindcss, tsConfigPaths, nitro, the @ alias and env injection. Do not add
// those plugins again or the build fails with duplicates.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Long-lived vendor chunks: the router/query/react trio changes rarely and
// hls.js only loads on watch pages, so splitting them keeps the first-load
// bundle small and lets returning visitors reuse cached vendor files.
const manualChunks = (id: string) => {
  if (!id.includes("node_modules")) return;
  if (id.includes("hls.js")) return "hls";
  if (id.includes("@supabase")) return "supabase";
  if (id.includes("lucide-react")) return "icons";
  if (id.includes("@tanstack")) return "tanstack";
  if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) return "react";
  return "vendor";
};

export default defineConfig({
  tanstackStart: {
    // src/server.ts wraps the SSR handler with security headers and error capture.
    server: { entry: "server" },
  },
  vite: {
    build: {
      // Never ship source maps to production; they expose the full source tree.
      sourcemap: false,
      cssCodeSplit: true,
      chunkSizeWarningLimit: 350,
      rollupOptions: { output: { manualChunks } },
    },
    // Drop console noise and debugger statements from the client bundle.
    esbuild: { drop: ["console", "debugger"], legalComments: "none" },
  },
});
