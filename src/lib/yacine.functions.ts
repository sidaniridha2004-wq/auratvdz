import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getYacineConfig } from "./yacine-config.server";
import type { YacineDirectory, YacineEvent } from "./yacine-api.server";

// Server functions for the Yacine directory. Raw stream URLs / headers are
// never returned to the browser — playback always goes through
// /api/public/master, which mints signed proxy links.

function decrypt(enc: string, key: string): string {
  const bin = atob(enc.trim());
  let out = "";
  for (let i = 0; i < bin.length; i++) {
    out += String.fromCharCode(bin.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

async function req<T = unknown>(path: string): Promise<T> {
  const { apiUrl, decryptKey } = getYacineConfig();
  const url = apiUrl + path;
  const attempt = async (n: number): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const r = await fetch(url, { signal: controller.signal, headers: { "user-agent": "okhttp/4.9.0" } });
      const timestamp = r.headers.get("t") ?? String(Math.floor(Date.now() / 1000));
      const body = await r.text();
      if (!r.ok) throw new Error(`upstream ${r.status}`);
      return JSON.parse(decrypt(body, decryptKey + timestamp)) as T;
    } catch (error) {
      if (n < 2) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (n + 1)));
        return attempt(n + 1);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
  return attempt(0);
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

export type {
  YacineCategory,
  YacineChannel,
  YacineDirectory,
  YacineEvent,
  YacineTeam,
} from "./yacine-api.server";

export const getCategories = createServerFn({ method: "GET" }).handler(async () => {
  const res = await req<{ data: Category[] }>("/api/categories");
  return res.data ?? [];
});

export const getCategoryChannels = createServerFn({ method: "GET" })
  .inputValidator(z.object({ categoryId: z.number().int().min(0).max(99_999_999) }))
  .handler(async ({ data }) => {
    const res = await req<{ data: Channel[] }>(`/api/categories/${data.categoryId}/channels`);
    return res.data ?? [];
  });

export const getSubCategories = createServerFn({ method: "GET" })
  .inputValidator(z.object({ categoryId: z.number().int().min(0).max(99_999_999) }))
  .handler(async ({ data }) => {
    const res = await req<{ data: Category[] }>(`/api/categories/${data.categoryId}`);
    return res.data ?? [];
  });

/** Quality labels only — used for the UI. URLs stay server-side. */
export const getChannelQualities = createServerFn({ method: "GET" })
  .inputValidator(z.object({ channelId: z.number().int().min(0).max(99_999_999) }))
  .handler(async ({ data }) => {
    const res = await req<{ data: Array<{ name: string }> }>(`/api/channel/${data.channelId}`);
    return (res.data ?? []).map((s) => s.name);
  });

export const getYacineEvents = createServerFn({ method: "GET" }).handler(async (): Promise<YacineEvent[]> => {
  const { fetchYacineEvents } = await import("./yacine-api.server");
  return fetchYacineEvents();
});

export const getYacineDirectory = createServerFn({ method: "GET" }).handler(async (): Promise<YacineDirectory> => {
  const { fetchYacineDirectory } = await import("./yacine-api.server");
  return fetchYacineDirectory();
});
