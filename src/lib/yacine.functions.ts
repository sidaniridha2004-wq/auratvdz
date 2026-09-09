import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertSafeUrl } from "./ssrf-guard";
import { getYacineConfig } from "./yacine-config.server";
import type { YacineDirectory, YacineEvent } from "./yacine-api.server";

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
    const t0 = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const r = await fetch(url, { signal: controller.signal });
      const timestamp = r.headers.get("t") ?? String(Math.floor(Date.now() / 1000));
      const body = await r.text();
      if (!r.ok) throw new Error(`yacine ${r.status} (${body.length}B)`);
      const parsed = JSON.parse(decrypt(body, decryptKey + timestamp)) as T;
      console.log(`[yacine] ok ${path} ${r.status} ${Date.now() - t0}ms try=${n}`);
      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[yacine] fail ${path} ${Date.now() - t0}ms try=${n} ${message}`);
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

export interface StreamLink {
  name: string;
  url: string;
  url_type: number;
  user_agent: string;
  referer: string;
  headers: Record<string, string>;
  drm: unknown;
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
  .inputValidator(z.object({ categoryId: z.number().int() }))
  .handler(async ({ data }) => {
    const res = await req<{ data: Channel[] }>(`/api/categories/${data.categoryId}/channels`);
    return res.data ?? [];
  });

export const getSubCategories = createServerFn({ method: "GET" })
  .inputValidator(z.object({ categoryId: z.number().int() }))
  .handler(async ({ data }) => {
    const res = await req<{ data: Category[] }>(`/api/categories/${data.categoryId}`);
    return res.data ?? [];
  });

export const getChannel = createServerFn({ method: "GET" })
  .inputValidator(z.object({ channelId: z.number().int() }))
  .handler(async ({ data }) => {
    const res = await req<{ data: StreamLink[] }>(`/api/channel/${data.channelId}`);
    return (res.data ?? []).map((stream) => ({
      name: stream.name,
      url: stream.url,
      referer: stream.referer ?? "",
      user_agent: stream.user_agent ?? "",
    }));
  });

export const probeStream = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      url: z.string().url(),
      referer: z.string().optional().default(""),
      userAgent: z.string().optional().default(""),
    }),
  )
  .handler(async ({ data }) => {
    const headers: Record<string, string> = {};
    if (data.referer) headers.referer = data.referer;
    if (data.userAgent) headers["user-agent"] = data.userAgent;
    let current: URL;
    try {
      current = assertSafeUrl(data.url);
    } catch {
      return { ok: false, status: 0 };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      let response: Response | null = null;
      for (let hop = 0; hop < 5; hop++) {
        response = await fetch(current.toString(), {
          headers,
          signal: controller.signal,
          redirect: "manual",
        });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get("location");
        if (!location) break;
        try {
          current = assertSafeUrl(new URL(location, current).toString());
        } catch {
          return { ok: false, status: 0 };
        }
      }
      if (!response?.ok) return { ok: false, status: response?.status ?? 0 };
      const body = (await response.text()).slice(0, 200);
      return { ok: body.includes("#EXTM3U"), status: response.status };
    } catch {
      return { ok: false, status: 0 };
    } finally {
      clearTimeout(timer);
    }
  });

export const getYacineEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<YacineEvent[]> => {
    const { fetchYacineEvents } = await import("./yacine-api.server");
    return fetchYacineEvents();
  },
);

export const getYacineDirectory = createServerFn({ method: "GET" }).handler(
  async (): Promise<YacineDirectory> => {
    const { fetchYacineDirectory } = await import("./yacine-api.server");
    return fetchYacineDirectory();
  },
);
