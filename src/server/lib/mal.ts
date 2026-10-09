const MAL_URL = "https://api.myanimelist.net/v2";

export type MALAnime = {
  id: number;
  title: string;
  start_date?: string;
  media_type?: string;
  nsfw?: "white" | "gray" | "black";
  main_picture: { large: string; medium: string };
  alternative_titles: { en: string | null; ja: string | null };
  status: string;
  num_episodes: number | null;
  mean: number | null;
  genres: { name: string }[];
  synopsis: string | null;
  studios: { name: string }[];
  start_season: { year: number; season: string } | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function names(value: unknown): { name: string }[] {
  return Array.isArray(value) ? value.flatMap((item: unknown) => {
    const name = record(item)?.name;
    return typeof name === "string" ? [{ name }] : [];
  }) : [];
}

function parseAnime(value: unknown): MALAnime {
  const node = record(value);
  if (!node || typeof node.id !== "number" || !Number.isSafeInteger(node.id) || node.id < 1 ||
    typeof node.title !== "string" || !node.title.trim()) {
    throw new Error("Invalid MAL anime response");
  }
  const picture = record(node.main_picture);
  const titles = record(node.alternative_titles);
  const startSeason = record(node.start_season);
  return {
    id: node.id,
    title: node.title,
    start_date: typeof node.start_date === "string" ? node.start_date : undefined,
    media_type: typeof node.media_type === "string" ? node.media_type : undefined,
    nsfw: node.nsfw === "white" || node.nsfw === "gray" || node.nsfw === "black" ? node.nsfw : undefined,
    main_picture: {
      large: typeof picture?.large === "string" ? picture.large : "",
      medium: typeof picture?.medium === "string" ? picture.medium : "",
    },
    alternative_titles: {
      en: typeof titles?.en === "string" && titles.en ? titles.en : null,
      ja: typeof titles?.ja === "string" && titles.ja ? titles.ja : null,
    },
    status: typeof node.status === "string" ? node.status : "unknown",
    num_episodes: typeof node.num_episodes === "number" && node.num_episodes > 0 ? node.num_episodes : null,
    mean: typeof node.mean === "number" && Number.isFinite(node.mean) ? node.mean : null,
    genres: names(node.genres),
    synopsis: typeof node.synopsis === "string" ? node.synopsis : null,
    studios: names(node.studios),
    start_season: startSeason && typeof startSeason.year === "number" &&
      Number.isInteger(startSeason.year) && typeof startSeason.season === "string"
      ? { year: startSeason.year, season: startSeason.season } : null,
  };
}

export async function getAllMALSeasonalAnime(
  season: string,
  year: number,
  clientId: string
): Promise<MALAnime[]> {
  const url = new URL(`${MAL_URL}/anime/season/${year}/${season.toLowerCase()}`);
  url.searchParams.set("limit", "500");
  url.searchParams.set("sort", "anime_num_list_users");
  url.searchParams.set("fields", "id,title,main_picture,alternative_titles,start_date,media_type,nsfw,status,num_episodes,mean,genres,synopsis,studios,start_season");
  url.searchParams.set("nsfw", "true");
  const all: MALAnime[] = [];
  const seenIds = new Set<number>();
  const seenPages = new Set<string>();
  let next: URL | null = url;

  while (next) {
    if (next.origin !== url.origin || next.pathname !== url.pathname || seenPages.has(next.href)) {
      throw new Error("Invalid MAL pagination URL");
    }
    seenPages.add(next.href);
    const res = await fetch(next, { headers: { "X-MAL-CLIENT-ID": clientId } });
    if (!res.ok) throw new Error(`MAL API error: ${res.status}`);
    const json = record(await res.json());
    const paging = record(json?.paging);
    if (!json || !Array.isArray(json.data) || !paging ||
      (paging.next !== undefined && typeof paging.next !== "string")) {
      throw new Error("Invalid MAL seasonal response");
    }
    for (const item of json.data) {
      const anime = parseAnime(record(item)?.node);
      if (seenIds.has(anime.id)) continue;
      seenIds.add(anime.id);
      all.push(anime);
    }
    if (paging.next && json.data.length === 0) {
      throw new Error("MAL returned an empty page while more pages were reported");
    }
    next = typeof paging.next === "string" && paging.next ? new URL(paging.next) : null;
  }
  return all;
}
