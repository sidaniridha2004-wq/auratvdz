import { createFileRoute } from "@tanstack/react-router";
import { assertSafeUrlResolved } from "@/lib/ssrf-guard";
import { verifyProxyParams } from "@/lib/stream-sign.server";

// Fetches a subtitle file chosen by our own server (signed link), converts
// SubRip to WebVTT when needed, fixes legacy Arabic encodings, and serves it
// same-origin so <track> can use it. Same SSRF rules as the stream proxy.

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 12_000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function plain(status: number, body: string) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

/** Decode bytes as UTF-8, falling back to Windows-1256 (legacy Arabic) or Latin-1. */
export function decodeSubtitleBytes(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const bad = (utf8.match(/\uFFFD/g) ?? []).length;
  if (bad === 0 || bad / Math.max(1, utf8.length) < 0.002) return utf8.replace(/^\uFEFF/, "");
  for (const enc of ["windows-1256", "iso-8859-6", "windows-1252"]) {
    try {
      return new TextDecoder(enc).decode(bytes).replace(/^\uFEFF/, "");
    } catch {
      // encoding not supported in this runtime; try the next
    }
  }
  return utf8;
}

/** SubRip -> WebVTT. Passes WebVTT through untouched apart from a normalised header. */
export function toWebVtt(text: string): string {
  const src = text.replace(/\r\n?/g, "\n").trim();
  if (/^WEBVTT/.test(src)) return `${src}\n`;

  const blocks = src.split(/\n{2,}/);
  const out: string[] = ["WEBVTT", ""];
  for (const block of blocks) {
    const lines = block.split("\n");
    // Drop a leading numeric cue index.
    if (lines.length && /^\d+$/.test(lines[0].trim())) lines.shift();
    if (!lines.length) continue;
    const timing = lines[0].match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})(.*)/);
    if (!timing) continue;
    const pad = (n: string, len: number) => n.padStart(len, "0").slice(0, len);
    const ms = (n: string) => n.padEnd(3, "0").slice(0, 3);
    const start = `${pad(timing[1], 2)}:${timing[2]}:${timing[3]}.${ms(timing[4])}`;
    const end = `${pad(timing[5], 2)}:${timing[6]}:${timing[7]}.${ms(timing[8])}`;
    const body = lines
      .slice(1)
      .map((l) => l.replace(/\{\\an?\d\}/g, "").replace(/<(?!\/?(i|b|u|c|v|ruby|rt|lang)\b)[^>]*>/gi, ""))
      .join("\n")
      .trim();
    if (!body) continue;
    out.push(`${start} --> ${end}`, body, "");
  }
  return `${out.join("\n")}\n`;
}

export const Route = createFileRoute("/api/public/subtitle")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const target = await verifyProxyParams(url.searchParams.get("u"), url.searchParams.get("s"));
        if (!target) return plain(403, "forbidden");

        let parsed: URL;
        try {
          parsed = await assertSafeUrlResolved(target.url);
        } catch {
          return plain(400, "blocked");
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const upstream = await fetch(parsed.toString(), {
            headers: { "user-agent": target.ua ?? UA, accept: "text/plain,text/vtt,application/x-subrip,*/*", ...(target.referer ? { referer: target.referer } : {}) },
            redirect: "follow",
            signal: controller.signal,
          });
          if (!upstream.ok) return plain(502, `upstream ${upstream.status}`);
          const length = Number(upstream.headers.get("content-length"));
          if (Number.isFinite(length) && length > MAX_BYTES) return plain(502, "subtitle too large");
          const buffer = new Uint8Array(await upstream.arrayBuffer());
          if (buffer.byteLength > MAX_BYTES) return plain(502, "subtitle too large");
          // Zip archives are occasionally returned by mirrors; refuse rather than guess.
          if (buffer[0] === 0x50 && buffer[1] === 0x4b) return plain(502, "archived subtitle");
          const vtt = toWebVtt(decodeSubtitleBytes(buffer));
          if (!/-->/.test(vtt)) return plain(502, "no cues");
          return new Response(vtt, {
            status: 200,
            headers: {
              "content-type": "text/vtt; charset=utf-8",
              "cache-control": "public, max-age=86400, immutable",
              "access-control-allow-origin": "*",
              "x-content-type-options": "nosniff",
            },
          });
        } catch (error) {
          return plain(504, error instanceof Error ? error.message : "upstream error");
        } finally {
          clearTimeout(timer);
        }
      },
    },
  },
});
