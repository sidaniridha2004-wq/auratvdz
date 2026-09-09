// Brand images (social share card and PWA icons) rendered on the server from
// code, so no binary files need to live in the repository. Output is a plain
// 8-bit RGB PNG built with node:zlib. Each image is rendered once per process
// and cached.
//
// To use a designed file instead, drop it into /public at the same path and
// delete the matching route under src/routes.

import { deflateSync } from "node:zlib";

type Rgb = readonly [number, number, number];

const BG: Rgb = [15, 14, 12];
const FG: Rgb = [241, 236, 226];
const MUTED: Rgb = [143, 138, 128];
const RULE: Rgb = [42, 40, 37];
const RED: Rgb = [217, 39, 47];
const GOLD: Rgb = [240, 180, 41];

// 5x7 pixel font, upper case only. Each glyph is seven rows of five bits.
const GLYPHS: Record<string, readonly string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "10001", "11001", "10101", "10011", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "'": ["01100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "\u00b7": ["00000", "00000", "00000", "01100", "01100", "00000", "00000"],
};

const GLYPH_W = 5;
const GLYPH_H = 7;
const GLYPH_GAP = 1;

class Canvas {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;

  constructor(width: number, height: number, bg: Rgb) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 3);
    for (let i = 0; i < width * height; i++) {
      this.data[i * 3] = bg[0];
      this.data[i * 3 + 1] = bg[1];
      this.data[i * 3 + 2] = bg[2];
    }
  }

  set(x: number, y: number, c: Rgb): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 3;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
  }

  rect(x: number, y: number, w: number, h: number, c: Rgb): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }

  roundedRect(x: number, y: number, w: number, h: number, r: number, c: Rgb): void {
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const dx = xx < r ? r - xx - 0.5 : xx >= w - r ? xx - (w - r) + 0.5 : 0;
        const dy = yy < r ? r - yy - 0.5 : yy >= h - r ? yy - (h - r) + 0.5 : 0;
        if (dx * dx + dy * dy <= r * r) this.set(x + xx, y + yy, c);
      }
    }
  }

  // Right-pointing play triangle inside the box (x, y, w, h).
  play(x: number, y: number, w: number, h: number, c: Rgb): void {
    const half = h / 2;
    for (let yy = 0; yy < h; yy++) {
      const t = 1 - Math.abs(yy + 0.5 - half) / half;
      const span = Math.round(w * t);
      for (let xx = 0; xx < span; xx++) this.set(x + xx, y + yy, c);
    }
  }

  text(str: string, x: number, y: number, scale: number, c: Rgb): void {
    let cx = x;
    for (const ch of str.toUpperCase()) {
      const g = GLYPHS[ch] ?? GLYPHS[" "];
      for (let row = 0; row < GLYPH_H; row++) {
        const bits = g[row];
        for (let col = 0; col < GLYPH_W; col++) {
          if (bits[col] === "1") this.rect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
      cx += (GLYPH_W + GLYPH_GAP) * scale;
    }
  }

  static textWidth(str: string, scale: number): number {
    const n = Array.from(str).length;
    return n === 0 ? 0 : n * (GLYPH_W + GLYPH_GAP) * scale - GLYPH_GAP * scale;
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(c: Canvas): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.width, 0);
  ihdr.writeUInt32BE(c.height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const stride = c.width * 3;
  const raw = Buffer.alloc((stride + 1) * c.height);
  for (let y = 0; y < c.height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    raw.set(c.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", new Uint8Array(0)),
  ]);
}

function renderIcon(size: number): Buffer {
  const c = new Canvas(size, size, BG);
  const pad = Math.round(size * 0.06);
  const r = Math.round(size * 0.14);
  c.roundedRect(pad, pad, size - pad * 2, size - pad * 2, r, RED);
  const h = Math.round(size * 0.44);
  const w = Math.round(h * 0.86);
  c.play(Math.round((size - w) / 2 + size * 0.03), Math.round((size - h) / 2), w, h, FG);
  return encodePng(c);
}

function renderOgImage(): Buffer {
  const W = 1200;
  const H = 630;
  const M = 64; // margin
  const c = new Canvas(W, H, BG);

  // top strip
  c.text("auratvdz.lovable.app", M, 58, 3, GOLD);
  const right = "free \u00b7 no sign-up";
  c.text(right, W - M - Canvas.textWidth(right, 3), 58, 3, GOLD);
  c.rect(M, 96, W - M * 2, 2, RULE);

  // mark + wordmark
  c.roundedRect(M, 128, 96, 96, 10, RED);
  c.play(M + 34, 128 + 26, 38, 44, FG);
  c.text("auratv", M + 96 + 28, 134, 12, FG);

  // headline
  c.text("live sport and tv guide", M, 268, 7, FG);
  c.text("for algeria", M, 336, 7, FG);

  // standfirst
  c.text("today's fixtures, the channel showing each one,", M, 428, 3, MUTED);
  c.text("and a player that works.", M, 460, 3, MUTED);

  // bottom strip
  c.rect(M, 536, W - M * 2, 2, RULE);
  c.text("bein sports \u00b7 algerian \u00b7 french \u00b7 arabic channels", M, 560, 3, MUTED);

  return encodePng(c);
}

const RENDERERS: Record<string, () => Buffer> = {
  "og-image.png": renderOgImage,
  "icon-192.png": () => renderIcon(192),
  "icon-512.png": () => renderIcon(512),
};

const cache = new Map<string, Buffer>();

export function renderBrandImage(key: string): Buffer | null {
  const render = RENDERERS[key];
  if (!render) return null;
  let buf = cache.get(key);
  if (!buf) {
    buf = render();
    cache.set(key, buf);
  }
  return buf;
}

export function brandImageResponse(key: string): Response {
  const buf = renderBrandImage(key);
  if (!buf) return new Response("Not found", { status: 404 });
  const body = new Uint8Array(new ArrayBuffer(buf.byteLength));
  body.set(buf);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "content-length": String(body.byteLength),
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      "x-content-type-options": "nosniff",
    },
  });
}
