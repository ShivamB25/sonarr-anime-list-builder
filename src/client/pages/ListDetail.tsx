import { useEffect, useRef, useState } from "react";
import { api, getErrorMessage, isAbortError } from "../api";
import type { ListDetail as ListDetailType } from "../../shared/types";
import CopyUrlBar from "../components/CopyUrlBar";

type Props = { listId: string; onBack: () => void };

export default function ListDetail({ listId, onBack }: Props) {
  const [list, setList] = useState<ListDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setLoading(true);
    setError("");
    setList(null);

    async function loadList() {
      try {
        const loadedList = await api.lists.get(listId, controller.signal);
        if (requestVersion.current === version) setList(loadedList);
      } catch (loadError) {
        if (!isAbortError(loadError) && requestVersion.current === version) {
          setError(getErrorMessage(loadError, "Unable to load the list."));
        }
      } finally {
        if (!controller.signal.aborted && requestVersion.current === version) {
          setLoading(false);
        }
      }
    }

    void loadList();
    return () => controller.abort();
  }, [listId]);

  async function removeItem(itemId: string) {
    const version = requestVersion.current;
    setError("");
    try {
      await api.lists.removeItem(listId, itemId);
      if (requestVersion.current === version) {
        setList((prev) =>
          prev ? { ...prev, items: prev.items.filter((item) => item.id !== itemId) } : null
        );
      }
    } catch (removeError) {
      if (requestVersion.current === version) {
        setError(getErrorMessage(removeError, "Unable to remove the title."));
      }
    }
  }

  const sonarrUrl = `${window.location.origin}/api/lists/${listId}/sonarr`;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!list) {
    return (
      <p
        className={`text-center py-20 ${error ? "text-red-300" : "text-[var(--text-secondary)]"}`}
        role={error ? "alert" : undefined}
      >
        {error || "List not found."}
      </p>
    );
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="text-[var(--text-secondary)] hover:text-white transition text-sm mb-4 inline-flex items-center gap-1"
      >
        &larr; Back to Lists
      </button>

      <h1 className="text-2xl font-bold mb-4">{list.name}</h1>

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      <div className="mb-6 p-4 bg-[var(--bg-secondary)] rounded-xl border border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Sonarr Import URL</p>
          <span className="text-[10px] px-2 py-0.5 bg-green-600/20 text-green-400 rounded">
            {list.items.length} {list.items.length === 1 ? "title" : "titles"}
          </span>
        </div>
        <CopyUrlBar url={sonarrUrl} />
        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
          Sonarr &rarr; Settings &rarr; Import Lists &rarr; + &rarr; Custom List &rarr; paste this URL into <strong>List URL</strong>. Sonarr will auto-import all titles from this list.
        </p>
      </div>

      {list.items.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[var(--text-secondary)]">
            This list is empty. Browse anime and add titles here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.items.map((item) => (
            <div
              key={item.id}
              className="bg-[var(--bg-secondary)] rounded-lg p-4"
            >
              <div className="flex gap-4">
                {item.coverImage && (
                  <img
                    src={item.coverImage}
                    alt={item.title}
                    className="w-16 h-22 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">
                    {item.titleEnglish || item.title}
                  </h3>
                  {item.titleEnglish && item.title !== item.titleEnglish && (
                    <p className="text-sm text-[var(--text-secondary)]">
                      {item.title}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-secondary)]">
                    {item.format && (
                      <span>{item.format.replace("_", " ")}</span>
                    )}
                    {item.episodes && <span>{item.episodes} eps</span>}
                    {item.score && <span>{item.score}%</span>}
                  </div>
                  <button
                    onClick={() => void removeItem(item.id)}
                    className="mt-2 text-xs px-3 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
