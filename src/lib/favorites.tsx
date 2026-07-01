import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const KEY = "auratv:favorites";

interface Ctx {
  favorites: string[];
  isFav: (slug: string) => boolean;
  toggle: (slug: string) => void;
  count: number;
}
const FavCtx = createContext<Ctx | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setFavorites(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = useCallback((next: string[]) => {
    setFavorites(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const toggle = useCallback(
    (slug: string) => {
      persist(favorites.includes(slug) ? favorites.filter((s) => s !== slug) : [...favorites, slug]);
    },
    [favorites, persist],
  );

  const value = useMemo<Ctx>(
    () => ({
      favorites,
      isFav: (s: string) => favorites.includes(s),
      toggle,
      count: favorites.length,
    }),
    [favorites, toggle],
  );

  return <FavCtx.Provider value={value}>{children}</FavCtx.Provider>;
}

export function useFavorites(): Ctx {
  const c = useContext(FavCtx);
  if (!c) return { favorites: [], isFav: () => false, toggle: () => {}, count: 0 };
  return c;
}
