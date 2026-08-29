import type { AnimeMedia } from "../../shared/types";

type Props = {
  anime: AnimeMedia[];
  onAdd?: (anime: AnimeMedia) => void;
};


function formatTimeUntilAiring(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}


export default function VirtualAnimeGrid({ anime, onAdd }: Props) {

  return (
    <ul className="grid list-none grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {anime.map((item) => {
        const title = item.title.english || item.title.romaji;
        const studio = item.studios.nodes[0]?.name;

        return (
          <li key={item.id} className="min-w-0">
            <article className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_18px_50px_rgb(0_0_0/0.18)] transition-colors hover:border-accent/60 focus-within:border-accent forced-colors:border-2">
              <div className="relative aspect-[3/4] overflow-hidden bg-surface-raised">
                <img
                  src={item.coverImage.large}
                  alt=""
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none"
                  loading="lazy"
                  width={460}
                  height={613}
                />
                <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/75 to-transparent p-2.5 pb-8">
                  {item.nextAiringEpisode ? (
                    <span className="rounded-full bg-accent px-2.5 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-accent-ink">
                      Ep {item.nextAiringEpisode.episode} · {formatTimeUntilAiring(item.nextAiringEpisode.timeUntilAiring)}
                    </span>
                  ) : (
                    <span />
                  )}
                  {item.averageScore !== null && (
                    <span className="rounded-full border border-white/20 bg-black/70 px-2.5 py-1 text-xs font-bold text-white">
                      {item.averageScore}%
                    </span>
                  )}
                </div>
              </div>

              <div className="flex min-h-[11.5rem] flex-col p-3.5 sm:p-4">
                <p className="mb-2 text-[0.66rem] font-extrabold uppercase tracking-[0.16em] text-accent">
                  {item.format.replaceAll("_", " ").toLowerCase()}
                  {item.episodes !== null ? ` · ${item.episodes} episodes` : ""}
                </p>
                <h2 className="min-h-10 overflow-hidden text-[0.94rem] font-semibold leading-5 text-foreground">
                  {title}
                </h2>
                {studio && <p className="mt-1 truncate text-xs text-muted">{studio}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Genres">
                  {item.genres.slice(0, 2).map((genre) => (
                    <span key={genre} className="rounded-full border border-border px-2 py-1 text-[0.65rem] text-muted">
                      {genre}
                    </span>
                  ))}
                </div>
                {onAdd && (
                  <button
                    type="button"
                    onClick={() => onAdd(item)}
                    className="mt-auto flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-extrabold text-accent-ink transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Add ${title} to a list`}
                  >
                    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                    </svg>
                    Add to list
                  </button>
                )}
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
