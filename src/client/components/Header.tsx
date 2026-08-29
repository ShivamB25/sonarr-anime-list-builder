type Props = {
  activePage: "browse" | "lists";
};

function BrandMark() {
  return (
    <svg aria-hidden="true" className="size-8" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="10" fill="currentColor" />
      <path d="M9 21.5 13.2 10h5.6L23 21.5h-3.6l-.75-2.35h-5.4l-.75 2.35H9Zm5.15-5.2h3.6L16 11.1l-1.85 5.2Z" fill="currentColor" className="text-accent-ink" />
    </svg>
  );
}

export default function Header({ activePage }: Props) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 w-full max-w-[90rem] items-center justify-between gap-3 px-3 sm:px-6 lg:px-10">
        <a
          href="#"
          className="flex min-h-11 items-center gap-2 rounded-xl text-accent transition-colors hover:text-accent-strong"
          aria-label="Airing List, browse seasons"
        >
          <BrandMark />
          <span className="hidden font-display text-xl font-semibold tracking-tight text-foreground min-[350px]:inline">
            Airing List
          </span>
        </a>

        <nav aria-label="Primary navigation" className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
          <a
            href="#"
            aria-current={activePage === "browse" ? "page" : undefined}
            className="flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:text-accent-ink sm:min-h-11 sm:px-4"
          >
            Browse
          </a>
          <a
            href="#lists"
            aria-current={activePage === "lists" ? "page" : undefined}
            className="flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-muted transition-colors hover:bg-surface-raised hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:text-accent-ink sm:min-h-11 sm:px-4"
          >
            My lists
          </a>
        </nav>
      </div>
    </header>
  );
}
