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
