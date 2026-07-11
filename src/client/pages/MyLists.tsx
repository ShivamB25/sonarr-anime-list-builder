import { useEffect, useState } from "react";
import { api, getErrorMessage, isAbortError } from "../api";
import type { List } from "../../shared/types";
import { isSeason, SEASON_LABELS } from "../../shared/season";
import CopyUrlBar from "../components/CopyUrlBar";

type Props = { onOpenList: (id: string) => void };


export default function MyLists({ onOpenList }: Props) {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadLists() {
      try {
        setError("");
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

  async function createList() {
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const list = await api.lists.create(newName.trim());
      setLists((prev) => [...prev, list]);
      setNewName("");
    } catch (createError) {
      setError(getErrorMessage(createError, "Unable to create the list."));
    } finally {
      setCreating(false);
    }
  }

  async function deleteList(id: string) {
    setError("");
    try {
      await api.lists.delete(id);
      setLists((prev) => prev.filter((list) => list.id !== id));
      if (expanded === id) setExpanded(null);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Unable to delete the list."));
    }
  }

  function sonarrUrl(id: string) {
    return `${window.location.origin}/api/lists/${id}/sonarr`;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">My Lists</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        Each list has a Sonarr-compatible URL. Click the link icon to reveal it.
      </p>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="New list name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 px-4 py-2 bg-[var(--bg-secondary)] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          onKeyDown={(e) => {
            if (e.key === "Enter") void createList();
          }}
        />
        <button
          onClick={() => void createList()}
          disabled={!newName.trim() || creating}
          className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg font-medium transition disabled:opacity-50"
        >
          {creating ? "..." : "Create List"}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
        </div>
      ) : !error && lists.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[var(--text-secondary)] text-lg mb-2">
            No lists yet
          </p>
          <p className="text-[var(--text-secondary)] text-sm">
            Create a list above, or browse a season and add anime directly.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {lists.map((l) => (
            <div key={l.id} className="bg-[var(--bg-secondary)] rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between p-4 hover:bg-white/[0.03] transition cursor-pointer"
                onClick={() => onOpenList(l.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <h3 className="font-medium truncate">{l.name}</h3>
                  {l.season && l.year && (
                    <span className="shrink-0 text-xs px-2 py-0.5 bg-[var(--accent)]/20 text-[var(--accent)] rounded">
                      {isSeason(l.season) ? SEASON_LABELS[l.season] : l.season} {l.year}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(expanded === l.id ? null : l.id);
                    }}
                    className="p-1.5 rounded hover:bg-white/10 transition"
                    title="Show Sonarr URL"
                  >
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${l.name}"?`)) void deleteList(l.id);
                    }}
                    className="p-1.5 rounded hover:bg-white/10 transition"
                    title="Delete list"
                  >
                    <svg className="w-4 h-4 text-[var(--text-secondary)] hover:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              {expanded === l.id && (
                <div className="px-4 pb-4 pt-0">
                  <CopyUrlBar url={sonarrUrl(l.id)} compact />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
