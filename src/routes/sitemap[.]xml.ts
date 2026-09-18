import { createFileRoute } from "@tanstack/react-router";
import { SITE } from "@/lib/site";

const PUBLIC_PATHS = [
  ["/", "hourly", "1.0"],
  ["/live", "hourly", "0.9"],
  ["/movies", "daily", "0.9"],
  ["/download", "monthly", "0.7"],
  ["/status", "hourly", "0.5"],
  ["/about", "monthly", "0.6"],
  ["/faq", "monthly", "0.6"],
  ["/contact", "monthly", "0.6"],
  ["/case-studies", "monthly", "0.5"],
  ["/privacy", "yearly", "0.3"],
  ["/terms", "yearly", "0.3"],
  ["/dmca", "yearly", "0.3"],
] as const;

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PUBLIC_PATHS.map(
          ([path, changefreq, priority]) => `  <url><loc>${escapeXml(`${SITE.url}${path}`)}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`,
        ).join("\n")}\n</urlset>\n`;
        return new Response(body, {
          headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
        });
      },
    },
  },
});
