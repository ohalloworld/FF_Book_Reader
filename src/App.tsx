import { GameShell } from "./components/GameShell";
import { testBook } from "./data/testBook";

function App() {
  return <GameShell book={testBook} />;
}

export default App;
