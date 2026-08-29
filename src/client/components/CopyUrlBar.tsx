import { useEffect, useRef, useState } from "react";

type Props = { url: string; compact?: boolean };
type CopyState = "idle" | "copied" | "failed";

export default function CopyUrlBar({ url, compact = false }: Props) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      clearTimeout(resetTimer.current);
    },
    []
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }

    clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopyState("idle"), 2200);
  }

  const statusText =
    copyState === "copied" ? "Copied to clipboard" : copyState === "failed" ? "Copy failed" : "";

  return (
    <div>
      <button
        type="button"
        onClick={() => void copy()}
        className={`group flex w-full items-center gap-3 rounded-xl border border-border bg-background text-left transition-colors hover:border-accent/70 hover:bg-surface ${compact ? "min-h-11 px-3 py-2" : "min-h-12 px-4 py-3"}`}
        aria-label={`Copy Sonarr URL: ${url}`}
      >
        <svg
          aria-hidden="true"
          className={`shrink-0 text-muted transition-colors group-hover:text-accent ${compact ? "size-4" : "size-5"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          {copyState === "copied" ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2m-6 4H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4Z" />
          )}
        </svg>
        <code
          className={`min-w-0 flex-1 truncate ${compact ? "text-[0.7rem]" : "text-xs sm:text-sm"} ${copyState === "failed" ? "text-danger" : copyState === "copied" ? "text-success" : "text-info"}`}
        >
          {copyState === "failed" ? "Copy failed — try again" : copyState === "copied" ? "Copied to clipboard" : url}
        </code>
        <span className="shrink-0 text-xs font-bold uppercase tracking-[0.14em] text-muted group-hover:text-foreground">
          {copyState === "idle" ? "Copy" : ""}
        </span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {statusText}
      </span>
    </div>
  );
}
