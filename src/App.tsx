import { useState } from "react";
import { GameShell } from "./components/GameShell";
import { RulesImporter } from "./components/RulesImporter";
import { testBook } from "./data/testBook";

type View = "play" | "import";

function App() {
  const [view, setView] = useState<View>("play");

  return (
    <>
      <nav className="top-nav">
        <button
          type="button"
          className={"nav-link" + (view === "play" ? " active" : "")}
          onClick={() => setView("play")}
        >
          Play
        </button>
        <button
          type="button"
          className={"nav-link" + (view === "import" ? " active" : "")}
          onClick={() => setView("import")}
        >
          Import Book Rules
        </button>
      </nav>
      {view === "play" ? <GameShell book={testBook} /> : <RulesImporter />}
    </>
  );
}

export default App;
