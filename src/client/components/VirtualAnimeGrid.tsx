import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { prepare, layout, type PreparedText } from "@chenglou/pretext";
import type { AnimeMedia } from "../api";

type Props = {
  anime: AnimeMedia[];
  onAdd?: (anime: AnimeMedia) => void;
};

// Card layout constants
const GAP = 16;
const CARD_PADDING = 12;
const IMAGE_ASPECT = 4 / 3; // height / width (3:4 cover)
const TITLE_FONT = '14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const TITLE_LINE_HEIGHT = 18;
const META_HEIGHT = 20; // format + episodes line
const STUDIO_HEIGHT = 16;
const GENRES_HEIGHT = 22;
const OVERSCAN = 300; // px above/below viewport to pre-render

type MeasuredCard = {
  index: number;
  preparedTitle: PreparedText;
};

function getColCount(width: number): number {
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  if (width >= 640) return 3;
  return 2;
}

type PositionedCard = {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

function computeLayout(
  measured: MeasuredCard[],
  anime: AnimeMedia[],
  containerWidth: number
): { positions: PositionedCard[]; totalHeight: number } {
  const colCount = getColCount(containerWidth);
  const colWidth = (containerWidth - (colCount - 1) * GAP) / colCount;
  const textWidth = colWidth - CARD_PADDING * 2;
  const imageHeight = colWidth * IMAGE_ASPECT;
  const colHeights = new Float64Array(colCount).fill(0);
  const positions: PositionedCard[] = [];

  for (let i = 0; i < measured.length; i++) {
    const card = measured[i];
    const a = anime[card.index];

    // Use pretext to measure title height without DOM reflow
    const { height: titleHeight } = layout(card.preparedTitle, textWidth, TITLE_LINE_HEIGHT);
    // Cap at 2 lines
    const clampedTitleHeight = Math.min(titleHeight, TITLE_LINE_HEIGHT * 2);

    let contentHeight = CARD_PADDING + clampedTitleHeight + 4 + META_HEIGHT;
    if (a.studios.nodes[0]?.name) contentHeight += STUDIO_HEIGHT;
    if (a.genres.length > 0) contentHeight += GENRES_HEIGHT;
    contentHeight += 4; // bottom padding

    const totalH = imageHeight + contentHeight;

    // Find shortest column
    let shortest = 0;
    for (let c = 1; c < colCount; c++) {
      if (colHeights[c] < colHeights[shortest]) shortest = c;
    }

    positions.push({
      index: card.index,
      x: shortest * (colWidth + GAP),
      y: colHeights[shortest],
      w: colWidth,
      h: totalH,
    });

    colHeights[shortest] += totalH + GAP;
  }

  let totalHeight = 0;
  for (let c = 0; c < colCount; c++) {
    if (colHeights[c] > totalHeight) totalHeight = colHeights[c];
  }

  return { positions, totalHeight };
}

function formatTimeUntilAiring(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export default function VirtualAnimeGrid({ anime, onAdd }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 800
  );

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Track scroll position
  useEffect(() => {
    function onScroll() {
      setScrollTop(window.scrollY);
      setViewportHeight(window.innerHeight);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Prepare all titles with pretext (one-time measurement, no DOM reflow)
  const measured = useMemo<MeasuredCard[]>(() => {
    return anime.map((a, i) => ({
      index: i,
      preparedTitle: prepare(a.title.english || a.title.romaji, TITLE_FONT),
    }));
  }, [anime]);

  // Compute card positions using pretext layout (pure arithmetic)
  const { positions, totalHeight } = useMemo(() => {
    if (containerWidth === 0) return { positions: [], totalHeight: 0 };
    return computeLayout(measured, anime, containerWidth);
  }, [measured, anime, containerWidth]);

  // Get container offset for scroll calculation
  const getContainerOffset = useCallback(() => {
    return containerRef.current?.getBoundingClientRect().top ?? 0;
  }, []);

  // Determine visible cards (virtualization)
  const visibleCards = useMemo(() => {
    if (positions.length === 0) return [];

    const containerOffset = containerRef.current
      ? containerRef.current.offsetTop
      : 0;
    const viewTop = scrollTop - containerOffset - OVERSCAN;
    const viewBottom = scrollTop - containerOffset + viewportHeight + OVERSCAN;

    return positions.filter(
      (p) => p.y + p.h >= viewTop && p.y <= viewBottom
    );
  }, [positions, scrollTop, viewportHeight, getContainerOffset]);

  const colWidth = containerWidth > 0
    ? (containerWidth - (getColCount(containerWidth) - 1) * GAP) / getColCount(containerWidth)
    : 0;
  const imageHeight = colWidth * IMAGE_ASPECT;

  return (
    <div ref={containerRef} className="relative" style={{ height: totalHeight }}>
      {visibleCards.map((pos) => {
        const a = anime[pos.index];
        const title = a.title.english || a.title.romaji;
        const studio = a.studios.nodes[0]?.name;

        return (
          <div
            key={a.id}
            className="absolute group bg-[var(--bg-card)] rounded-lg overflow-hidden hover:ring-2 hover:ring-[var(--accent)]/50 transition-shadow"
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px)`,
              width: pos.w,
              height: pos.h,
              willChange: "transform",
            }}
          >
            <div style={{ height: imageHeight }} className="relative overflow-hidden">
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
              <h3 className="text-sm font-medium leading-tight line-clamp-2">
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
