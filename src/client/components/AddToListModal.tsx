import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, SyntheticEvent } from "react";
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
  const dialogRef = useRef<HTMLDialogElement>(null);

  const defaultName = season && year
    ? `${isSeason(season) ? SEASON_LABELS[season] : season} ${year}`
    : "";
  const title = anime.title.english || anime.title.romaji;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLists() {
      try {
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

  function closeDialog() {
    dialogRef.current?.close();
    onClose();
  }

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
      closeDialog();
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
        setLists((previous) => [...previous, list]);
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
      closeDialog();
    } catch (addError) {
      setError(
        targetList
          ? "The list was created, but the title could not be added. Try adding it again."
          : getErrorMessage(addError, "Unable to create the list and add this title.")
      );
    } finally {
      setAdding(null);
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) closeDialog();
  }

  function handleCreate(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    void createAndAdd();
  }

  function keepFocusInDialog(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])"
      )
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog-shell m-auto max-h-[calc(100dvh-2rem)] w-[min(42rem,calc(100%-2rem))] overflow-y-auto rounded-3xl border border-border bg-surface p-0 shadow-[0_32px_100px_rgb(0_0_0/0.65)]"
      aria-labelledby="add-list-title"
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      onClick={handleBackdropClick}
      onKeyDown={keepFocusInDialog}
    >
      <div className="p-5 sm:p-7" onClick={(event) => event.stopPropagation()}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-accent">Save title</p>
            <h2 id="add-list-title" className="font-display text-3xl font-semibold leading-tight">Add to a list</h2>
            <p className="mt-2 text-sm text-muted">{title}</p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            autoFocus
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
            aria-label="Close add to list dialog"
          >
            <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-danger/45 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
            {error}
          </div>
        )}

        <section aria-labelledby="existing-lists-heading">
          <h3 id="existing-lists-heading" className="text-sm font-bold text-foreground">Choose an existing list</h3>
          {loading ? (
            <p className="mt-3 text-sm text-muted" role="status">Loading lists…</p>
          ) : lists.length > 0 ? (
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {lists.map((list) => (
                <li key={list.id}>
                  <button
                    type="button"
                    onClick={() => void addToList(list.id)}
                    disabled={adding !== null}
                    className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left text-sm transition-colors hover:border-accent/60 hover:bg-surface-raised disabled:cursor-wait disabled:opacity-50"
                  >
                    <span className="font-semibold">{adding === list.id ? "Adding…" : list.name}</span>
                    {list.season && list.year && (
                      <span className="shrink-0 text-xs text-muted">
                        {isSeason(list.season) ? SEASON_LABELS[list.season] : list.season} {list.year}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted">
              No lists yet. Create the first one below.
            </p>
          )}
        </section>

        <form onSubmit={handleCreate} className="mt-6 border-t border-border pt-6">
          <label htmlFor="new-list-name" className="text-sm font-bold text-foreground">Create a new list</label>
          <p id="new-list-hint" className="mt-1 text-xs leading-5 text-muted">
            {defaultName ? `Leave blank to use “${defaultName}”.` : "Give the list a short, recognizable name."}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              id="new-list-name"
              type="text"
              placeholder={defaultName || "Weekend watchlist"}
              value={newListName}
              onChange={(event) => setNewListName(event.target.value)}
              aria-describedby="new-list-hint"
              className="min-h-12 w-full rounded-xl border border-border bg-background px-4 text-foreground placeholder:text-muted/75 hover:border-muted focus:border-accent"
            />
            <button
              type="submit"
              disabled={(!createdList && !newListName.trim() && !defaultName) || adding !== null}
              className="min-h-12 rounded-xl bg-accent px-5 py-3 text-sm font-extrabold text-accent-ink transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              {adding === "new" ? "Adding…" : createdList ? "Retry add" : "Create and add"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
