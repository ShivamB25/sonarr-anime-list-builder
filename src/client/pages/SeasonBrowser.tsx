import { useEffect, useRef, useState } from "react";
import { api, getErrorMessage, isAbortError } from "../api";
import type { AnimeMedia } from "../../shared/types";
import { isSeason, SEASON_LABELS } from "../../shared/season";
import { useSeasons } from "../hooks";
import VirtualAnimeGrid from "../components/VirtualAnimeGrid";
import AddToListModal from "../components/AddToListModal";
import CopyUrlBar from "../components/CopyUrlBar";

export default function SeasonBrowser() {
  const { currentSeason, currentYear, seasons, years } = useSeasons();
  const [season, setSeason] = useState(currentSeason);
  const [year, setYear] = useState(currentYear);
  const [anime, setAnime] = useState<AnimeMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addTarget, setAddTarget] = useState<AnimeMedia | null>(null);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setLoading(true);
    setError("");

    async function load() {
      try {
        const query = search.trim();
        const media = query
          ? (await api.anime.search(query, 1, controller.signal)).media
          : await api.anime.seasonal(season, year, controller.signal);

        if (requestVersion.current === version) {
          setAnime(media);
        }
      } catch (loadError) {
        if (!isAbortError(loadError) && requestVersion.current === version) {
          setAnime([]);
          setError(getErrorMessage(loadError, "Unable to load anime."));
        }
      } finally {
        if (!controller.signal.aborted && requestVersion.current === version) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [season, year, search]);


  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Search anime..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 bg-[var(--bg-secondary)] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        {!search && (
          <div className="flex gap-2">
            <select
              value={season}
              onChange={(e) => {
                if (isSeason(e.target.value)) setSeason(e.target.value);
              }}
              className="px-3 py-2 bg-[var(--bg-secondary)] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-pointer"
            >
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {SEASON_LABELS[s]}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 bg-[var(--bg-secondary)] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!search && (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,34rem)]">
            <div className="rounded-2xl border border-white/8 bg-[var(--bg-secondary)]/70 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                  <span className="text-lg">TV</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold">
                    {SEASON_LABELS[season]} {year}
                  </h1>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Browse current picks, add anime to your own list, or copy the full season feed for Sonarr.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-[var(--bg-secondary)]/70 p-5">
              <p className="text-sm font-medium mb-2">Sonarr URL for this season</p>
              <CopyUrlBar
                url={`${window.location.origin}/api/anime/season-feed?season=${season}&year=${year}`}
              />
              <p className="text-[11px] text-[var(--text-secondary)] mt-2 leading-relaxed">
                Paste this into Sonarr → Import Lists → Custom List → List URL to import the currently selected season.
              </p>
            </div>
          </div>
        </>
      )}
      {search && (
        <h1 className="text-2xl font-bold mb-6">
          Results for &ldquo;{search}&rdquo;
        </h1>
      )}

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
        </div>
      ) : anime.length > 0 ? (
        <VirtualAnimeGrid anime={anime} onAdd={setAddTarget} />
      ) : !error ? (
        <p className="text-center text-[var(--text-secondary)] py-20">
          No anime found for this season.
        </p>
      ) : null}

      {addTarget && (
        <AddToListModal
          anime={addTarget}
          season={search ? undefined : season}
          year={search ? undefined : year}
          onClose={() => setAddTarget(null)}
          onAdded={() => {}}
        />
      )}
    </div>
  );
}
