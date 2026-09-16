import { useCallback, useEffect, useState } from "react";
import { deriveBookSections, findPageForParagraph } from "../engine/library";
import { getPageImage } from "../engine/pageImageStore";
import { generateCharacter } from "../engine/rules";
import { saveBookOverride } from "../engine/storage";
import { useGameSession } from "../engine/useGameSession";
import { getPdfStatus, type PdfStatus } from "../engine/transcriptionApi";
import type { Character, Gamebook, TranscribedParagraph } from "../engine/types";
import { CharacterDrawer } from "./CharacterDrawer";
import { CharacterRoll } from "./CharacterRoll";
import { ChoiceList } from "./ChoiceList";
import { CombatPanel } from "./CombatPanel";
import { CompanionTools } from "./CompanionTools";
import { ParagraphNav } from "./ParagraphNav";
import { PdfPageBrowser, TranscribeSectionPrompt } from "./PdfPageTools";
import { RulesDrawer } from "./RulesDrawer";
import { SectionView } from "./SectionView";
import { StatBar } from "./StatBar";
import { TitleScreen } from "./TitleScreen";

export function GameShell({ book: initialBook, onExit }: { book: Gamebook; onExit?: () => void }) {
  const [book, setBook] = useState(initialBook);
  const [pdfStatus, setPdfStatus] = useState<PdfStatus | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rolledCharacter, setRolledCharacter] = useState<Character | null>(null);

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

  const [refreshVersion, setRefreshVersion] = useState(0);
  const refreshSections = useCallback(() => {
    setBook((prev) => ({ ...prev, sections: deriveBookSections(prev.id) }));
    setRefreshVersion((v) => v + 1);
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

  // Which PDF page (if any) the current paragraph was transcribed from —
  // a cheap, pure lookup, safe to compute directly during render.
  const pdfPage =
    book.isLibraryBook && currentSection ? findPageForParagraph(book.id, currentSection.id) : undefined;

  // The image itself needs an async IndexedDB read, so it's cached by page
  // number and only ever updated from that read's resolution — never
  // synchronously inside the effect — so `sectionImage` below stays a pure
  // derived value.
  const [imageByPage, setImageByPage] = useState<Record<number, string>>({});
  useEffect(() => {
    if (pdfPage === undefined || imageByPage[pdfPage] !== undefined) return;
    let cancelled = false;
    getPageImage(book.id, pdfPage).then((img) => {
      if (!cancelled && img) setImageByPage((prev) => ({ ...prev, [pdfPage]: img }));
    });
    return () => {
      cancelled = true;
    };
  }, [book.id, pdfPage, refreshVersion, imageByPage]);
  const sectionImage = pdfPage !== undefined ? imageByPage[pdfPage] : undefined;

  if (!character || !currentSection) {
    if (rolledCharacter) {
      return (
        <CharacterRoll
          character={rolledCharacter}
          ruleSet={session.ruleSet}
          onReroll={() => setRolledCharacter(generateCharacter(session.ruleSet, rolledCharacter.name))}
          onBegin={() => session.startNewGameWithCharacter(rolledCharacter)}
          onBack={() => setRolledCharacter(null)}
        />
      );
    }
    return (
      <TitleScreen
        book={book}
        hasSave={session.hasSave}
        onStart={(name) => setRolledCharacter(generateCharacter(session.ruleSet, name || "Adventurer"))}
        onResume={session.resumeSavedGame}
        onExit={onExit}
      />
    );
  }

  const showCombat = session.combat && !session.combatResolved;
  const isEnding = Boolean(currentSection.ending);
  const isBlank = !currentSection.text.trim();

  const characterActions = {
    adjustPool: session.adjustPool,
    adjustCounter: session.adjustCounter,
    addItem: session.addItem,
    removeItem: session.removeItem,
  };

  return (
    <div className="game-shell">
      <StatBar
        character={character}
        ruleSet={session.ruleSet}
        onOpenSheet={() => setSheetOpen(true)}
        onOpenRules={() => setRulesOpen(true)}
      />
      <main className="game-main">
        {onExit && (
          <button type="button" className="link-button back-to-library" onClick={onExit}>
            ← Back to Library
          </button>
        )}

        <SectionView
          key={currentSection.id}
          section={currentSection}
          luckOutcome={session.lastLuckOutcome}
          onSaveOverride={book.isLibraryBook ? saveOverride : undefined}
          pageImage={sectionImage}
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

      <CharacterDrawer
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        character={character}
        ruleSet={session.ruleSet}
        actions={characterActions}
      />
      <RulesDrawer open={rulesOpen} onClose={() => setRulesOpen(false)} ruleSet={session.ruleSet} />
    </div>
  );
}
