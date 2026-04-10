import { useState, useEffect } from "react";
import { api, type AnimeMedia, type User } from "../api";
import { useSeasons } from "../hooks";
import AnimeCard from "../components/AnimeCard";
import AddToListModal from "../components/AddToListModal";

type Props = { user: User | null };

export default function SeasonBrowser({ user: _user }: Props) {
  const { currentSeason, currentYear, seasons, years } = useSeasons();
  const [season, setSeason] = useState(currentSeason);
  const [year, setYear] = useState(currentYear);
  const [anime, setAnime] = useState<AnimeMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [search, setSearch] = useState("");
  const [addTarget, setAddTarget] = useState<AnimeMedia | null>(null);

  useEffect(() => {
    setLoading(true);
    setPage(1);

    if (search.trim()) {
      api.anime.search(search.trim()).then((data) => {
        setAnime(data.media);
        setHasNext(data.pageInfo.hasNextPage);
        setLoading(false);
      });
    } else {
      api.anime.seasonal(season, year).then((data) => {
        setAnime(data.media);
        setHasNext(data.pageInfo.hasNextPage);
        setLoading(false);
      });
    }
  }, [season, year, search]);

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);

    const fetcher = search.trim()
      ? api.anime.search(search.trim(), nextPage)
      : api.anime.seasonal(season, year, nextPage);

    fetcher.then((data) => {
      setAnime((prev) => [...prev, ...data.media]);
      setHasNext(data.pageInfo.hasNextPage);
    });
  }

  const seasonLabels: Record<string, string> = {
    WINTER: "Winter",
    SPRING: "Spring",
    SUMMER: "Summer",
    FALL: "Fall",
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
              onChange={(e) => setSeason(e.target.value)}
              className="px-3 py-2 bg-[var(--bg-secondary)] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] cursor-pointer"
            >
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {seasonLabels[s]}
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
        <h1 className="text-2xl font-bold mb-6">
          {seasonLabels[season]} {year}
        </h1>
      )}
      {search && (
        <h1 className="text-2xl font-bold mb-6">
          Results for &ldquo;{search}&rdquo;
        </h1>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
        </div>
      ) : anime.length === 0 ? (
        <p className="text-center text-[var(--text-secondary)] py-20">
          No anime found for this season.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {anime.map((a) => (
              <AnimeCard key={a.id} anime={a} onAdd={setAddTarget} />
            ))}
          </div>
          {hasNext && (
            <div className="flex justify-center mt-8">
              <button
                onClick={loadMore}
                className="px-6 py-2 bg-[var(--bg-secondary)] hover:bg-white/10 border border-white/10 rounded-lg transition"
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}

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
