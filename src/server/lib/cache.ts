// In-memory cache for Cloudflare Workers (persists within isolate lifetime)
const memCache = new Map<string, { data: unknown; expires: number }>();

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = memCache.get(key);
  if (hit && hit.expires > now) {
    return hit.data as T;
  }

  // Try Cloudflare Cache API as second layer
  const cacheUrl = `https://airing-list-cache.internal/${encodeURIComponent(key)}`;
  const cacheKey = new Request(cacheUrl);

  try {
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) {
      const data = (await cached.json()) as T;
      memCache.set(key, { data, expires: now + ttlSeconds * 1000 });
      return data;
    }
  } catch {
    // Cache API not available, fall through
  }

  const data = await fetcher();

  // Store in memory
  memCache.set(key, { data, expires: now + ttlSeconds * 1000 });

  // Store in edge cache
  try {
    const cache = caches.default;
    const response = new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${ttlSeconds}`,
      },
    });
    await cache.put(cacheKey, response);
  } catch {
    // Cache API not available, memory cache still works
  }

  return data;
}

export async function cachedWithStale<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = memCache.get(key);
  if (hit && hit.expires > now) {
    return hit.data as T;
  }

  const cacheUrl = `https://airing-list-cache.internal/${encodeURIComponent(key)}`;
  const cacheKey = new Request(cacheUrl);
  let staleData: T | null = null;

  try {
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) {
      staleData = (await cached.json()) as T;
      if (!hit) {
        memCache.set(key, { data: staleData, expires: now + ttlSeconds * 1000 });
      }
    }
  } catch {
    // ignore cache read failure
  }

  try {
    const fresh = await fetcher();
    memCache.set(key, { data: fresh, expires: now + ttlSeconds * 1000 });

    try {
      const cache = caches.default;
      const response = new Response(JSON.stringify(fresh), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${ttlSeconds}`,
        },
      });
      await cache.put(cacheKey, response);
    } catch {
      // ignore cache write failure
    }

    return fresh;
  } catch (error) {
    if (staleData !== null) return staleData;
    if (hit) return hit.data as T;
    throw error;
  }
}
