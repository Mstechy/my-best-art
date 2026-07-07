import { useEffect, useState, useCallback } from "react";

const KEY = "recently_viewed_products";
const MAX = 12;

function read(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function useRecentlyViewed() {
  const [ids, setIds] = useState<string[]>(read);

  const add = useCallback((id: string) => {
    setIds(prev => {
      const next = [id, ...prev.filter(p => p !== id)].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(KEY);
    setIds([]);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setIds(read()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { ids, add, clear };
}
