const ANILIST_URL = "https://graphql.anilist.co";

const SEASONAL_QUERY = `
query ($season: MediaSeason, $seasonYear: Int, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage currentPage lastPage total }
    media(
      type: ANIME
      season: $season
      seasonYear: $seasonYear
      sort: [POPULARITY_DESC]
      isAdult: false
    ) {
      id
      title { romaji english native }
      coverImage { large medium }
      bannerImage
      format
      status
      episodes
      averageScore
      genres
      season
      seasonYear
      description(asHtml: false)
      nextAiringEpisode { airingAt episode timeUntilAiring }
      startDate { year month day }
      studios(isMain: true) { nodes { name } }
    }
  }
}`;

const SEARCH_QUERY = `
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage currentPage lastPage total }
    media(
      type: ANIME
      search: $search
      sort: [SEARCH_MATCH]
      isAdult: false
    ) {
      id
      title { romaji english native }
      coverImage { large medium }
      format
      status
      episodes
      averageScore
      genres
      season
      seasonYear
      nextAiringEpisode { airingAt episode timeUntilAiring }
      studios(isMain: true) { nodes { name } }
    }
  }
}`;

export type AniListMedia = {
  id: number;
  title: { romaji: string; english: string | null; native: string | null };
  coverImage: { large: string; medium: string };
  bannerImage: string | null;
  format: string;
  status: string;
  episodes: number | null;
  averageScore: number | null;
  genres: string[];
  season: string;
  seasonYear: number;
  description: string | null;
  nextAiringEpisode: {
    airingAt: number;
    episode: number;
    timeUntilAiring: number;
  } | null;
  startDate: { year: number; month: number; day: number };
  studios: { nodes: { name: string }[] };
};

async function gqlRequest(query: string, variables: Record<string, unknown>) {
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "0");
      const delay = Math.max(retryAfter * 1000, 1000 * (attempt + 1));
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    if (!res.ok) throw new Error(`AniList API error: ${res.status}`);
    const json = (await res.json()) as { data: { Page: { pageInfo: { hasNextPage: boolean; currentPage: number; lastPage: number; total: number }; media: AniListMedia[] } } };
    return json.data.Page;
  }
  throw new Error("AniList API: max retries exceeded");
}

import { cached } from "./cache";

export async function getSeasonalAnime(
  season: string,
  year: number,
  page = 1,
  perPage = 25
) {
  const key = `anilist:seasonal:${season}:${year}:${page}:${perPage}`;
  return cached(key, 3600, () =>
    gqlRequest(SEASONAL_QUERY, {
      season: season.toUpperCase(),
      seasonYear: year,
      page,
      perPage,
    })
  );
}

export async function getAllSeasonalAnime(
  season: string,
  year: number
): Promise<AniListMedia[]> {
  const key = `anilist:seasonal-all:${season}:${year}`;
  return cached(key, 3600, async () => {
    const perPage = 50;
    const maxPages = 5; // safety cap ~250 anime max
    let page = 1;
    const allMedia: AniListMedia[] = [];

    while (page <= maxPages) {
      const data = await gqlRequest(SEASONAL_QUERY, {
        season: season.toUpperCase(),
        seasonYear: year,
        page,
        perPage,
      });
      allMedia.push(...data.media);
      if (!data.pageInfo.hasNextPage || data.media.length === 0) break;
      page++;
    }

    return allMedia;
  });
}

export async function searchAnime(search: string, page = 1, perPage = 10) {
  const key = `anilist:search:${encodeURIComponent(search)}:${page}:${perPage}`;
  return cached(key, 1800, () =>
    gqlRequest(SEARCH_QUERY, { search, page, perPage })
  );
}

// Direct paginated fetch for the sync engine (no caching — cron handles freshness via D1)
export async function gqlRequestPage(
  season: string,
  year: number,
  page: number,
  perPage: number
) {
  return gqlRequest(SEASONAL_QUERY, {
    season: season.toUpperCase(),
    seasonYear: year,
    page,
    perPage,
  });
}
