import { getCurrentSeason, SEASONS } from "../shared/season";

export function useSeasons() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentSeason = getCurrentSeason(now);
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return { currentSeason, currentYear, seasons: SEASONS, years };
}
