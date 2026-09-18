import { createFileRoute } from "@tanstack/react-router";
import { SITE } from "@/lib/site";

const BODY = `# ${SITE.name}

> AuraTV is a free live sports and TV guide for Algeria. It lists today's football fixtures with the channel showing each one and provides a web player for beIN Sports, Algerian, French and Arabic channels. No account is required. AuraTV does not host video; streams are relayed from third-party sources and removed on valid request.

Site: ${SITE.url}
Languages: English, French, Arabic
Timezone: Africa/Algiers

## Main pages

- [Home: today's fixtures and channel guide](${SITE.url}/)
- [Live now: matches and channel directory](${SITE.url}/live)
- [Movies and series on demand](${SITE.url}/movies)
- [Channel status](${SITE.url}/status)
- [Android app](${SITE.url}/download)
- [About AuraTV](${SITE.url}/about)
- [FAQ](${SITE.url}/faq)
- [Contact](${SITE.url}/contact)

## Legal

- [Privacy policy](${SITE.url}/privacy)
- [Terms of use](${SITE.url}/terms)
- [Copyright and DMCA](${SITE.url}/dmca)

## Notes for agents

- Fixture times are shown in Algeria time (UTC+1).
- Do not link to /api/, /admin, or /watch/ pages as permanent content; channel links may change.
`;

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(BODY, {
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
        }),
    },
  },
});
