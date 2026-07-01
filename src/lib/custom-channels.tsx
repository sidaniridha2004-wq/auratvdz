import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ChannelCategory } from "./channel-category";

export interface CustomSource {
  quality: string;
  url: string;
}

export interface CustomChannel {
  id: string;
  name: string;
  category: ChannelCategory;
  logo?: string;
  sources: CustomSource[];
}

const KEY = "auratv:custom_channels";

interface Ctx {
  channels: CustomChannel[];
  add: (c: Omit<CustomChannel, "id">) => void;
  remove: (id: string) => void;
  find: (id: string) => CustomChannel | undefined;
}
const CCtx = createContext<Ctx | null>(null);

export function CustomChannelsProvider({ children }: { children: ReactNode }) {
  const [channels, setChannels] = useState<CustomChannel[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setChannels(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = useCallback((next: CustomChannel[]) => {
    setChannels(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const add = useCallback(
    (c: Omit<CustomChannel, "id">) => {
      const id = `custom-${Date.now().toString(36)}`;
      persist([...channels, { ...c, id }]);
    },
    [channels, persist],
  );

  const remove = useCallback(
    (id: string) => persist(channels.filter((c) => c.id !== id)),
    [channels, persist],
  );

  const value = useMemo<Ctx>(
    () => ({ channels, add, remove, find: (id) => channels.find((c) => c.id === id) }),
    [channels, add, remove],
  );

  return <CCtx.Provider value={value}>{children}</CCtx.Provider>;
}

export function useCustomChannels(): Ctx {
  const c = useContext(CCtx);
  if (!c) return { channels: [], add: () => {}, remove: () => {}, find: () => undefined };
  return c;
}
