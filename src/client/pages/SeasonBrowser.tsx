import { useEffect, useRef, useState } from "react";
import { api, getErrorMessage, isAbortError } from "../api";
import type { AnimeMedia } from "../../shared/types";
import { isSeason, SEASON_LABELS } from "../../shared/season";
import { useSeasons } from "../hooks";
import VirtualAnimeGrid from "../components/VirtualAnimeGrid";
import AddToListModal from "../components/AddToListModal";
import CopyUrlBar from "../components/CopyUrlBar";

function LoadingGrid() {
  return (
    <div role="status" aria-label="Loading anime" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      <span className="sr-only">Loading anime…</span>
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} aria-hidden="true" className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="aspect-[3/4] animate-pulse bg-surface-raised motion-reduce:animate-none" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-1/3 rounded bg-surface-raised" />
            <div className="h-4 w-full rounded bg-surface-raised" />
            <div className="h-4 w-3/4 rounded bg-surface-raised" />
            <div className="h-11 rounded-xl bg-surface-raised" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SeasonBrowser() {
  const { currentSeason, currentYear, seasons, years } = useSeasons();
  const [season, setSeason] = useState(currentSeason);
  const [year, setYear] = useState(currentYear);
  const [anime, setAnime] = useState<AnimeMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addTarget, setAddTarget] = useState<AnimeMedia | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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

        if (requestVersion.current === version) setAnime(media);
      } catch (loadError) {
        if (!isAbortError(loadError) && requestVersion.current === version) {
          setAnime([]);
          setError(getErrorMessage(loadError, "Unable to load anime."));
        }
      } finally {
        if (!controller.signal.aborted && requestVersion.current === version) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [season, year, search]);

  const query = search.trim();
  const selectionLabel = `${SEASON_LABELS[season]} ${year}`;

  return (
    <section aria-labelledby="catalog-heading">
      <div className="mb-6 grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <label htmlFor="anime-search" className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-muted">
            Search the catalog
          </label>
          <div className="relative">
            <svg aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-4-4" />
            </svg>
            <input
              id="anime-search"
              type="search"
              placeholder="Title, series, or franchise"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-h-12 w-full rounded-xl border border-border bg-background py-3 pl-12 pr-12 text-base text-foreground placeholder:text-muted/75 hover:border-muted focus:border-accent"
              autoComplete="off"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
                aria-label="Clear search"
              >
                <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <fieldset disabled={Boolean(query)} className="grid grid-cols-2 gap-3 disabled:opacity-45">
          <legend className="sr-only">Season filters</legend>
          <label className="block">
            <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-muted">Season</span>
            <select
              value={season}
              onChange={(event) => {
                if (isSeason(event.target.value)) setSeason(event.target.value);
              }}
              className="min-h-12 min-w-32 rounded-xl border border-border bg-background px-3 text-foreground hover:border-muted disabled:cursor-not-allowed"
            >
              {seasons.map((item) => (
                <option key={item} value={item}>{SEASON_LABELS[item]}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-muted">Year</span>
            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="min-h-12 min-w-28 rounded-xl border border-border bg-background px-3 text-foreground hover:border-muted disabled:cursor-not-allowed"
            >
              {years.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </fieldset>
      </div>

      <div className={`mb-8 grid grid-cols-[minmax(0,1fr)] gap-4 ${query ? "" : "lg:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]"}`}>
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface-raised p-6 sm:p-8 lg:min-h-64">
          <div aria-hidden="true" className="absolute -right-20 -top-24 size-64 rounded-full border-[3rem] border-accent/10" />
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div>
              <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.22em] text-accent">
                {query ? "Catalog search" : "Season index"}
              </p>
              <h1 id="catalog-heading" className="max-w-3xl font-display text-4xl font-semibold leading-none tracking-[-0.035em] text-foreground sm:text-5xl lg:text-6xl">
                {query ? `Results for “${query}”` : selectionLabel}
              </h1>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <p className="max-w-2xl text-sm leading-6 text-muted sm:text-base">
                {query
                  ? "Search across seasons, then save a title to an anonymous list stored with this browser."
                  : "A focused index of the season’s releases, airing times, studios, and Sonarr-ready list tools."}
              </p>
              <p className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-bold text-foreground" role="status" aria-live="polite">
                {loading ? "Updating…" : `${anime.length} ${anime.length === 1 ? "title" : "titles"}`}
              </p>
            </div>
          </div>
        </div>

        {!query && (
          <aside className="flex flex-col justify-between gap-6 rounded-3xl border border-border bg-surface p-6 sm:p-8" aria-labelledby="season-feed-heading">
            <div>
              <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-info">Sonarr feed</p>
              <h2 id="season-feed-heading" className="font-display text-2xl font-semibold">Import the whole season</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Add the selected season as a Custom List in Sonarr. The URL updates with your filters.
              </p>
            </div>
            <CopyUrlBar url={`${window.location.origin}/api/anime/season-feed?season=${season}&year=${year}`} />
          </aside>
        )}
      </div>

      {query && (
        <p className="-mt-4 mb-6 text-sm text-muted">
          Season filters are paused while searching. Clear the search to resume seasonal browsing.
        </p>
      )}

      {error && (
        <div className="mb-6 rounded-2xl border border-danger/45 bg-danger/10 px-5 py-4 text-sm text-danger" role="alert">
          <p className="font-bold">The catalog could not be loaded.</p>
          <p className="mt-1">{error}</p>
        </div>
      )}
      <p className="sr-only" role="status" aria-live="polite">{notice}</p>

      {loading ? (
        <LoadingGrid />
      ) : anime.length > 0 ? (
        <VirtualAnimeGrid anime={anime} onAdd={setAddTarget} />
      ) : !error ? (
        <div className="rounded-3xl border border-dashed border-border bg-surface px-6 py-16 text-center">
          <h2 className="font-display text-2xl font-semibold">No titles found</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            {query ? "Try a shorter title or a different spelling." : "This season does not have catalog entries yet."}
          </p>
        </div>
      ) : null}

      {addTarget && (
        <AddToListModal
          anime={addTarget}
          season={query ? undefined : season}
          year={query ? undefined : year}
          onClose={() => setAddTarget(null)}
          onAdded={() => {
            const title = addTarget.title.english || addTarget.title.romaji;
            setNotice(`${title} was added to your list.`);
          }}
        />
      )}
    </section>
  );
}
