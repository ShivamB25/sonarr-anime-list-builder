
const MAPPING_URL =
  "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";
const TVDB_API_URL = "https://api4.thetvdb.com/v4";
const CACHE_TTL = 1000 * 60 * 60 * 6;
const TVDB_TOKEN_TTL = 1000 * 60 * 60 * 24 * 29;


export interface TvdbLookupCandidate {
  id: number;
  title: string;
  year: number;
}

type MappingEntry = {
  anilist_id?: number;
  tvdb_id?: number;
  mal_id?: number;
};

type MappingIndexes = {
  byAnilist: Map<number, MappingEntry>;
  byMal: Map<number, MappingEntry>;
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
let cacheTimestamp = 0;
let tvdbToken: string | null = null;
let tvdbTokenTimestamp = 0;
let mappingRequest: Promise<MappingIndexes> | null = null;
let tvdbTokenApiKey: string | null = null;
const tvdbTokenRequests = new Map<string, Promise<string>>();

async function loadMappings(): Promise<MappingIndexes> {
  if (byAnilist && byMal && Date.now() - cacheTimestamp < CACHE_TTL) {
    return { byAnilist, byMal };
  }

  if (!mappingRequest) {
    mappingRequest = (async () => {
      const res = await fetch(MAPPING_URL);
      if (!res.ok) throw new Error(`Failed to fetch mapping: ${res.status}`);
      const data = (await res.json()) as MappingEntry[];
      const nextByAnilist = new Map<number, MappingEntry>();
      const nextByMal = new Map<number, MappingEntry>();

      for (const entry of data) {
        if (entry.anilist_id) nextByAnilist.set(entry.anilist_id, entry);
        if (entry.mal_id) nextByMal.set(entry.mal_id, entry);
      }

      byAnilist = nextByAnilist;
      byMal = nextByMal;
      cacheTimestamp = Date.now();
      return { byAnilist, byMal };
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

const SEASON_SUFFIX = /\s+(?:\d+(?:st|nd|rd|th)\s+season|season\s+\d+|s\d+)\s*$/i;

function normalizeTitle(title: string): string {
  return title
    .replace(SEASON_SUFFIX, "")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

async function findTvdbSeriesId(
  candidate: TvdbLookupCandidate,
  apiKey: string
): Promise<number | null> {
  const token = await getTvdbToken(apiKey);
  const seriesTitle = candidate.title.replace(SEASON_SUFFIX, "");
  const baseTitle = seriesTitle.split(":", 1)[0]?.trim() || seriesTitle;
  const url = new URL(`${TVDB_API_URL}/search`);
  url.searchParams.set("query", baseTitle);
  url.searchParams.set("type", "series");
  // Numbered anime seasons can belong to a TVDB series that premiered years earlier.
  if (seriesTitle === candidate.title) url.searchParams.set("year", String(candidate.year));

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`TVDB search failed: ${response.status}`);

  const data = (await response.json()) as TvdbSearchResponse;
  const expectedTitle = normalizeTitle(candidate.title);
  const matches = (data.data ?? []).filter((result) =>
    [result.name, ...(result.aliases ?? [])].some(
      (title) => title && normalizeTitle(title) === expectedTitle
    )
  );
  if (matches.length !== 1) return null;

  const match = /^series-(\d+)$/.exec(matches[0]?.objectID ?? "");
  return match ? Number(match[1]) : null;
}

async function resolveMissingTvdbIds(
  result: Map<number, number>,
  candidates: TvdbLookupCandidate[],
  apiKey?: string
): Promise<void> {
  if (!apiKey) return;
  for (const candidate of candidates) {
    if (result.has(candidate.id)) continue;
    const tvdbId = await findTvdbSeriesId(candidate, apiKey);
    if (tvdbId) result.set(candidate.id, tvdbId);
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
    const entry = mappings[index].get(id);
    if (entry?.tvdb_id) result.set(id, entry.tvdb_id);
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
