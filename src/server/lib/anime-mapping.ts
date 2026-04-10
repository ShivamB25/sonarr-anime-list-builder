import { cached } from "./cache";

const MAPPING_URL =
  "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";

type MappingEntry = {
  anilist_id?: number;
  tvdb_id?: number;
  themoviedb_id?: number;
  mal_id?: number;
};

let byAnilist: Map<number, MappingEntry> | null = null;
let byMal: Map<number, MappingEntry> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 hours

async function loadMappings(): Promise<{ byAnilist: Map<number, MappingEntry>; byMal: Map<number, MappingEntry> }> {
  if (byAnilist && byMal && Date.now() - cacheTimestamp < CACHE_TTL) {
    return { byAnilist, byMal };
  }

  const res = await fetch(MAPPING_URL);
  if (!res.ok) throw new Error(`Failed to fetch mapping: ${res.status}`);
  const data = (await res.json()) as MappingEntry[];

  byAnilist = new Map<number, MappingEntry>();
  byMal = new Map<number, MappingEntry>();

  for (const entry of data) {
    if (entry.anilist_id) byAnilist.set(entry.anilist_id, entry);
    if (entry.mal_id) byMal.set(entry.mal_id, entry);
  }

  cacheTimestamp = Date.now();
  return { byAnilist, byMal };
}

export async function getIdsFromAnilist(
  anilistId: number
): Promise<{ tvdbId: number | null; tmdbId: number | null; malId: number | null }> {
  return cached(`mapping:${anilistId}`, 21600, async () => {
    try {
      const { byAnilist } = await loadMappings();
      const entry = byAnilist.get(anilistId);
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
  const { byAnilist } = await loadMappings();
  const result = new Map<number, number>();
  for (const id of anilistIds) {
    const entry = byAnilist.get(id);
    if (entry?.tvdb_id) {
      result.set(id, entry.tvdb_id);
    }
  }
  return result;
}

export async function batchGetTvdbIdsFromMal(
  malIds: number[]
): Promise<Map<number, number>> {
  const { byMal } = await loadMappings();
  const result = new Map<number, number>();
  for (const id of malIds) {
    const entry = byMal.get(id);
    if (entry?.tvdb_id) {
      result.set(id, entry.tvdb_id);
    }
  }
  return result;
}
