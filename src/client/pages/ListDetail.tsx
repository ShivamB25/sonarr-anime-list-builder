import { useState, useEffect } from "react";
import { api, type ListDetail as ListDetailType } from "../api";

type Props = { listId: string; onBack: () => void };

export default function ListDetail({ listId, onBack }: Props) {
  const [list, setList] = useState<ListDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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

  function getSonarrUrl() {
    return `${window.location.origin}/api/lists/${listId}/sonarr`;
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(getSonarrUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">{list.name}</h1>
        <div className="flex flex-col sm:items-end gap-2">
          <button
            onClick={copyUrl}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition"
          >
            {copied ? "Copied!" : "Copy Sonarr Import URL"}
          </button>
          <p className="text-xs text-[var(--text-secondary)] max-w-xs text-right">
            Paste this URL into Sonarr &rarr; Import Lists &rarr; Custom List
            &rarr; List URL
          </p>
        </div>
      </div>

      <div className="mb-6 p-3 bg-[var(--bg-secondary)] rounded-lg border border-white/10">
        <p className="text-xs text-[var(--text-secondary)] mb-1">
          Sonarr List URL:
        </p>
        <code className="text-xs text-[var(--accent)] break-all select-all">
          {getSonarrUrl()}
        </code>
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
