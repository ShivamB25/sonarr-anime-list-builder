import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api";
import type { User } from "../shared/types";
import { getCurrentSeason, SEASONS } from "../shared/season";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionController = useRef<AbortController | null>(null);
  const refreshGeneration = useRef(0);

  const refresh = useCallback(async () => {
    sessionController.current?.abort();
    const controller = new AbortController();
    const generation = refreshGeneration.current + 1;
    sessionController.current = controller;
    refreshGeneration.current = generation;

    try {
      const u = await api.auth.session(controller.signal);
      if (!controller.signal.aborted && refreshGeneration.current === generation) {
        setUser(u);
      }
    } catch {
      if (!controller.signal.aborted && refreshGeneration.current === generation) {
        setUser(null);
      }
    } finally {
      if (!controller.signal.aborted && refreshGeneration.current === generation) {
        sessionController.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      sessionController.current?.abort();
      sessionController.current = null;
      refreshGeneration.current += 1;
    };
  }, [refresh]);

  return { user, loading, refresh, setUser };
}

export function useSeasons() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentSeason = getCurrentSeason(now);
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return { currentSeason, currentYear, seasons: SEASONS, years };
}
