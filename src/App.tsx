import { useState } from "react";
import { GameShell } from "./components/GameShell";
import { Library } from "./components/Library";
import { RulesImporter } from "./components/RulesImporter";
import type { Gamebook } from "./engine/types";

type View = "library" | "import";

function App() {
  const [view, setView] = useState<View>("library");
  const [activeBook, setActiveBook] = useState<Gamebook | null>(null);

  return (
    <>
      <nav className="top-nav">
        <button
          type="button"
          className={"nav-link" + (view === "library" ? " active" : "")}
          onClick={() => {
            setView("library");
            setActiveBook(null);
          }}
        >
          Library
        </button>
        <button
          type="button"
          className={"nav-link" + (view === "import" ? " active" : "")}
          onClick={() => setView("import")}
        >
          Import Book Rules
        </button>
      </nav>
      {view === "library" ? (
        activeBook ? (
          <GameShell book={activeBook} onExit={() => setActiveBook(null)} />
        ) : (
          <Library onPlay={setActiveBook} />
        )
      ) : (
        <RulesImporter />
      )}
    </>
  );
}

export default App;
