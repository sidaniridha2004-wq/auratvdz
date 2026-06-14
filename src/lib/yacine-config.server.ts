import process from "node:process";

// The yacinelive public TV API obfuscates responses with a fixed XOR key.
// It is not a credential — anyone calling the upstream API uses the same
// value — but we still source it from an env var so operators can rotate
// or override it without code changes. Read INSIDE handlers (Cloudflare
// Workers bind env per-request).
export function getYacineConfig() {
  return {
    apiUrl: process.env.YACINE_API_URL ?? "http://ver3.yacinelive.com",
    decryptKey: process.env.YACINE_DECRYPT_KEY ?? "c!xZj+N9&G@Ev@vw",
  };
}
