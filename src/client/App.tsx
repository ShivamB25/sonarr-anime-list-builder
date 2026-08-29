import { useEffect, useState } from "react";
import Header from "./components/Header";
import SeasonBrowser from "./pages/SeasonBrowser";
import MyLists from "./pages/MyLists";
import ListDetail from "./pages/ListDetail";

type Page =
  | { name: "browse" }
  | { name: "lists" }
  | { name: "list"; id: string };

export default function App() {
  const [page, setPage] = useState<Page>({ name: "browse" });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash.startsWith("list/")) setPage({ name: "list", id: hash.slice(5) });
      else if (hash === "lists") setPage({ name: "lists" });
      else setPage({ name: "browse" });
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const activePage = page.name === "browse" ? "browse" : "lists";

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-accent px-4 py-3 font-semibold text-accent-ink transition-transform focus:translate-y-0 motion-reduce:transition-none"
      >
        Skip to content
      </a>
      <Header activePage={activePage} />
      <main
        id="main-content"
        className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10"
      >
        {page.name === "browse" && <SeasonBrowser />}
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
    </div>
  );
}
