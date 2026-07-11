import { useEffect, useState } from "react";
import { api, getErrorMessage, isAbortError } from "../api";
import type { AnimeMedia, List } from "../../shared/types";
import { isSeason, SEASON_LABELS } from "../../shared/season";

type Props = {
  anime: AnimeMedia;
  season?: string;
  year?: number;
  onClose: () => void;
  onAdded: () => void;
};


export default function AddToListModal({ anime, season, year, onClose, onAdded }: Props) {
  const [lists, setLists] = useState<List[]>([]);
  const [newListName, setNewListName] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [createdList, setCreatedList] = useState<List | null>(null);

  const defaultName = season && year
    ? `${isSeason(season) ? SEASON_LABELS[season] : season} ${year}`
    : "";

  useEffect(() => {
    const controller = new AbortController();

    async function loadLists() {
      try {
        setLists(await api.lists.getAll(controller.signal));
      } catch (loadError) {
        if (!isAbortError(loadError)) {
          setError(getErrorMessage(loadError, "Unable to load your lists."));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadLists();
    return () => controller.abort();
  }, []);

  async function addToList(listId: string) {
    setAdding(listId);
    setError("");
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
    } catch (addError) {
      setError(getErrorMessage(addError, "Unable to add this title."));
    } finally {
      setAdding(null);
    }
  }

  async function createAndAdd() {
    const name = newListName.trim() || defaultName;
    if (!createdList && !name) return;
    setAdding("new");
    setError("");
    let targetList = createdList;

    try {
      if (!targetList) {
        const list = await api.lists.create(name, season, year);
        targetList = list;
        setCreatedList(list);
        setLists((prev) => [...prev, list]);
        setNewListName("");
      }

      await api.lists.addItem(targetList.id, {
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
    } catch (addError) {
      setError(
        targetList
          ? "List created, but the title could not be added. Try adding it again."
          : getErrorMessage(addError, "Unable to create the list and add this title."),
      );
    } finally {
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

        {error && (
          <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Loading lists...</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {lists.length === 0 && !error && (
              <p className="text-sm text-[var(--text-secondary)]">No lists yet. Create one below.</p>
            )}
            {lists.map((l) => (
              <button
                key={l.id}
                onClick={() => void addToList(l.id)}
                disabled={adding !== null}
                className="w-full text-left px-3 py-2 bg-[var(--bg-primary)] hover:bg-white/10 rounded transition text-sm disabled:opacity-50 flex justify-between items-center"
              >
                <span>{adding === l.id ? "Adding..." : l.name}</span>
                {l.season && l.year && (
                  <span className="text-xs text-[var(--text-secondary)]">
                    {isSeason(l.season) ? SEASON_LABELS[l.season] : l.season} {l.year}
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
              onKeyDown={(e) => {
                if (e.key === "Enter") void createAndAdd();
              }}
            />
            <button
              onClick={() => void createAndAdd()}
              disabled={(!createdList && !newListName.trim() && !defaultName) || adding !== null}
              className="px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded text-sm font-medium transition disabled:opacity-50"
            >
              {adding === "new" ? "..." : createdList ? "Retry Add" : "Create & Add"}
            </button>
          </div>
          {defaultName && !newListName.trim() && !createdList && (
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Will create &ldquo;{defaultName}&rdquo;
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
