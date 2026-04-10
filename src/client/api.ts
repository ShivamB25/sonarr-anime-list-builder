const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type User = { id: string; username: string | null; isGuest: boolean };
export type AnimeMedia = {
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
  nextAiringEpisode: { airingAt: number; episode: number; timeUntilAiring: number } | null;
  startDate: { year: number; month: number; day: number };
  studios: { nodes: { name: string }[] };
};
export type PageInfo = { hasNextPage: boolean; currentPage: number; lastPage: number; total: number };
export type AnimePage = { pageInfo: PageInfo; media: AnimeMedia[] };
export type List = { id: string; name: string; season: string | null; year: number | null; createdAt: string };
export type ListItem = {
  id: string;
  listId: string;
  anilistId: number;
  title: string;
  titleEnglish: string | null;
  coverImage: string | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  score: number | null;
};
export type ListDetail = List & { items: ListItem[] };

export const api = {
  auth: {
    session: () => request<User>("/auth/session"),
    register: (username: string, password: string) =>
      request<User>("/auth/register", { method: "POST", body: JSON.stringify({ username, password }) }),
    login: (username: string, password: string) =>
      request<User>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
    logout: () => request("/auth/logout", { method: "POST" }),
  },
  anime: {
    seasonal: (season: string, year: number, page = 1) =>
      request<AnimePage>(`/anime/seasonal?season=${season}&year=${year}&page=${page}`),
    search: (q: string, page = 1) =>
      request<AnimePage>(`/anime/search?q=${encodeURIComponent(q)}&page=${page}`),
  },
  lists: {
    getAll: () => request<List[]>("/lists"),
    create: (name: string, season?: string, year?: number) =>
      request<List>("/lists", { method: "POST", body: JSON.stringify({ name, season, year }) }),
    get: (id: string) => request<ListDetail>(`/lists/${id}`),
    delete: (id: string) => request(`/lists/${id}`, { method: "DELETE" }),
    addItem: (listId: string, item: Omit<ListItem, "id" | "listId">) =>
      request<ListItem>(`/lists/${listId}/items`, { method: "POST", body: JSON.stringify(item) }),
    removeItem: (listId: string, itemId: string) =>
      request(`/lists/${listId}/items/${itemId}`, { method: "DELETE" }),
  },
};
