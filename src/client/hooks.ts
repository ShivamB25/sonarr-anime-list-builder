import { useState, useEffect, useCallback } from "react";
import { api, type User } from "./api";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await api.auth.session();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { user, loading, refresh, setUser };
}

export function useSeasons() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  let currentSeason: string;
  if (currentMonth >= 1 && currentMonth <= 3) currentSeason = "WINTER";
  else if (currentMonth >= 4 && currentMonth <= 6) currentSeason = "SPRING";
  else if (currentMonth >= 7 && currentMonth <= 9) currentSeason = "SUMMER";
  else currentSeason = "FALL";

  const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return { currentSeason, currentYear, seasons, years };
}
