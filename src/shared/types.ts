export interface User {
  id: string;
  username: string | null;
  isGuest: boolean;
}

export interface AnimeTitle {
  romaji: string;
  english: string | null;
  native: string | null;
}

export interface AnimeCoverImage {
  large: string;
  medium: string;
}

export interface AnimeNextAiringEpisode {
  airingAt: number;
  episode: number;
  timeUntilAiring: number;
}

export interface AnimeStartDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface AnimeStudio {
  name: string;
}

export interface AnimeStudios {
  nodes: AnimeStudio[];
}

export interface AnimeMedia {
  id: number;
  title: AnimeTitle;
  coverImage: AnimeCoverImage;
  bannerImage: string | null;
  format: string;
  status: string;
  episodes: number | null;
  averageScore: number | null;
  genres: string[];
  season: string;
  seasonYear: number;
  description: string | null;
  nextAiringEpisode: AnimeNextAiringEpisode | null;
  startDate: AnimeStartDate;
  studios: AnimeStudios;
}

export interface PageInfo {
  hasNextPage: boolean;
  currentPage: number;
  lastPage: number;
  total: number;
}

export interface AnimePage {
  pageInfo: PageInfo;
  media: AnimeMedia[];
}

export interface List {
  id: string;
  name: string;
  season: string | null;
  year: number | null;
  createdAt: string;
}

export interface ListItem {
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
}

export interface ListDetail extends List {
  items: ListItem[];
}
