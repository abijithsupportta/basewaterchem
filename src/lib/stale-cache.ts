type CacheEnvelope<T> = {
  data: T;
  timestamp: number;
};

const memoryCache = new Map<string, CacheEnvelope<unknown>>();

function hasWindow() {
  return typeof window !== 'undefined';
}

function storageKey(key: string) {
  return `stale-cache:${key}`;
}

export function readStaleCache<T>(key: string, maxAgeMs: number): T | null {
  const now = Date.now();
  const memoryValue = memoryCache.get(key) as CacheEnvelope<T> | undefined;

  if (memoryValue && now - memoryValue.timestamp <= maxAgeMs) {
    return memoryValue.data;
  }

  if (!hasWindow()) {
    return null;
  }

  const raw = window.sessionStorage.getItem(storageKey(key));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed.timestamp !== 'number') {
      return null;
    }
    if (now - parsed.timestamp > maxAgeMs) {
      window.sessionStorage.removeItem(storageKey(key));
      return null;
    }
    memoryCache.set(key, parsed as CacheEnvelope<unknown>);
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeStaleCache<T>(key: string, data: T) {
  const envelope: CacheEnvelope<T> = {
    data,
    timestamp: Date.now(),
  };

  memoryCache.set(key, envelope as CacheEnvelope<unknown>);

  if (!hasWindow()) {
    return;
  }

  try {
    window.sessionStorage.setItem(storageKey(key), JSON.stringify(envelope));
  } catch {
  }
}

export function clearStaleCache(key: string) {
  memoryCache.delete(key);
  if (!hasWindow()) {
    return;
  }
  window.sessionStorage.removeItem(storageKey(key));
}
