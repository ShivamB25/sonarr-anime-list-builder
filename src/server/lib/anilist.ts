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
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList API error: ${res.status}`);
  const json = (await res.json()) as { data: { Page: { pageInfo: unknown; media: AniListMedia[] } } };
  return json.data.Page;
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

export async function searchAnime(search: string, page = 1, perPage = 10) {
  const key = `anilist:search:${encodeURIComponent(search)}:${page}:${perPage}`;
  return cached(key, 1800, () =>
    gqlRequest(SEARCH_QUERY, { search, page, perPage })
  );
}
