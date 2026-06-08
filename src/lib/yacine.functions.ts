import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const API_URL = "http://ver3.yacinelive.com";
const KEY = "c!xZj+N9&G@Ev@vw";

function decrypt(enc: string, key: string): string {
  const decoded = atob(enc.trim());
  let out = "";
  for (let i = 0; i < decoded.length; i++) {
    out += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

async function req<T = unknown>(path: string): Promise<T> {
  const r = await fetch(API_URL + path, { headers: { "User-Agent": "okhttp/4.9.0" } });
  const timestamp = r.headers.get("t") ?? String(Math.floor(Date.now() / 1000));
  const text = await r.text();
  const json = decrypt(text, KEY + timestamp);
  return JSON.parse(json) as T;
}

export interface Category {
  id: number;
  name: string;
  image?: string;
}

export interface Channel {
  id: number;
  name: string;
  image?: string;
  category_id?: number;
}

export interface ChannelDetail {
  id?: number;
  name?: string;
  image?: string;
  link?: string;
  link2?: string;
  link3?: string;
  link4?: string;
}

export const getCategories = createServerFn({ method: "GET" }).handler(async () => {
  const data = await req<Category[] | { categories: Category[] }>("/api/categories");
  return Array.isArray(data) ? data : (data.categories ?? []);
});

export const getCategoryChannels = createServerFn({ method: "GET" })
  .inputValidator(z.object({ categoryId: z.number().int() }))
  .handler(async ({ data }) => {
    const res = await req<Channel[] | { channels: Channel[] }>(
      `/api/categories/${data.categoryId}/channels`,
    );
    return Array.isArray(res) ? res : (res.channels ?? []);
  });

export const getChannel = createServerFn({ method: "GET" })
  .inputValidator(z.object({ channelId: z.number().int() }))
  .handler(async ({ data }) => {
    return await req<ChannelDetail>(`/api/channel/${data.channelId}`);
  });
