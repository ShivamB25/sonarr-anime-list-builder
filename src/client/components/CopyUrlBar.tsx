import { useState } from "react";

type Props = { url: string; compact?: boolean };

export default function CopyUrlBar({ url, compact }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      onClick={copy}
      className={`group flex items-center gap-2 bg-[var(--bg-primary)] border border-white/10 rounded-lg cursor-pointer hover:border-[var(--accent)]/50 transition ${compact ? "px-3 py-1.5" : "px-4 py-3"}`}
      title="Click to copy"
    >
      <svg
        className={`shrink-0 text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition ${compact ? "w-3.5 h-3.5" : "w-4 h-4"}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        {copied ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        )}
      </svg>
      <code
        className={`flex-1 min-w-0 truncate select-all ${compact ? "text-[11px]" : "text-xs"} ${copied ? "text-green-400" : "text-[var(--accent)]"}`}
      >
        {copied ? "Copied!" : url}
      </code>
      <span
        className={`shrink-0 font-medium transition ${compact ? "text-[10px]" : "text-xs"} ${copied ? "text-green-400" : "text-[var(--text-secondary)] group-hover:text-white"}`}
      >
        {copied ? "" : "Copy"}
      </span>
    </div>
  );
}
