// Defence-in-depth against SSRF for the stream proxy.
//
// Checks (in order): scheme, hostname blocklist, literal IP ranges, then a
// real DNS lookup so `evil.example` -> 10.0.0.5 is caught too. Every redirect
// hop is re-checked by the caller.

import { lookup } from "node:dns/promises";

function ipv4Parts(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

export function isBlockedIPv4(ip: string): boolean {
  const parts = ipv4Parts(ip);
  if (!parts) return false;
  const [a, b] = parts;
  if (a === 0) return true; // "this" network
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 192 && b === 0 && parts[2] === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 0 && parts[2] === 2) return true; // TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

export function isBlockedIPv6(raw: string): boolean {
  const h = raw.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fe80:") || h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb")) return true; // link-local
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local
  if (h.startsWith("::ffff:")) {
    const v4 = h.slice(7);
    return ipv4Parts(v4) ? isBlockedIPv4(v4) : true;
  }
  if (h.startsWith("64:ff9b:")) return true; // NAT64 — could map to private v4
  if (h.startsWith("2001:db8:")) return true; // documentation
  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.goog",
  "metadata",
  "instance-data",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain", ".home.arpa", ".in-addr.arpa", ".ip6.arpa"];

/** Synchronous checks only (scheme, hostname, literal IP). */
export function assertSafeUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  if (parsed.username || parsed.password) throw new Error("Credentials in URL are not allowed");

  const host = parsed.hostname.toLowerCase();
  if (!host) throw new Error("Missing host");
  if (BLOCKED_HOSTNAMES.has(host)) throw new Error("Blocked host");
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) throw new Error("Blocked host");
  if (!host.includes(".") && !host.includes(":")) throw new Error("Blocked host"); // bare intranet names

  if (host.includes(":")) {
    if (isBlockedIPv6(host)) throw new Error("Blocked address");
  } else if (ipv4Parts(host)) {
    if (isBlockedIPv4(host)) throw new Error("Blocked address");
  } else if (/^0x[0-9a-f]+$/i.test(host) || /^\d+$/.test(host)) {
    throw new Error("Blocked address"); // integer / hex IP forms
  }
  return parsed;
}

/** Full check including DNS resolution. Use before every outbound fetch. */
export async function assertSafeUrlResolved(raw: string): Promise<URL> {
  const parsed = assertSafeUrl(raw);
  const host = parsed.hostname.toLowerCase();
  const isLiteral = host.includes(":") || ipv4Parts(host) !== null;
  if (isLiteral) return parsed;

  let addrs: Array<{ address: string; family: number }>;
  try {
    addrs = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error("Host could not be resolved");
  }
  if (addrs.length === 0) throw new Error("Host could not be resolved");
  for (const a of addrs) {
    if (a.family === 4 && isBlockedIPv4(a.address)) throw new Error("Blocked address");
    if (a.family === 6 && isBlockedIPv6(a.address)) throw new Error("Blocked address");
  }
  return parsed;
}
