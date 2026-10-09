export const SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"] as const;

export type Season = (typeof SEASONS)[number];

export const SEASON_LABELS: Record<Season, string> = {
  WINTER: "Winter",
  SPRING: "Spring",
  SUMMER: "Summer",
  FALL: "Fall",
};

export function isSeason(value: unknown): value is Season {
  return typeof value === "string" && SEASONS.some((season) => season === value);
}

export function getCurrentSeason(date = new Date()): Season {
  const month = date.getMonth() + 1;
  if (month <= 3) return "WINTER";
  if (month <= 6) return "SPRING";
  if (month <= 9) return "SUMMER";
  return "FALL";
}

export function startsBeforeSeason(
  date: { year: number | null; month: number | null },
  season: Season,
  year: number
): boolean {
  if (date.year === null || date.year < 1) return false;
  if (date.year !== year) return date.year < year;
  return date.month !== null && date.month >= 1 &&
    date.month < SEASONS.indexOf(season) * 3 + 1;
}
