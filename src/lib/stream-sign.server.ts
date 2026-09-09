// HMAC-signed proxy URLs.
//
// The stream proxy used to accept ANY url/referer/user-agent from the query
// string, which made the site an open relay (bandwidth theft, header
// spoofing, SSRF probing). Now only URLs minted by our own server — with the
// upstream URL and headers baked in and signed — are accepted.

export interface ProxyTarget {
  url: string;
  referer?: string;
  ua?: string;
}

const SIG_LEN = 32; // base64url chars of the truncated HMAC we keep

function secret(): string {
  const s = process.env.STREAM_SIGNING_SECRET || process.env.ADMIN_PASSWORD || "";
  if (s.length >= 16) return s;
  // Fallback keeps playback working on a mis-configured deploy while still
  // rejecting arbitrary user-supplied URLs (the value is not guessable
  // without reading the server bundle). Set STREAM_SIGNING_SECRET in prod.
  return "auratv-fallback-signing-secret-set-STREAM_SIGNING_SECRET";
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let keyPromise: Promise<CryptoKey> | undefined;
function key(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  }
  return keyPromise;
}

async function sign(payload: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await key(), new TextEncoder().encode(payload));
  return b64url(new Uint8Array(sig)).slice(0, SIG_LEN);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function encodeTarget(t: ProxyTarget): string {
  const compact: ProxyTarget = { url: t.url };
  if (t.referer) compact.referer = t.referer;
  if (t.ua) compact.ua = t.ua;
  return b64url(new TextEncoder().encode(JSON.stringify(compact)));
}

/** Build a signed, root-relative proxy URL. */
export async function signedProxyUrl(t: ProxyTarget): Promise<string> {
  const payload = encodeTarget(t);
  const sig = await sign(payload);
  return `/api/public/stream?u=${payload}&s=${sig}`;
}

/** Verify a `u`/`s` pair. Returns the decoded target or null. */
export async function verifyProxyParams(u: string | null, s: string | null): Promise<ProxyTarget | null> {
  if (!u || !s || u.length > 8192 || s.length !== SIG_LEN) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(u) || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
  const expected = await sign(u);
  if (!constantTimeEqual(expected, s)) return null;
  try {
    const obj = JSON.parse(new TextDecoder().decode(unb64url(u))) as Partial<ProxyTarget>;
    if (!obj || typeof obj.url !== "string") return null;
    return {
      url: obj.url,
      referer: typeof obj.referer === "string" ? obj.referer : undefined,
      ua: typeof obj.ua === "string" ? obj.ua : undefined,
    };
  } catch {
    return null;
  }
}
