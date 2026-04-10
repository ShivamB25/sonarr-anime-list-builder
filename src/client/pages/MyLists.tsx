import { useState, useEffect } from "react";
import { api, type List } from "../api";

type Props = { onOpenList: (id: string) => void };

const SEASON_LABELS: Record<string, string> = {
  WINTER: "Winter",
  SPRING: "Spring",
  SUMMER: "Summer",
  FALL: "Fall",
};

export default function MyLists({ onOpenList }: Props) {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.lists.getAll().then((l) => {
      setLists(l);
      setLoading(false);
    });
  }, []);

  async function createList() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const list = await api.lists.create(newName.trim());
      setLists((prev) => [...prev, list]);
      setNewName("");
    } finally {
      setCreating(false);
    }
  }

  async function deleteList(id: string) {
    await api.lists.delete(id);
    setLists((prev) => prev.filter((l) => l.id !== id));
  }

  function copySonarrUrl(id: string) {
    const url = `${window.location.origin}/api/lists/${id}/sonarr`;
    navigator.clipboard.writeText(url);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">My Lists</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        Each list has a Sonarr-compatible URL. Add it in Sonarr under Import
        Lists &rarr; Custom List.
      </p>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="New list name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 px-4 py-2 bg-[var(--bg-secondary)] border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          onKeyDown={(e) => e.key === "Enter" && createList()}
        />
        <button
          onClick={createList}
          disabled={!newName.trim() || creating}
          className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg font-medium transition disabled:opacity-50"
        >
          {creating ? "..." : "Create List"}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
        </div>
      ) : lists.length === 0 ? (
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
            <div
              key={l.id}
              className="flex items-center justify-between bg-[var(--bg-secondary)] rounded-lg p-4 hover:ring-1 hover:ring-white/20 transition cursor-pointer"
              onClick={() => onOpenList(l.id)}
            >
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="font-medium">{l.name}</h3>
                </div>
                {l.season && l.year && (
                  <span className="text-xs px-2 py-0.5 bg-[var(--accent)]/20 text-[var(--accent)] rounded">
                    {SEASON_LABELS[l.season] ?? l.season} {l.year}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copySonarrUrl(l.id);
                  }}
                  className="text-xs px-2 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded transition"
                  title="Copy Sonarr URL"
                >
                  Copy URL
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${l.name}"?`)) deleteList(l.id);
                  }}
                  className="text-xs px-2 py-1 text-[var(--text-secondary)] hover:text-red-400 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
