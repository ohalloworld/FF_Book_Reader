import { useCallback, useEffect, useState } from "react";
import { deriveBookSections } from "../engine/library";
import { saveBookOverride } from "../engine/storage";
import { useGameSession } from "../engine/useGameSession";
import { getPdfStatus, type PdfStatus } from "../engine/transcriptionApi";
import type { Gamebook, TranscribedParagraph } from "../engine/types";
import { CharacterSheet } from "./CharacterSheet";
import { ChoiceList } from "./ChoiceList";
import { CombatPanel } from "./CombatPanel";
import { CompanionTools } from "./CompanionTools";
import { ParagraphNav } from "./ParagraphNav";
import { PdfPageBrowser, TranscribeSectionPrompt } from "./PdfPageTools";
import { SectionView } from "./SectionView";
import { TitleScreen } from "./TitleScreen";

export function GameShell({ book: initialBook, onExit }: { book: Gamebook; onExit?: () => void }) {
  const [book, setBook] = useState(initialBook);
  const [pdfStatus, setPdfStatus] = useState<PdfStatus | null>(null);

  useEffect(() => {
    if (!initialBook.isLibraryBook) return;
    let cancelled = false;
    getPdfStatus(initialBook.id)
      .then((status) => {
        if (!cancelled) setPdfStatus(status);
      })
      .catch(() => setPdfStatus({ exists: false }));
    return () => {
      cancelled = true;
    };
  }, [initialBook.id, initialBook.isLibraryBook]);

  const refreshSections = useCallback(() => {
    setBook((prev) => ({ ...prev, sections: deriveBookSections(prev.id) }));
  }, []);

  const saveOverride = useCallback(
    (paragraph: TranscribedParagraph) => {
      saveBookOverride(book.id, paragraph);
      refreshSections();
    },
    [book.id, refreshSections],
  );

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
  const isBlank = !currentSection.text.trim();

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

        <SectionView
          section={currentSection}
          luckOutcome={session.lastLuckOutcome}
          onSaveOverride={book.isLibraryBook ? saveOverride : undefined}
        />

        {pdfStatus?.exists && isBlank && (
          <TranscribeSectionPrompt bookId={book.id} sectionId={currentSection.id} onTranscribed={refreshSections} />
        )}

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

        {pdfStatus?.exists && (
          <PdfPageBrowser bookId={book.id} totalPages={pdfStatus.totalPages} onTranscribed={refreshSections} />
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
