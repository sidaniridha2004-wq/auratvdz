import process from "node:process";

// The current Android client references the ycnapi.com API family. Keep this
// server-side so the upstream can be rotated without exposing config to users.
const CURRENT_API_URL = "https://def.ycnapi.com";
const CURRENT_STREAM_URL = "https://tv.variety-buy.store";
const RETIRED_HOSTS = new Set(["def.yacinelive.com", "ver3.yacinelive.com"]);

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

export function getYacineConfig() {
  const apiUrl = safeUrl(process.env.YACINE_API_URL?.trim()) ?? CURRENT_API_URL;
  const streamUrl = safeUrl(process.env.YACINE_STREAM_URL?.trim()) ?? CURRENT_STREAM_URL;

  return {
    apiUrl,
    streamUrl,
    decryptKey:
      process.env.YACINE_DECRYPT_KEY?.trim() || "c!xZj+N9&G@Ev@vw",
  };
}
