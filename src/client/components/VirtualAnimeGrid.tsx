import { useMemo } from "react";
import { prepare, layout } from "@chenglou/pretext";
import type { AnimeMedia } from "../../shared/types";

type Props = {
  anime: AnimeMedia[];
  onAdd?: (anime: AnimeMedia) => void;
};

const CARD_PADDING = 12;
const TITLE_FONT = '14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const TITLE_LINE_HEIGHT = 18;
const DEFAULT_TEXT_WIDTH = 180;

function formatTimeUntilAiring(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export default function VirtualAnimeGrid({ anime, onAdd }: Props) {
  const preparedTitles = useMemo(
    () =>
      anime.map((a) => ({
        anime: a,
        prepared: prepare(a.title.english || a.title.romaji, TITLE_FONT),
      })),
    [anime]
  );

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {preparedTitles.map(({ anime: a, prepared }) => {
        const title = a.title.english || a.title.romaji;
        const studio = a.studios.nodes[0]?.name;
        const { height: titleHeight } = layout(
          prepared,
          DEFAULT_TEXT_WIDTH - CARD_PADDING * 2,
          TITLE_LINE_HEIGHT
        );
        const clampedTitleHeight = Math.min(
          titleHeight,
          TITLE_LINE_HEIGHT * 2
        );

        return (
          <div
            key={a.id}
            className="group bg-[var(--bg-card)] rounded-xl overflow-hidden border border-white/5 hover:border-[var(--accent)]/40 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,0,0,0.28)] transition-all"
          >
            <div className="relative aspect-[3/4] overflow-hidden">
              <img
                src={a.coverImage.large}
                alt={title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {a.nextAiringEpisode && (
                <div className="absolute top-2 left-2 bg-[var(--accent)] text-white text-xs px-2 py-0.5 rounded">
                  Ep {a.nextAiringEpisode.episode} in{" "}
                  {formatTimeUntilAiring(a.nextAiringEpisode.timeUntilAiring)}
                </div>
              )}
              {a.averageScore && (
                <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                  {a.averageScore}%
                </div>
              )}
              {onAdd && (
                <button
                  onClick={() => onAdd(a)}
                  className="absolute bottom-0 left-0 right-0 bg-[var(--accent)]/90 text-white text-sm py-2 opacity-0 group-hover:opacity-100 transition font-medium"
                >
                  + Add to List
                </button>
              )}
            </div>
            <div className="p-3">
              <h3
                className="text-sm font-medium leading-tight overflow-hidden"
                style={{ minHeight: clampedTitleHeight, maxHeight: TITLE_LINE_HEIGHT * 2 }}
              >
                {title}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span>{a.format?.replace("_", " ")}</span>
                {a.episodes && <span>&middot; {a.episodes} eps</span>}
              </div>
              {studio && (
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  {studio}
                </p>
              )}
              {a.genres.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {a.genres.slice(0, 3).map((g) => (
                    <span
                      key={g}
                      className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded text-[var(--text-secondary)]"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
