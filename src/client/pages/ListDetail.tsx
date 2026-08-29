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
        if (!controller.signal.aborted && requestVersion.current === version) setLoading(false);
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
        setList((previous) => previous ? { ...previous, items: previous.items.filter((item) => item.id !== itemId) } : null);
      }
    } catch (removeError) {
      if (requestVersion.current === version) setError(getErrorMessage(removeError, "Unable to remove the title."));
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-border bg-surface px-6 py-20 text-center" role="status">
        <div aria-hidden="true" className="mx-auto size-8 animate-spin rounded-full border-2 border-accent border-t-transparent motion-reduce:animate-none" />
        <p className="mt-4 text-sm text-muted">Loading list…</p>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="rounded-3xl border border-danger/45 bg-danger/10 px-6 py-16 text-center text-danger" role={error ? "alert" : undefined}>
        <h1 className="font-display text-3xl font-semibold">List unavailable</h1>
        <p className="mt-2 text-sm">{error || "This list could not be found."}</p>
        <button type="button" onClick={onBack} className="mt-6 min-h-11 rounded-xl border border-danger/45 px-4 py-2 text-sm font-bold hover:bg-danger/10">
          Back to lists
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby="list-heading">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-muted transition-colors hover:text-foreground"
      >
        <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
        </svg>
        Back to lists
      </button>

      <div className="mb-8 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface-raised p-6 sm:p-8">
          <div aria-hidden="true" className="absolute -right-16 -top-24 size-60 rounded-full border-[3rem] border-accent/10" />
          <div className="relative">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.22em] text-accent">Saved list</p>
            <h1 id="list-heading" className="font-display text-4xl font-semibold leading-none tracking-[-0.035em] sm:text-5xl">{list.name}</h1>
            <p className="mt-4 text-sm text-muted">{list.items.length} {list.items.length === 1 ? "title" : "titles"} ready for review and Sonarr import.</p>
          </div>
        </div>

        <aside className="rounded-3xl border border-border bg-surface p-6 sm:p-8" aria-labelledby="list-feed-heading">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-info">Sonarr feed</p>
          <h2 id="list-feed-heading" className="font-display text-2xl font-semibold">Import this list</h2>
          <p className="mb-5 mt-2 text-sm leading-6 text-muted">Use this as a Custom List URL in Sonarr. Changes to this list appear in the feed automatically.</p>
          <CopyUrlBar url={`${window.location.origin}/api/lists/${listId}/sonarr`} />
        </aside>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-danger/45 bg-danger/10 px-5 py-4 text-sm text-danger" role="alert">
          {error}
        </div>
      )}

      {list.items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-surface px-6 py-16 text-center">
          <h2 className="font-display text-2xl font-semibold">This list is empty</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Browse a season and use “Add to list” on any title you want Sonarr to track.</p>
          <button type="button" onClick={() => (window.location.hash = "")} className="mt-5 min-h-11 rounded-xl bg-accent px-4 py-2 text-sm font-extrabold text-accent-ink hover:bg-accent-strong">
            Browse titles
          </button>
        </div>
      ) : (
        <ul className="grid list-none gap-4 lg:grid-cols-2">
          {list.items.map((item) => (
            <li key={item.id}>
              <article className="flex h-full gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
                {item.coverImage && (
                  <img src={item.coverImage} alt="" className="h-28 w-20 shrink-0 rounded-xl object-cover" loading="lazy" width={160} height={224} />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <h2 className="font-bold text-foreground">{item.titleEnglish || item.title}</h2>
                  {item.titleEnglish && item.title !== item.titleEnglish && <p className="mt-0.5 truncate text-xs text-muted">{item.title}</p>}
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                    {item.format && <span>{item.format.replaceAll("_", " ").toLowerCase()}</span>}
                    {item.episodes !== null && <span>{item.episodes} episodes</span>}
                    {item.score !== null && <span>{item.score}% score</span>}
                  </p>
                  <button
                    type="button"
                    onClick={() => void removeItem(item.id)}
                    className="mt-auto min-h-11 self-start rounded-xl border border-danger/40 px-3 py-2 text-xs font-bold text-danger transition-colors hover:bg-danger/10"
                    aria-label={`Remove ${item.titleEnglish || item.title} from ${list.name}`}
                  >
                    Remove title
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
