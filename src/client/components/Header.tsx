import type { User } from "../../shared/types";

type Props = {
  user: User | null;
  onNavigate: (hash: string) => void;
  onAuthClick: () => void;
  onLogout: () => void;
};

export default function Header({ user, onNavigate, onAuthClick, onLogout }: Props) {
  return (
    <header className="sticky top-0 z-50 bg-[var(--bg-secondary)]/95 backdrop-blur border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={() => onNavigate("")}
            className="text-lg font-bold text-[var(--accent)] hover:text-[var(--accent-hover)] transition"
          >
            Airing List
          </button>
          <nav className="flex gap-4 text-sm">
            <button
              onClick={() => onNavigate("")}
              className="text-[var(--text-secondary)] hover:text-white transition"
            >
              Browse
            </button>
            <button
              onClick={() => onNavigate("lists")}
              className="text-[var(--text-secondary)] hover:text-white transition"
            >
              My Lists
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {!user || user.isGuest ? (
            <button
              onClick={onAuthClick}
              className="px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded transition"
            >
              Sign Up / Login
            </button>
          ) : (
            <>
              <span className="text-[var(--text-secondary)]">{user?.username}</span>
              <button
                onClick={onLogout}
                className="px-3 py-1.5 border border-white/20 hover:border-white/40 rounded transition"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
