// Single source of truth for public site metadata. Edit here, not in routes.

export const SITE = {
  name: "AuraTV",
  legalName: "AuraTV",
  url: "https://auratvdz.lovable.app",
  locale: "en_DZ",
  description:
    "AuraTV is a free live sports and TV guide for Algeria: beIN Sports, Algerian, French and Arabic channels with today's fixtures in one place.",
  telegram: "https://t.me/Aura_TV",
  // Replace with a real mailbox before launch. These are placeholders on purpose.
  contactEmail: "contact@auratv.example",
  dmcaEmail: "dmca@auratv.example",
  // Physical address used for LocalBusiness schema + the map on /contact.
  address: {
    street: "",
    city: "Algiers",
    region: "Algiers Province",
    postal: "16000",
    country: "DZ",
  },
  geo: { lat: 36.7538, lng: 3.0588 },
  responseTime: "We answer every message within 24 hours, seven days a week.",
  founded: "2026",
  ogImage: "/og-image.png",
  apkUrl: "https://github.com/sidaniridha2004-wq/streambox-tv/raw/refs/heads/main/AuraTVs.apk",
} as const;

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/** JSON-LD for the whole site (Organization + WebSite). Injected once in the root. */
export function siteJsonLd() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE.url}/#org`,
      name: SITE.name,
      url: SITE.url,
      logo: absoluteUrl("/icon-512.png"),
      sameAs: [SITE.telegram],
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: SITE.contactEmail,
          url: SITE.telegram,
          availableLanguage: ["en", "fr", "ar"],
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      name: SITE.name,
      url: SITE.url,
      inLanguage: ["en", "fr", "ar"],
      publisher: { "@id": `${SITE.url}/#org` },
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE.url}/?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

/** LocalBusiness schema for the contact page. */
export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE.url}/#business`,
    name: SITE.legalName,
    url: SITE.url,
    image: absoluteUrl(SITE.ogImage),
    email: SITE.contactEmail,
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.address.street || undefined,
      addressLocality: SITE.address.city,
      addressRegion: SITE.address.region,
      postalCode: SITE.address.postal,
      addressCountry: SITE.address.country,
    },
    geo: { "@type": "GeoCoordinates", latitude: SITE.geo.lat, longitude: SITE.geo.lng },
    areaServed: "DZ",
    priceRange: "Free",
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "00:00",
        closes: "23:59",
      },
    ],
    sameAs: [SITE.telegram],
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

export function faqJsonLd(items: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}
