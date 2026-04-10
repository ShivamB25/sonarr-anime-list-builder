import { useState, useEffect } from "react";
import { api, type ListDetail as ListDetailType } from "../api";
import CopyUrlBar from "../components/CopyUrlBar";

type Props = { listId: string; onBack: () => void };

export default function ListDetail({ listId, onBack }: Props) {
  const [list, setList] = useState<ListDetailType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.lists.get(listId).then((l) => {
      setList(l);
      setLoading(false);
    });
  }, [listId]);

  async function removeItem(itemId: string) {
    await api.lists.removeItem(listId, itemId);
    setList((prev) =>
      prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : null
    );
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
      <p className="text-center text-[var(--text-secondary)] py-20">
        List not found.
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
                    onClick={() => removeItem(item.id)}
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
