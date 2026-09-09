import { SITE, absoluteUrl } from "@/lib/site";

type Meta = { title?: string; name?: string; property?: string; content?: string };
type LinkTag = { rel: string; href: string; type?: string; sizes?: string; crossOrigin?: "anonymous" | "use-credentials" };
type Script = { type?: string; children?: string; src?: string; async?: boolean };

export interface PageSeo {
  /** Page title WITHOUT the site suffix. */
  title: string;
  description: string;
  /** Absolute or root-relative canonical path. */
  path: string;
  image?: string;
  noindex?: boolean;
  type?: "website" | "article";
  jsonLd?: unknown | unknown[];
}

/**
 * Builds the `head()` return value for a route: unique title, description,
 * canonical, Open Graph, Twitter card and optional JSON-LD.
 */
export function pageHead(seo: PageSeo): { meta: Meta[]; links: LinkTag[]; scripts: Script[] } {
  const fullTitle = seo.title === SITE.name ? SITE.name : `${seo.title} — ${SITE.name}`;
  const canonical = absoluteUrl(seo.path);
  const image = absoluteUrl(seo.image ?? SITE.ogImage);
  const desc = seo.description.slice(0, 158);

  const meta: Meta[] = [
    { title: fullTitle },
    { name: "description", content: desc },
    { name: "robots", content: seo.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large" },
    { property: "og:type", content: seo.type ?? "website" },
    { property: "og:site_name", content: SITE.name },
    { property: "og:locale", content: SITE.locale },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: desc },
    { property: "og:url", content: canonical },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: `${SITE.name} — ${seo.title}` },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: desc },
    { name: "twitter:image", content: image },
  ];

  const links: LinkTag[] = [{ rel: "canonical", href: canonical }];

  const scripts: Script[] = [];
  if (seo.jsonLd) {
    const list = Array.isArray(seo.jsonLd) ? seo.jsonLd : [seo.jsonLd];
    for (const obj of list) {
      scripts.push({ type: "application/ld+json", children: JSON.stringify(obj) });
    }
  }
  return { meta, links, scripts };
}
