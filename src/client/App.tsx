import { useState, useEffect } from "react";
import { useUser } from "./hooks";
import { api } from "./api";
import Header from "./components/Header";
import SeasonBrowser from "./pages/SeasonBrowser";
import MyLists from "./pages/MyLists";
import ListDetail from "./pages/ListDetail";
import AuthModal from "./components/AuthModal";

type Page =
  | { name: "browse" }
  | { name: "lists" }
  | { name: "list"; id: string };

export default function App() {
  const { user, loading, refresh, setUser } = useUser();
  const [page, setPage] = useState<Page>({ name: "browse" });
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.slice(1);
      if (hash.startsWith("list/")) setPage({ name: "list", id: hash.slice(5) });
      else if (hash === "lists") setPage({ name: "lists" });
      else setPage({ name: "browse" });
    };
    window.addEventListener("hashchange", handler);
    handler();
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
        user={user}
        onNavigate={(p) => {
          window.location.hash = p;
        }}
        onAuthClick={() => setShowAuth(true)}
        onLogout={async () => {
          await api.auth.logout();
          setUser(null);
          refresh();
        }}
      />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {page.name === "browse" && <SeasonBrowser user={user} />}
        {page.name === "lists" && (
          <MyLists onOpenList={(id) => (window.location.hash = `list/${id}`)} />
        )}
        {page.name === "list" && (
          <ListDetail
            listId={page.id}
            onBack={() => (window.location.hash = "lists")}
          />
        )}
      </main>
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={(u) => {
            setUser(u);
            setShowAuth(false);
          }}
        />
      )}
    </div>
  );
}
