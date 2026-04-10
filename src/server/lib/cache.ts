const CACHE_NAME = "airing-list-cache";

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cache = await caches.open(CACHE_NAME);
  const cacheKey = new Request(`https://cache.internal/${key}`);

  const hit = await cache.match(cacheKey);
  if (hit) {
    return hit.json() as Promise<T>;
  }

  const data = await fetcher();

  const response = new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${ttlSeconds}`,
    },
  });

  await cache.put(cacheKey, response);
  return data;
}
