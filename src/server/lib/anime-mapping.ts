const MAPPING_URL =
  "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";

type MappingEntry = {
  anilist_id?: number;
  tvdb_id?: number;
  themoviedb_id?: number;
  mal_id?: number;
};

let mappingCache: Map<number, MappingEntry> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 hours

async function loadMappings(): Promise<Map<number, MappingEntry>> {
  if (mappingCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return mappingCache;
  }

  const res = await fetch(MAPPING_URL);
  if (!res.ok) throw new Error(`Failed to fetch mapping: ${res.status}`);
  const data = (await res.json()) as MappingEntry[];

  const map = new Map<number, MappingEntry>();
  for (const entry of data) {
    if (entry.anilist_id) {
      map.set(entry.anilist_id, entry);
    }
  }

  mappingCache = map;
  cacheTimestamp = Date.now();
  return map;
}

export async function getIdsFromAnilist(
  anilistId: number
): Promise<{ tvdbId: number | null; tmdbId: number | null; malId: number | null }> {
  try {
    const map = await loadMappings();
    const entry = map.get(anilistId);
    return {
      tvdbId: entry?.tvdb_id ?? null,
      tmdbId: entry?.themoviedb_id ?? null,
      malId: entry?.mal_id ?? null,
    };
  } catch {
    return { tvdbId: null, tmdbId: null, malId: null };
  }
}
