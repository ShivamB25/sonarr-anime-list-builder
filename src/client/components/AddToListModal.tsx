import { useState, useEffect } from "react";
import { api, type List, type AnimeMedia } from "../api";

type Props = {
  anime: AnimeMedia;
  season?: string;
  year?: number;
  onClose: () => void;
  onAdded: () => void;
};

const SEASON_LABELS: Record<string, string> = {
  WINTER: "Winter",
  SPRING: "Spring",
  SUMMER: "Summer",
  FALL: "Fall",
};

export default function AddToListModal({ anime, season, year, onClose, onAdded }: Props) {
  const [lists, setLists] = useState<List[]>([]);
  const [newListName, setNewListName] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  const defaultName = season && year
    ? `${SEASON_LABELS[season] ?? season} ${year}`
    : "";

  useEffect(() => {
    api.lists.getAll().then((l) => {
      setLists(l);
      setLoading(false);
    });
  }, []);

  async function addToList(listId: string) {
    setAdding(listId);
    try {
      await api.lists.addItem(listId, {
        anilistId: anime.id,
        title: anime.title.romaji,
        titleEnglish: anime.title.english,
        coverImage: anime.coverImage.large,
        format: anime.format,
        status: anime.status,
        episodes: anime.episodes,
        score: anime.averageScore,
      });
      onAdded();
      onClose();
    } catch {
      setAdding(null);
    }
  }

  async function createAndAdd() {
    const name = newListName.trim() || defaultName;
    if (!name) return;
    setAdding("new");
    try {
      const list = await api.lists.create(name, season, year);
      await api.lists.addItem(list.id, {
        anilistId: anime.id,
        title: anime.title.romaji,
        titleEnglish: anime.title.english,
        coverImage: anime.coverImage.large,
        format: anime.format,
        status: anime.status,
        episodes: anime.episodes,
        score: anime.averageScore,
      });
      onAdded();
      onClose();
    } catch {
      setAdding(null);
    }
  }

  const title = anime.title.english || anime.title.romaji;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[var(--bg-secondary)] rounded-xl p-6 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-1">Add to List</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-1">{title}</p>

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Loading lists...</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {lists.length === 0 && (
              <p className="text-sm text-[var(--text-secondary)]">No lists yet. Create one below.</p>
            )}
            {lists.map((l) => (
              <button
                key={l.id}
                onClick={() => addToList(l.id)}
                disabled={adding !== null}
                className="w-full text-left px-3 py-2 bg-[var(--bg-primary)] hover:bg-white/10 rounded transition text-sm disabled:opacity-50 flex justify-between items-center"
              >
                <span>{adding === l.id ? "Adding..." : l.name}</span>
                {l.season && l.year && (
                  <span className="text-xs text-[var(--text-secondary)]">
                    {SEASON_LABELS[l.season] ?? l.season} {l.year}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-[var(--text-secondary)] mb-2">Or create a new list:</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={defaultName || "List name"}
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-[var(--bg-primary)] border border-white/10 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
            />
            <button
              onClick={createAndAdd}
              disabled={(!newListName.trim() && !defaultName) || adding !== null}
              className="px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded text-sm font-medium transition disabled:opacity-50"
            >
              {adding === "new" ? "..." : "Create & Add"}
            </button>
          </div>
          {defaultName && !newListName.trim() && (
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Will create &ldquo;{defaultName}&rdquo;
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
