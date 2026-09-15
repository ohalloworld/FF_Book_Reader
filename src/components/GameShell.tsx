import { useGameSession } from "../engine/useGameSession";
import type { Gamebook } from "../engine/types";
import { CharacterSheet } from "./CharacterSheet";
import { ChoiceList } from "./ChoiceList";
import { CombatPanel } from "./CombatPanel";
import { CompanionTools } from "./CompanionTools";
import { ParagraphNav } from "./ParagraphNav";
import { SectionView } from "./SectionView";
import { TitleScreen } from "./TitleScreen";

export function GameShell({ book, onExit }: { book: Gamebook; onExit?: () => void }) {
  const session = useGameSession(book);
  const { character, currentSection } = session;

  if (!character || !currentSection) {
    return (
      <TitleScreen
        book={book}
        hasSave={session.hasSave}
        onStart={session.startNewGame}
        onResume={session.resumeSavedGame}
        onExit={onExit}
      />
    );
  }

  const showCombat = session.combat && !session.combatResolved;
  const isEnding = Boolean(currentSection.ending);

  return (
    <div className="game-shell">
      <CharacterSheet
        character={character}
        ruleSet={session.ruleSet}
        actions={{
          adjustPool: session.adjustPool,
          adjustCounter: session.adjustCounter,
          addItem: session.addItem,
          removeItem: session.removeItem,
        }}
      />
      <main className="game-main">
        {onExit && (
          <button type="button" className="link-button back-to-library" onClick={onExit}>
            ← Back to Library
          </button>
        )}

        <SectionView section={currentSection} luckOutcome={session.lastLuckOutcome} />

        {showCombat && session.combat && (
          <CombatPanel
            combat={session.combat}
            ruleSet={session.ruleSet}
            onFight={session.fightRound}
            onFlee={session.fleeCombat}
            onEndCombat={session.endCombat}
            onUseLuck={session.useLuckOnRound}
          />
        )}

        {!showCombat && !isEnding && <ChoiceList choices={session.choices} onChoose={session.choose} />}

        {isEnding && (
          <button type="button" className="choice-button" onClick={session.restart}>
            Start a new adventure
          </button>
        )}

        {!isEnding && (
          <CompanionTools
            ruleSet={session.ruleSet}
            onRollTest={session.rollTest}
            onStartCombat={session.startManualCombat}
            combatActive={Boolean(showCombat)}
          />
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
