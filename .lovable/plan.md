This is a large batch. Here is the exact plan I will execute end-to-end. Nothing is skipped, but I'm grouping items so the work is coherent and reviewable. Confirm and I'll start; each phase ends with a working preview.

## Phase A — Backend reliability & data

1. **Background probe scheduler** (`src/lib/probe-scheduler.server.ts`)
   - In-process interval that probes every M3U + AuraTV JSON stream every 3 min.
   - Stores `{ ok, status, ms, reason, checkedAt }` per channel in a module-level Map.
   - Boot-triggered lazily on the first request to any route (Workers-safe — no cron needed).
2. **Extend `/api/public/probe`** to return the scheduler's live snapshot; add `/api/public/probe/failure?slug=...` used by the player fallback.
3. **Match scraper hardening** (`src/lib/matches.functions.ts`)
   - 3-attempt retry with backoff + 8s timeout.
   - Secondary DOM patterns for team name / score / status when the primary selector misses.
   - Regex fallback that reconstructs `home 1-2 away` from raw text when structured parse fails.
4. **User-managed channels** — new route `/settings/channels`
   - Persisted in `localStorage` (`auratv.custom_channels`) as `{ name, category, logo, sources: [{quality,url}] }[]`.
   - Merged into the channel grid client-side under a "My Channels" section; editable/removable.

## Phase B — Design system & theming

5. **Dark-mode-default + light toggle** — `next-themes`-style provider via `useState` + `class="dark"` on `<html>`; sun/moon button in header. Tokens already in `styles.css`; add light variants.
6. **Typography** — load Satoshi + Cabinet Grotesk via `<link>` in `__root.tsx`; map to `--font-sans` / `--font-display`. Body ≥16px.
7. **i18n (AR/FR/EN)** — lightweight `src/lib/i18n.tsx` context (no lib), dictionaries for all UI strings, AR sets `dir="rtl"` on `<html>`. Persisted to `localStorage`.

## Phase C — Home page redesign

8. **Hero**: left-aligned, stadium background image (generated), floating live-match card on the right.
9. **Live ticker bar** pinned under navbar: live count · today's count · next kickoff, pulsing red dot.
10. **Merge duplicate channel sections** — single "beIN SPORTS MAX — Primary" block, one search, one grid.
11. **Section spacing/headings** — 80px vertical padding, left-aligned headings.

## Phase D — Cards

12. **MatchCard**: huge centered score, colored status badge (live/upcoming/finished), commentator w/ mic icon, channel logo, countdown for upcoming.
13. **ChannelCard**: 48×48 logo image w/ colored-initial fallback per category (sports=red, movies=blue, kids=yellow, news=grey), category pill, star favorite button, hover tooltip, gold border + "Featured" badge for beIN MAX 1–6.
14. **Favorites**: `localStorage`-backed store, "My Favorites" tab pinned above categories, empty state copy.

## Phase E — Player & status

15. **Player states**: shimmer skeleton while loading; 8s timeout → "Stream temporarily unavailable — Try Mirror Server" button that swaps to the next known source (or calls `/api/public/probe/failure` to pick a healthy alternate).
16. **Quality selector UX**: "Select Quality ▾" label, active tab solid, tooltip.
17. **Channel Status page** `/status` — table of every channel: last check time, ok/failed pill, failure reason, response time; auto-refresh every 30s. Linked from footer + navbar overflow.

## Phase F — Navigation, PWA, SEO, footer

18. **Header**: sticky w/ blur (already), add sun/moon, lang switcher, Favorites link (highlighted when non-empty).
19. **Mobile bottom tab bar** — Home / Matches / Channels / Favorites.
20. **PWA** — `public/manifest.webmanifest` (standalone, dark theme, 192/512 icons from existing logo), minimal manifest-only support (no service worker per PWA skill guidance). "Install App" banner component, dismissible, once-per-user via `localStorage`.
21. **OG meta** — update `__root.tsx` head with the exact copy requested; keep existing preview image.
22. **Footer** — logo+tagline, quick links, lang switcher, disclaimer, © 2026 line.

## Technical notes

- No new npm deps required except potentially `@fontsource-*` — but per stack rules we'll load Satoshi + Cabinet Grotesk via `<link>` in `__root.tsx`, no `@import`.
- Scheduler runs in-Worker; each Worker instance holds its own probe cache — acceptable for UI freshness.
- All existing stream URLs, routes, match logic preserved.
- No backend/db changes; favorites, language, theme, custom channels all `localStorage`.

## Scope check

This is roughly 25–30 new/edited files. I'll implement in the phase order above so the preview stays functional between batches. Want me to proceed with the full batch, or would you rather I ship Phases A+B first and then the rest in a follow-up?