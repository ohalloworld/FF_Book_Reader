import { useGameSession } from "../engine/useGameSession";
import type { Gamebook } from "../engine/types";
import { CharacterSheet } from "./CharacterSheet";
import { ChoiceList } from "./ChoiceList";
import { CombatPanel } from "./CombatPanel";
import { ParagraphNav } from "./ParagraphNav";
import { SectionView } from "./SectionView";
import { TitleScreen } from "./TitleScreen";

export function GameShell({ book }: { book: Gamebook }) {
  const session = useGameSession(book);
  const { character, currentSection } = session;

  if (!character || !currentSection) {
    return (
      <TitleScreen
        book={book}
        hasSave={session.hasSave}
        onStart={session.startNewGame}
        onResume={session.resumeSavedGame}
      />
    );
  }

  const showCombat = session.combat && !session.combatResolved;
  const isEnding = Boolean(currentSection.ending);

  return (
    <div className="game-shell">
      <CharacterSheet character={character} ruleSet={session.ruleSet} />
      <main className="game-main">
        <SectionView section={currentSection} luckOutcome={session.lastLuckOutcome} />

        {showCombat && session.combat && (
          <CombatPanel
            combat={session.combat}
            ruleSet={session.ruleSet}
            onFight={session.fightRound}
            onFlee={session.fleeCombat}
            onUseLuck={session.useLuckOnRound}
          />
        )}

        {!showCombat && !isEnding && <ChoiceList choices={session.choices} onChoose={session.choose} />}

        {isEnding && (
          <button type="button" className="choice-button" onClick={session.restart}>
            Start a new adventure
          </button>
        )}

        <ParagraphNav
          onGoToParagraph={session.goToParagraph}
          onGoBack={session.goBack}
          canGoBack={session.canGoBack}
        />
      </main>
    </div>
  );
}
