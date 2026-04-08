/**
 * FBI Embajadores — Caché persistente (localStorage) + patrón SWR.
 * - `get`: solo datos aún “frescos” según TTL (miss si expiró).
 * - `peekStale`: último dato guardado + si pasó el TTL (UI instantánea + revalidar en red).
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const defaultTtlMs = 1000 * 60 * 60;

function readEntry<T>(key: string): CacheEntry<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(`fbi_cache_${key}`);
    if (!stored) return null;
    return JSON.parse(stored) as CacheEntry<T>;
  } catch (err) {
    console.warn("Error reading cache:", err);
    return null;
  }
}

export const cache = {
  /**
   * Datos válidos no expirados; si expiró el TTL, devuelve null (forzar refresco).
   */
  get: <T>(key: string, ttlMs: number = defaultTtlMs): T | null => {
    const entry = readEntry<T>(key);
    if (!entry) return null;
    const expired = Date.now() - entry.timestamp > ttlMs;
    if (expired) return null;
    return entry.data;
  },

  /**
   * Último valor guardado aunque haya expirado el TTL (stale-while-revalidate).
   */
  peekStale: <T>(key: string, ttlMs: number = defaultTtlMs): { data: T | null; isExpired: boolean } => {
    const entry = readEntry<T>(key);
    if (!entry) return { data: null, isExpired: true };
    const isExpired = Date.now() - entry.timestamp > ttlMs;
    return { data: entry.data, isExpired };
  },

  set: <T>(key: string, data: T): void => {
    if (typeof window === "undefined") return;
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem(`fbi_cache_${key}`, JSON.stringify(entry));
    } catch (err) {
      console.warn("Error writing cache:", err);
    }
  },

  remove: (key: string): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(`fbi_cache_${key}`);
  },
};
