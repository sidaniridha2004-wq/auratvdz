import { createFileRoute } from "@tanstack/react-router";
import { SITE } from "@/lib/site";

const BODY = `# AuraTV
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /thank-you
Disallow: /play/

User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

Sitemap: ${SITE.url}/sitemap.xml
`;

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(BODY, {
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
        }),
    },
  },
});
