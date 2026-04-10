import { cached } from "./cache";

const MAPPING_URL =
  "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";

type MappingEntry = {
  anilist_id?: number;
  tvdb_id?: number;
  themoviedb_id?: number;
  mal_id?: number;
};

async function fetchMappings(): Promise<Map<number, MappingEntry>> {
  const res = await fetch(MAPPING_URL);
  if (!res.ok) throw new Error(`Failed to fetch mapping: ${res.status}`);
  const data = (await res.json()) as MappingEntry[];

  const map = new Map<number, MappingEntry>();
  for (const entry of data) {
    if (entry.anilist_id) {
      map.set(entry.anilist_id, entry);
    }
  }
  return map;
}

// Cache the full mapping at the edge for 6 hours, keyed as a single blob
async function getMappings(): Promise<Map<number, MappingEntry>> {
  // We can't store a Map in the Cache API directly, so we cache per-ID lookups instead
  // But for bulk operations (Sonarr feed), we still need the full map.
  // Use a two-tier approach: in-memory for the current request, edge for cross-request.

  const cache = await caches.open("airing-list-cache");
  const cacheKey = new Request("https://cache.internal/fribb-mapping");

  const hit = await cache.match(cacheKey);
  if (hit) {
    const entries = (await hit.json()) as [number, MappingEntry][];
    return new Map(entries);
  }

  const map = await fetchMappings();

  // Store as array of tuples (Map isn't JSON-serializable)
  const serializable = Array.from(map.entries());
  const response = new Response(JSON.stringify(serializable), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=21600",
    },
  });
  await cache.put(cacheKey, response);

  return map;
}

export async function getIdsFromAnilist(
  anilistId: number
): Promise<{ tvdbId: number | null; tmdbId: number | null; malId: number | null }> {
  // For single lookups, use a per-ID edge cache to avoid loading the full 9MB blob
  return cached(`mapping:${anilistId}`, 21600, async () => {
    try {
      const map = await getMappings();
      const entry = map.get(anilistId);
      return {
        tvdbId: entry?.tvdb_id ?? null,
        tmdbId: entry?.themoviedb_id ?? null,
        malId: entry?.mal_id ?? null,
      };
    } catch {
      return { tvdbId: null, tmdbId: null, malId: null };
    }
  });
}

export async function batchGetTvdbIds(
  anilistIds: number[]
): Promise<Map<number, number>> {
  const map = await getMappings();
  const result = new Map<number, number>();
  for (const id of anilistIds) {
    const entry = map.get(id);
    if (entry?.tvdb_id) {
      result.set(id, entry.tvdb_id);
    }
  }
  return result;
}
