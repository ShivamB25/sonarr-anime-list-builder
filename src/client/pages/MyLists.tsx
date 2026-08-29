import { useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
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
        if (!isAbortError(loadError)) setError(getErrorMessage(loadError, "Unable to load your lists."));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadLists();
    return () => controller.abort();
  }, []);

  async function createList() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError("");
    try {
      const list = await api.lists.create(name);
      setLists((previous) => [...previous, list]);
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
      setLists((previous) => previous.filter((list) => list.id !== id));
      if (expanded === id) setExpanded(null);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Unable to delete the list."));
    }
  }

  function handleCreate(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    void createList();
  }

  return (
    <section aria-labelledby="lists-heading">
      <div className="mb-8 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface-raised p-6 sm:p-8">
          <div aria-hidden="true" className="absolute -right-16 -top-20 size-56 rounded-full border-[2.5rem] border-info/10" />
          <div className="relative">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.22em] text-info">Personal library</p>
            <h1 id="lists-heading" className="font-display text-4xl font-semibold leading-none tracking-[-0.035em] sm:text-5xl">
              Your Sonarr lists
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-muted sm:text-base">
              Lists stay linked to this browser through an anonymous session. Open a list to review titles or reveal its Sonarr feed URL.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
          <label htmlFor="new-list" className="font-display text-2xl font-semibold">Create a list</label>
          <p id="new-list-help" className="mt-2 text-sm leading-6 text-muted">Start with a season, genre, or watch-plan name.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              id="new-list"
              type="text"
              placeholder="Fall premieres"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              aria-describedby="new-list-help"
              className="min-h-12 min-w-0 rounded-xl border border-border bg-background px-4 text-foreground placeholder:text-muted/75 hover:border-muted focus:border-accent"
            />
            <button
              type="submit"
              disabled={!newName.trim() || creating}
              className="min-h-12 rounded-xl bg-accent px-5 py-3 text-sm font-extrabold text-accent-ink transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create list"}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-danger/45 bg-danger/10 px-5 py-4 text-sm text-danger" role="alert">
          <p className="font-bold">Your lists could not be updated.</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-accent">Collection</p>
          <h2 className="mt-1 font-display text-2xl font-semibold">Saved lists</h2>
        </div>
        {!loading && <p className="text-sm font-bold text-muted">{lists.length} {lists.length === 1 ? "list" : "lists"}</p>}
      </div>

      {loading ? (
        <div className="rounded-3xl border border-border bg-surface px-6 py-16 text-center" role="status">
          <div aria-hidden="true" className="mx-auto size-8 animate-spin rounded-full border-2 border-accent border-t-transparent motion-reduce:animate-none" />
          <p className="mt-4 text-sm text-muted">Loading your lists…</p>
        </div>
      ) : lists.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-surface px-6 py-16 text-center">
          <h3 className="font-display text-2xl font-semibold">No lists yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Create one above, or browse a season and save a title directly from its card.</p>
          <a href="#" className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground transition-colors hover:border-accent hover:text-accent">
            Browse the catalog
          </a>
        </div>
      ) : (
        <ul className="grid list-none gap-3">
          {lists.map((list) => {
            const feedId = `list-feed-${list.id}`;
            const seasonLabel = list.season && list.year
              ? `${isSeason(list.season) ? SEASON_LABELS[list.season] : list.season} ${list.year}`
              : null;

            return (
              <li key={list.id}>
                <article className="overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-muted">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch">
                    <button
                      type="button"
                      onClick={() => onOpenList(list.id)}
                      className="min-w-0 p-4 text-left sm:p-5"
                      aria-label={`Open ${list.name}`}
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                        <h3 className="truncate text-base font-bold text-foreground sm:text-lg">{list.name}</h3>
                        {seasonLabel && <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent">{seasonLabel}</span>}
                      </div>
                      <p className="mt-1 text-xs text-muted">Open list and manage titles</p>
                    </button>

                    <div className="flex items-center gap-1 border-l border-border px-2 sm:px-3">
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === list.id ? null : list.id)}
                        className="flex size-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-raised hover:text-info"
                        aria-label={`${expanded === list.id ? "Hide" : "Show"} Sonarr URL for ${list.name}`}
                        aria-expanded={expanded === list.id}
                        aria-controls={feedId}
                      >
                        <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.8 10.2a4 4 0 0 0-5.6 0l-4 4a4 4 0 0 0 5.6 5.6l1.1-1.1m-.7-4.9a4 4 0 0 0 5.6 0l4-4a4 4 0 0 0-5.6-5.6l-1.1 1.1" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete “${list.name}”?`)) void deleteList(list.id);
                        }}
                        className="flex size-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                        aria-label={`Delete ${list.name}`}
                      >
                        <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" d="M4 7h16M9 7V4h6v3m3 0-.7 12a2 2 0 0 1-2 1.9H8.7a2 2 0 0 1-2-1.9L6 7m4 4v6m4-6v6" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {expanded === list.id && (
                    <div id={feedId} className="border-t border-border bg-background/45 p-4 sm:p-5">
                      <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">Sonarr list URL</p>
                      <CopyUrlBar url={`${window.location.origin}/api/lists/${list.id}/sonarr`} compact />
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
