const MAL_URL = "https://api.myanimelist.net/v2";

export type MALAnime = {
  id: number;
  title: string;
};

export async function getAllMALSeasonalAnime(
  season: string,
  year: number,
  clientId: string
): Promise<MALAnime[]> {
  const normalizedSeason = season.toLowerCase();
  const perPage = 500;
  const all: MALAnime[] = [];
  let offset = 0;

  while (true) {
    const url = `${MAL_URL}/anime/season/${year}/${normalizedSeason}?limit=${perPage}&offset=${offset}&fields=id,title`;
    const res = await fetch(url, {
      headers: { "X-MAL-CLIENT-ID": clientId },
    });

    if (!res.ok) throw new Error(`MAL API error: ${res.status}`);

    const json = (await res.json()) as {
      data: { node: MALAnime }[];
      paging: { next?: string };
    };

    for (const item of json.data) {
      all.push(item.node);
    }

    if (!json.paging.next || json.data.length === 0) break;
    offset += perPage;
  }

  return all;
}
