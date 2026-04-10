import { useState } from "react";
import { api, type User } from "../api";

type Props = {
  onClose: () => void;
  onSuccess: (user: User) => void;
};

export default function AuthModal({ onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user =
        mode === "register"
          ? await api.auth.register(username, password)
          : await api.auth.login(username, password);
      onSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[var(--bg-secondary)] rounded-xl p-6 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">
          {mode === "register" ? "Create Account" : "Login"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-white/10 rounded focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded font-medium transition disabled:opacity-50"
          >
            {loading ? "..." : mode === "register" ? "Sign Up" : "Login"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-[var(--text-secondary)]">
          {mode === "register" ? "Already have an account?" : "Need an account?"}{" "}
          <button
            onClick={() => setMode(mode === "register" ? "login" : "register")}
            className="text-[var(--accent)] hover:underline"
          >
            {mode === "register" ? "Login" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
}
