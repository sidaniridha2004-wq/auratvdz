import process from "node:process";

const CURRENT_API_URL = "https://def.yacinelive.com";
const RETIRED_HOST = "ver3.yacinelive.com";

// The upstream uses a fixed XOR key to obfuscate API responses. It is not a
// private credential. Keep configuration server-side and automatically ignore
// the retired ver3 host so an old deployment variable cannot break playback.
export function getYacineConfig() {
  const configuredUrl = process.env.YACINE_API_URL?.trim();
  const apiUrl =
    configuredUrl && !configuredUrl.includes(RETIRED_HOST)
      ? configuredUrl.replace(/\/$/, "")
      : CURRENT_API_URL;

  return {
    apiUrl,
    decryptKey:
      process.env.YACINE_DECRYPT_KEY?.trim() || "c!xZj+N9&G@Ev@vw",
  };
}
