import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then((m) => (m.default ?? m) as ServerEntry);
  }
  return serverEntryPromise;
}

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

// Env is only guaranteed to be bound while a request is in flight on edge
// runtimes, so the policy is built lazily on the first request and memoised.
function supabaseOrigin(): string {
  const raw = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  try {
    return raw ? new URL(raw).origin : "";
  } catch {
    return "";
  }
}

let cspCache: string | null = null;
function csp(): string {
  if (cspCache) return cspCache;
  const origin = supabaseOrigin();
  const ws = origin ? origin.replace(/^https:/, "wss:") : "";
  cspCache = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' mailto:",
    // TanStack Start injects a small inline bootstrap script and GA needs its
    // own inline config line; 'unsafe-inline' for scripts is the price of that
    // without a nonce pipeline. Styles are inline via Tailwind's SSR path.
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
    "font-src 'self' https://cdn.fontshare.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    ["connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com", origin, ws]
      .filter(Boolean)
      .join(" "),
    "worker-src 'self' blob:",
    "frame-src https://www.openstreetmap.org",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
  return cspCache;
}

const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "cross-origin-opener-policy": "same-origin",
  "x-permitted-cross-domain-policies": "none",
};

function withSecurityHeaders(response: Response, pathname: string): Response {
  // Streams and playlists are consumed by the media pipeline; a CSP on them is
  // pointless and the relay already sets its own cache/CORS headers.
  const isStream = pathname.startsWith("/api/public/stream") || pathname.endsWith(".m3u8") || pathname.endsWith(".ts");
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  if (!isStream && !headers.has("content-security-policy")) headers.set("content-security-policy", csp());
  // Never leak framework fingerprints.
  headers.delete("x-powered-by");
  headers.delete("server");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// ---------------------------------------------------------------------------
// Error normalisation
// ---------------------------------------------------------------------------

const ERROR_HEADERS = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };

function recordServerError(error: unknown): void {
  // Keep a one-line, stack-free record so that hosting logs are useful but
  // never echo request data back to the client.
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[auratv] ${new Date().toISOString()} ${message.slice(0, 500)}\n`);
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"}; try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  recordServerError(consumeLastCapturedError() ?? new Error("h3 swallowed SSR error"));
  return new Response(renderErrorPage(), { status: 500, headers: ERROR_HEADERS });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const pathname = new URL(request.url).pathname;
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response), pathname);
    } catch (error) {
      recordServerError(error);
      return withSecurityHeaders(new Response(renderErrorPage(), { status: 500, headers: ERROR_HEADERS }), pathname);
    }
  },
};
