import process from "node:process";

// Firebase Remote Config in the working Android APK currently points the API
// and TV stream layers at these hosts. Keep them server-side so they can be
// rotated later without exposing configuration to the browser.
const CURRENT_API_URL = "https://def11.ycnapi.com";
const CURRENT_STREAM_URL = "https://tv.variety-buy.store";
const RETIRED_HOSTS = new Set(["def.yacinelive.com", "ver3.yacinelive.com", "deft.yacinelive.com"]);

function safeApiUrl(value: string | undefined): string | null {
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
  const apiUrl = safeApiUrl(process.env.YACINE_API_URL?.trim()) ?? CURRENT_API_URL;
  const streamUrl = safeApiUrl(process.env.YACINE_STREAM_URL?.trim()) ?? CURRENT_STREAM_URL;

  return {
    apiUrl,
    streamUrl,
    decryptKey:
      process.env.YACINE_DECRYPT_KEY?.trim() || "c!xZj+N9&G@Ev@vw",
  };
}
