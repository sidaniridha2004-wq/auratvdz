// Upstream host and decrypt key can be rotated from the environment without
// touching the code. Both fall back to the values the Android app ships with.
// Read per request: on edge runtimes env is only bound while handling a request.
const baseUrl = () => (process.env.YACINE_API_URL || "https://def.yacinelive.com").replace(/\/+$/, "");
const keyBase = () => process.env.YACINE_DECRYPT_KEY || "c!xZj+N9&G@Ev@vw";

export type YacineTeam = { id: number; name: string; logo: string };
export type YacineEvent = {
  id: number;
  competition: string;
  channel: string;
  commentary: string;
  startTime: number;
  endTime: number;
  home: YacineTeam;
  away: YacineTeam;
};
export type YacineCategory = {
  id: number;
  name: string;
  logo: string;
  childCount: number;
  parentId?: number;
};
export type YacineChannel = {
  id: number;
  name: string;
  logo: string;
  categoryId: number;
  categoryName: string;
};
export type YacineDirectory = {
  categories: YacineCategory[];
  channels: YacineChannel[];
  updatedAt: string;
  warnings: string[];
};

type Json = Record<string, unknown>;
type CacheEntry<T> = { expiresAt: number; value: T };
const cache = new Map<string, CacheEntry<unknown>>();

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const url = (value: unknown) => {
  const candidate = text(value);
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
};

function decode<T>(encoded: string, timestamp: string): T {
  const input = Buffer.from(encoded.trim(), "base64");
  const key = Buffer.from(`${keyBase()}${timestamp}`, "utf8");
  const output = Buffer.allocUnsafe(input.length);
  for (let i = 0; i < input.length; i += 1) {
    output[i] = input[i] ^ key[i % key.length];
  }
  return JSON.parse(output.toString("utf8")) as T;
}

function rows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const data = (payload as { data?: unknown } | null)?.data;
  return Array.isArray(data) ? (data as T[]) : [];
}

async function request(path: string): Promise<unknown> {
  if (!/^\/api\/[a-z0-9/_-]*$/i.test(path)) throw new Error("Invalid API path");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      headers: {
        Accept: "text/plain, application/json;q=0.9, */*;q=0.8",
        "User-Agent": "AuraTV/1.0 (+https://auratvdz.lovable.app)",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Yacine API returned ${response.status}`);
    const timestamp =
      response.headers.get("t") ?? String(Math.floor(Date.now() / 1000));
    return decode(await response.text(), timestamp);
  } finally {
    clearTimeout(timeout);
  }
}

async function cached<T>(key: string, ttl: number, load: () => Promise<T>) {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await load();
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  return value;
}

const team = (value: unknown): YacineTeam => {
  const item = (value ?? {}) as Json;
  return {
    id: number(item.id),
    name: text(item.name) || "Unknown team",
    logo: url(item.logo),
  };
};

export async function fetchYacineEvents(): Promise<YacineEvent[]> {
  return cached("events", 60_000, async () =>
    rows<Json>(await request("/api/events"))
      .map((item) => ({
        id: number(item.id),
        competition: text(item.champions) || "Live sports",
        channel: text(item.channel),
        commentary: text(item.commentary),
        startTime: number(item.start_time),
        endTime: number(item.end_time),
        home: team(item.team_1),
        away: team(item.team_2),
      }))
      .filter((event) => event.id > 0 && event.startTime > 0)
      .sort((a, b) => a.startTime - b.startTime),
  );
}

const category = (item: Json, parentId?: number): YacineCategory => ({
  id: number(item.id),
  name: text(item.name) || "Other",
  logo: url(item.logo) || url(item.image),
  childCount: number(item.child_count),
  parentId,
});

export async function fetchYacineDirectory(): Promise<YacineDirectory> {
  return cached("directory", 10 * 60_000, async () => {
    const queue = rows<Json>(await request("/api/categories")).map((item) =>
      category(item),
    );
    const categories: YacineCategory[] = [];
    const channels: YacineChannel[] = [];
    const warnings: string[] = [];
    const visited = new Set<number>();

    while (queue.length && visited.size < 250) {
      const current = queue.shift();
      if (!current || current.id <= 0 || visited.has(current.id)) continue;
      visited.add(current.id);
      categories.push(current);

      if (current.childCount > 0) {
        try {
          queue.push(
            ...rows<Json>(await request(`/api/categories/${current.id}`)).map(
              (item) => category(item, current.id),
            ),
          );
        } catch (error) {
          warnings.push(`${current.name}: ${error instanceof Error && error.name === "AbortError" ? "timed out" : "unavailable"}`);
        }
      }

      try {
        channels.push(
          ...rows<Json>(
            await request(`/api/categories/${current.id}/channels`),
          ).map((item) => ({
            id: number(item.id),
            name: text(item.name) || "Unnamed channel",
            logo: url(item.image) || url(item.logo),
            categoryId: current.id,
            categoryName: current.name,
          })),
        );
      } catch (error) {
        warnings.push(`${current.name}: ${error instanceof Error && error.name === "AbortError" ? "timed out" : "unavailable"}`);
      }
    }

    return {
      categories,
      channels: channels.filter((item) => item.id > 0),
      warnings,
      updatedAt: new Date().toISOString(),
    };
  });
}

export type YacineStream = {
  name: string;
  url: string;
  referer: string;
  userAgent: string;
};

/**
 * Playable variants for one channel. Cached briefly: the upstream rotates
 * tokens in these URLs, so a long cache would hand out dead links.
 */
export async function fetchYacineChannelStreams(channelId: number): Promise<YacineStream[]> {
  if (!Number.isInteger(channelId) || channelId <= 0 || channelId > 99_999_999) return [];
  return cached(`channel:${channelId}`, 20_000, async () =>
    rows<Json>(await request(`/api/channel/${channelId}`))
      .map((item) => ({
        name: text(item.name).slice(0, 40),
        url: url(item.url),
        referer: url(item.referer),
        userAgent: text(item.user_agent).slice(0, 256),
      }))
      .filter((stream) => stream.url !== ""),
  );
}
