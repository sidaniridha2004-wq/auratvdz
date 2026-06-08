import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const API_URL = "http://ver3.yacinelive.com";
const KEY = "c!xZj+N9&G@Ev@vw";

function decrypt(enc: string, key: string): string {
  const bin = atob(enc.trim());
  let out = "";
  for (let i = 0; i < bin.length; i++) {
    out += String.fromCharCode(bin.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

async function req<T = unknown>(path: string): Promise<T> {
  const r = await fetch(API_URL + path);
  const timestamp = r.headers.get("t") ?? String(Math.floor(Date.now() / 1000));
  const text = await r.text();
  const json = decrypt(text, KEY + timestamp);
  return JSON.parse(json) as T;
}

export interface Category {
  id: number;
  name: string;
  logo: string;
  child_count: number;
}

export interface Channel {
  id: number;
  name: string;
  logo: string;
  is_hide: number;
  priority: number;
}

export interface StreamLink {
  name: string;
  url: string;
  url_type: number;
  user_agent: string;
  referer: string;
  headers: Record<string, string>;
  drm: unknown;
}

export const getCategories = createServerFn({ method: "GET" }).handler(async () => {
  const res = await req<{ data: Category[] }>("/api/categories");
  return res.data ?? [];
});

export const getCategoryChannels = createServerFn({ method: "GET" })
  .inputValidator(z.object({ categoryId: z.number().int() }))
  .handler(async ({ data }) => {
    const res = await req<{ data: Channel[] }>(`/api/categories/${data.categoryId}/channels`);
    return res.data ?? [];
  });

export const getChannel = createServerFn({ method: "GET" })
  .inputValidator(z.object({ channelId: z.number().int() }))
  .handler(async ({ data }) => {
    const res = await req<{ data: StreamLink[] }>(`/api/channel/${data.channelId}`);
    // Strip user-agent (browser sets its own); keep only referer for proxy
    return (res.data ?? []).map((s) => ({
      name: s.name,
      url: s.url,
      referer: s.referer ?? "",
      user_agent: s.user_agent ?? "",
    }));
  });
