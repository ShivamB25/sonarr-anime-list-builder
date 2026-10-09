import { cached } from "./cache";
const MAPPING_URL =
  "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";
const TVDB_API_URL = "https://api4.thetvdb.com/v4";
const CACHE_TTL = 1000 * 60 * 60 * 6;
const TVDB_TOKEN_TTL = 1000 * 60 * 60 * 24 * 29;


export interface TvdbLookupCandidate {
  id: number;
  title: string;
  year?: number;
  alternateTitles?: string[];
}

type MappingEntry = {
  anilist_id?: number;
  tvdb_id?: number;
  mal_id?: number;
};

type MappingIndexes = {
  byAnilist: Map<number, MappingEntry>;
  byMal: Map<number, MappingEntry>;
  anilistByMal: Map<number, number>;
};


interface TvdbLoginResponse {
  data?: { token?: string };
}

interface TvdbSearchResult {
  objectID?: string;
  aliases?: string[];
  name?: string;
}

interface TvdbSearchResponse {
  data?: TvdbSearchResult[];
}

let byAnilist: Map<number, MappingEntry> | null = null;
let byMal: Map<number, MappingEntry> | null = null;
let anilistByMal: Map<number, number> | null = null;
let cacheTimestamp = 0;
let tvdbToken: string | null = null;
let tvdbTokenTimestamp = 0;
let mappingRequest: Promise<MappingIndexes> | null = null;
let tvdbTokenApiKey: string | null = null;
const tvdbTokenRequests = new Map<string, Promise<string>>();

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isMappingEntry(value: unknown): value is MappingEntry {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildMappingIndex(
  entries: MappingEntry[],
  key: "anilist_id" | "mal_id"
): Map<number, MappingEntry> {
  const index = new Map<number, MappingEntry>();
  const conflictingIds = new Set<number>();

  for (const entry of entries) {
    const id = entry[key];
    const tvdbId = entry.tvdb_id;
    if (
      !isPositiveSafeInteger(id) ||
      !isPositiveSafeInteger(tvdbId) ||
      conflictingIds.has(id)
    ) {
      continue;
    }

    const existing = index.get(id);
    if (!existing) {
      index.set(id, { [key]: id, tvdb_id: tvdbId });
    } else if (existing.tvdb_id !== tvdbId) {
      index.delete(id);
      conflictingIds.add(id);
    }
  }

  return index;
}

function buildAniListByMalIndex(entries: readonly MappingEntry[]): Map<number, number> {
  const index = new Map<number, number>();
  const conflicts = new Set<number>();
  for (const entry of entries) {
    const malId = entry.mal_id;
    const anilistId = entry.anilist_id;
    if (!isPositiveSafeInteger(malId) || !isPositiveSafeInteger(anilistId) || conflicts.has(malId)) continue;
    const existing = index.get(malId);
    if (existing !== undefined && existing !== anilistId) {
      index.delete(malId);
      conflicts.add(malId);
    } else {
      index.set(malId, anilistId);
    }
  }
  return index;
}

async function loadMappings(): Promise<MappingIndexes> {
  if (byAnilist && byMal && anilistByMal && Date.now() - cacheTimestamp < CACHE_TTL) {
    return { byAnilist, byMal, anilistByMal };
  }

  if (!mappingRequest) {
    mappingRequest = (async () => {
      const res = await fetch(MAPPING_URL);
      if (!res.ok) throw new Error(`Failed to fetch mapping: ${res.status}`);
      const payload: unknown = await res.json();
      if (!Array.isArray(payload)) {
        throw new Error("Invalid mapping response: expected an array");
      }
      const entries = (payload as unknown[]).filter(isMappingEntry);
      const nextByAnilist = buildMappingIndex(entries, "anilist_id");
      const nextByMal = buildMappingIndex(entries, "mal_id");
      const nextAnilistByMal = buildAniListByMalIndex(entries);

      byAnilist = nextByAnilist;
      byMal = nextByMal;
      anilistByMal = nextAnilistByMal;
      cacheTimestamp = Date.now();
      return { byAnilist, byMal, anilistByMal };
    })().finally(() => {
      mappingRequest = null;
    });
  }
  return mappingRequest;
}

async function getTvdbToken(apiKey: string): Promise<string> {
  if (
    tvdbToken &&
    tvdbTokenApiKey === apiKey &&
    Date.now() - tvdbTokenTimestamp < TVDB_TOKEN_TTL
  ) {
    return tvdbToken;
  }
  const pendingRequest = tvdbTokenRequests.get(apiKey);
  if (pendingRequest) return pendingRequest;

  const request = (async () => {
    const response = await fetch(`${TVDB_API_URL}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apikey: apiKey }),
    });
    if (!response.ok) throw new Error(`TVDB login failed: ${response.status}`);

    const data = (await response.json()) as TvdbLoginResponse;
    if (!data.data?.token) throw new Error("TVDB login returned no token");
    tvdbToken = data.data.token;
    tvdbTokenApiKey = apiKey;
    tvdbTokenTimestamp = Date.now();
    return tvdbToken;
  })();
  tvdbTokenRequests.set(apiKey, request);
  try {
    return await request;
  } finally {
    if (tvdbTokenRequests.get(apiKey) === request) {
      tvdbTokenRequests.delete(apiKey);
    }
  }
}

const SEASON_SUFFIX =
  /(?:\s+|[-:]\s*)(?:\d+(?:st|nd|rd|th)?\s+season|season\s+\d+|s\s*\d+)\s*$/i;

function normalizeTitle(title: string): string {
  return title
    .replace(SEASON_SUFFIX, "")
    .normalize("NFKD")
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
}

async function findTvdbSeriesId(
  candidate: TvdbLookupCandidate,
  apiKey: string
): Promise<number | null> {
  const titles = [candidate.title, ...(candidate.alternateTitles ?? [])].filter(
    (title): title is string => typeof title === "string"
  );
  const expectedTitles = new Set(
    titles.map(normalizeTitle).filter((title) => title.length > 0)
  );
  if (expectedTitles.size === 0) return null;

  const searchQueries = new Map<
    string,
    { query: string; seasonQualified: boolean }
  >();
  for (const title of titles) {
    const query = title.replace(SEASON_SUFFIX, "").trim();
    const normalizedQuery = normalizeTitle(query);
    if (!normalizedQuery) continue;

    const seasonQualified = SEASON_SUFFIX.test(title);
    const key = `${normalizedQuery}:${seasonQualified}`;
    if (!searchQueries.has(key)) {
      searchQueries.set(key, { query, seasonQualified });
    }
  }
  if (searchQueries.size === 0) return null;

  for (const { query, seasonQualified } of searchQueries.values()) {
    const url = new URL(`${TVDB_API_URL}/search`);
    url.searchParams.set("query", query);
    url.searchParams.set("type", "series");
    // Numbered anime seasons can belong to a TVDB series that premiered years earlier.
    if (!seasonQualified && isPositiveSafeInteger(candidate.year)) {
      url.searchParams.set("year", String(candidate.year));
    }

    // Cache public search metadata, never API keys or bearer tokens.
    const data = await cached<TvdbSearchResponse>(
      `tvdb:search:${url}`,
      CACHE_TTL / 1000,
      async () => {
        const token = await getTvdbToken(apiKey);
        const response = await fetch(url, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`TVDB search failed: ${response.status}`);
        return await response.json() as TvdbSearchResponse;
      }
    );
    const matchingIds = new Set<number>();
    for (const result of data.data ?? []) {
      const isExactMatch = [result.name, ...(result.aliases ?? [])].some(
        (title) =>
          typeof title === "string" && expectedTitles.has(normalizeTitle(title))
      );
      if (!isExactMatch) continue;

      const match = /^series-(\d+)$/.exec(result.objectID ?? "");
      const tvdbId = match ? Number(match[1]) : null;
      if (!isPositiveSafeInteger(tvdbId)) return null;
      matchingIds.add(tvdbId);
      if (matchingIds.size > 1) return null;
    }

    if (matchingIds.size === 1) return matchingIds.values().next().value ?? null;
  }

  return null;
}

async function resolveMissingTvdbIds(
  result: Map<number, number>,
  candidates: TvdbLookupCandidate[],
  apiKey?: string
): Promise<void> {
  if (!apiKey) return;
  for (const candidate of candidates) {
    if (!isPositiveSafeInteger(candidate.id) || result.has(candidate.id)) continue;
    const tvdbId = await findTvdbSeriesId(candidate, apiKey);
    if (isPositiveSafeInteger(tvdbId)) result.set(candidate.id, tvdbId);
  }
}

async function batchGetTvdbIdsFromMappings(
  ids: number[],
  index: "byAnilist" | "byMal",
  candidates: TvdbLookupCandidate[],
  tvdbApiKey?: string
): Promise<Map<number, number>> {
  if (ids.length === 0 && candidates.length === 0) return new Map();

  const mappings = await loadMappings();
  const result = new Map<number, number>();
  for (const id of ids) {
    if (!isPositiveSafeInteger(id)) continue;
    const entry = mappings[index].get(id);
    if (isPositiveSafeInteger(entry?.tvdb_id)) result.set(id, entry.tvdb_id);
  }


  await resolveMissingTvdbIds(result, candidates, tvdbApiKey);
  return result;
}

export async function batchGetTvdbIds(
  anilistIds: number[],
  candidates: TvdbLookupCandidate[] = [],
  tvdbApiKey?: string
): Promise<Map<number, number>> {
  return batchGetTvdbIdsFromMappings(anilistIds, "byAnilist", candidates, tvdbApiKey);
}

export async function batchGetTvdbIdsFromMal(
  malIds: number[],
  candidates: TvdbLookupCandidate[] = [],
  tvdbApiKey?: string
): Promise<Map<number, number>> {
  return batchGetTvdbIdsFromMappings(malIds, "byMal", candidates, tvdbApiKey);
}

export async function getAniListIdsFromMal(malIds: readonly number[]): Promise<Map<number, number>> {
  const mappings = await loadMappings();
  const result = new Map<number, number>();
  for (const malId of malIds) {
    const anilistId = mappings.anilistByMal.get(malId);
    if (anilistId !== undefined) result.set(malId, anilistId);
  }
  return result;
}
