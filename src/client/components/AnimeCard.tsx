import type { AnimeMedia } from "../api";

type Props = {
  anime: AnimeMedia;
  onAdd?: (anime: AnimeMedia) => void;
};

function formatTimeUntilAiring(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export default function AnimeCard({ anime, onAdd }: Props) {
  const title = anime.title.english || anime.title.romaji;
  const studio = anime.studios.nodes[0]?.name;

  return (
    <div className="group relative bg-[var(--bg-card)] rounded-lg overflow-hidden hover:ring-2 hover:ring-[var(--accent)]/50 transition">
      <div className="aspect-[3/4] relative">
        <img
          src={anime.coverImage.large}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {anime.nextAiringEpisode && (
          <div className="absolute top-2 left-2 bg-[var(--accent)] text-white text-xs px-2 py-0.5 rounded">
            Ep {anime.nextAiringEpisode.episode} in{" "}
            {formatTimeUntilAiring(anime.nextAiringEpisode.timeUntilAiring)}
          </div>
        )}
        {anime.averageScore && (
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
            {anime.averageScore}%
          </div>
        )}
        {onAdd && (
          <button
            onClick={() => onAdd(anime)}
            className="absolute bottom-0 left-0 right-0 bg-[var(--accent)]/90 text-white text-sm py-2 opacity-0 group-hover:opacity-100 transition font-medium"
          >
            + Add to List
          </button>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium leading-tight line-clamp-2">{title}</h3>
        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span>{anime.format?.replace("_", " ")}</span>
          {anime.episodes && <span>&middot; {anime.episodes} eps</span>}
        </div>
        {studio && (
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{studio}</p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {anime.genres.slice(0, 3).map((g) => (
            <span
              key={g}
              className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded text-[var(--text-secondary)]"
            >
              {g}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
