import process from "node:process";

// Firebase Remote Config in the working Android APK currently points the API
// at this host. Keep it server-side so the host can be rotated later.
const CURRENT_API_URL = "https://def11.ycnapi.com";
const RETIRED_HOSTS = new Set(["def.yacinelive.com", "ver3.yacinelive.com", "deft.yacinelive.com"]);

// The upstream uses a fixed XOR key to obfuscate API responses. It is not a
// private credential. Keep configuration server-side and automatically ignore
// retired hosts so an old deployment variable cannot break playback.
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

  return {
    apiUrl,
    decryptKey:
      process.env.YACINE_DECRYPT_KEY?.trim() || "c!xZj+N9&G@Ev@vw",
  };
}
