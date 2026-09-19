import process from "node:process";

// The current Android client references the ycnapi.com API family. Keep this
// server-side so the upstream can be rotated without exposing config to users.
const CURRENT_API_URL = "https://def.ycnapi.com";
const CURRENT_STREAM_URL = "https://tv.variety-buy.store";
const RETIRED_HOSTS = new Set(["def.yacinelive.com", "ver3.yacinelive.com"]);

let discoveredApiUrl: string | null = null;
let discoveredStreamUrl: string | null = null;

function safeUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (RETIRED_HOSTS.has(parsed.hostname.toLowerCase())) return null;
    return value.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** Called by the server-only Firebase discovery routine after a successful fetch. */
export function setDiscoveredYacineConfig(apiUrl?: string, streamUrl?: string): void {
  discoveredApiUrl = safeUrl(apiUrl) ?? discoveredApiUrl;
  discoveredStreamUrl = safeUrl(streamUrl) ?? discoveredStreamUrl;
}

export function getYacineConfig() {
  const configuredApiUrl = safeUrl(process.env.YACINE_API_URL?.trim());
  const configuredStreamUrl = safeUrl(process.env.YACINE_STREAM_URL?.trim());

  return {
    apiUrl: configuredApiUrl ?? discoveredApiUrl ?? CURRENT_API_URL,
    streamUrl: configuredStreamUrl ?? discoveredStreamUrl ?? CURRENT_STREAM_URL,
    decryptKey:
      process.env.YACINE_DECRYPT_KEY?.trim() || "c!xZj+N9&G@Ev@vw",
  };
}
