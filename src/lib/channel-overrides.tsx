// Shared admin-edit overrides + hidden list. Uses localStorage as the source
// of truth (Lovable Cloud isn't enabled yet). Both the admin panel and the
// homepage read through this, and admin dispatches "auratv:overrides"
// whenever anything changes so the homepage re-renders instantly — no page
// refresh needed.
import { useEffect, useMemo, useState } from "react";
import { M3U_CHANNELS, type M3uChannel } from "./m3u-channels";

export const HIDDEN_KEY = "auratv:admin:hidden";
export const OVERRIDES_KEY = "auratv:admin:overrides";
export const OVERRIDES_EVENT = "auratv:overrides";

export interface Override {
  name?: string;
  category?: string;
  logo?: string;
  url?: string;
}
export type OverrideMap = Record<string, Override>;

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeOverrides(next: OverrideMap) {
  try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next)); } catch {}
  window.dispatchEvent(new Event(OVERRIDES_EVENT));
}
export function writeHidden(next: string[]) {
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch {}
  window.dispatchEvent(new Event(OVERRIDES_EVENT));
}

/** Live overrides + hidden IDs, refreshed on admin edits and cross-tab writes. */
export function useChannelOverrides() {
  const [overrides, setOverrides] = useState<OverrideMap>(() => readJSON(OVERRIDES_KEY, {}));
  const [hidden, setHidden] = useState<string[]>(() => readJSON<string[]>(HIDDEN_KEY, []));

  useEffect(() => {
    const refresh = () => {
      setOverrides(readJSON<OverrideMap>(OVERRIDES_KEY, {}));
      setHidden(readJSON<string[]>(HIDDEN_KEY, []));
    };
    refresh();
    window.addEventListener(OVERRIDES_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(OVERRIDES_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return { overrides, hidden };
}

/** M3U catalogue with admin overrides applied and hidden channels removed. */
export function useResolvedChannels(): M3uChannel[] {
  const { overrides, hidden } = useChannelOverrides();
  return useMemo(() => {
    const hide = new Set(hidden);
    return M3U_CHANNELS
      .filter((c) => !hide.has(c.slug))
      .map((c) => {
        const o = overrides[c.slug];
        if (!o) return c;
        return {
          ...c,
          name: o.name ?? c.name,
          group: o.category ?? c.group,
          logo: o.logo ?? c.logo,
          url: o.url ?? c.url,
        };
      });
  }, [overrides, hidden]);
}
