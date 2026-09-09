// Server-only admin authentication.
//
// Model: the operator sets ADMIN_PASSWORD in the server environment. The
// browser sends the password exactly once (sign-in); the server answers with a
// short-lived HMAC-signed session token. Every later admin write carries the
// token, never the password. Tokens are bound to the current ADMIN_PASSWORD,
// so rotating the password instantly invalidates every open session.
//
// There is deliberately NO database fallback: the old `admin_password_matches`
// RPC shipped the password in plain text inside a migration file.

import { createClient } from "@supabase/supabase-js";

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const TOKEN_PREFIX = "at1.";

function env(name: string): string {
  const v = process.env[name];
  return typeof v === "string" ? v : "";
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function toBase64Url(bytes: ArrayBuffer): string {
  let bin = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toBase64Url(sig);
}

/** Secret used to sign admin sessions. Derived from the password so rotation logs everyone out. */
function sessionSecret(): string {
  const pw = env("ADMIN_PASSWORD");
  const extra = env("ADMIN_SESSION_SECRET");
  return `${pw}::${extra}::auratv-admin-session`;
}

export function adminConfigured(): boolean {
  return env("ADMIN_PASSWORD").length >= 8;
}

/** Check the raw password. Fails closed when ADMIN_PASSWORD is not set. */
export function passwordMatches(candidate: string): boolean {
  const expected = env("ADMIN_PASSWORD");
  if (expected.length < 8) return false;
  return timingSafeEqual(candidate, expected);
}

export async function issueAdminToken(): Promise<string> {
  const exp = Date.now() + TOKEN_TTL_MS;
  const nonce = toBase64Url(crypto.getRandomValues(new Uint8Array(12)).buffer);
  const payload = `${exp}.${nonce}`;
  const sig = await hmac(sessionSecret(), payload);
  return `${TOKEN_PREFIX}${payload}.${sig}`;
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  if (!token.startsWith(TOKEN_PREFIX)) return false;
  const parts = token.slice(TOKEN_PREFIX.length).split(".");
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = await hmac(sessionSecret(), `${expStr}.${nonce}`);
  return timingSafeEqual(sig, expected);
}

/**
 * Accepts either a session token (normal case) or the raw password (first
 * request from the sign-in form). Throws "Unauthorized" otherwise.
 */
export async function requireAdmin(credential: string): Promise<void> {
  if (!adminConfigured()) throw new Error("Admin is disabled: ADMIN_PASSWORD is not configured");
  if (typeof credential !== "string" || credential.length === 0) throw new Error("Unauthorized");
  if (credential.startsWith(TOKEN_PREFIX)) {
    if (await verifyAdminToken(credential)) return;
    throw new Error("Unauthorized");
  }
  if (passwordMatches(credential)) return;
  throw new Error("Unauthorized");
}

/**
 * Supabase client for server functions. Uses the service-role key when the
 * operator provides one (writes bypass RLS after our own auth check), else the
 * publishable key (reads only unless RLS allows writes).
 */
export function serverSupabase(opts: { admin?: boolean } = {}) {
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const service = env("SUPABASE_SERVICE_ROLE_KEY");
  const publishable = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const key = opts.admin && service ? service : publishable;
  if (!url || !key) throw new Error("Supabase is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: opts.admin ? { "x-auratv-admin": "1" } : {},
    },
  });
}
