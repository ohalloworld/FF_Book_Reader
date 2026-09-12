import { useCallback, useMemo, useState } from "react";
import { findTest, resolveCombatRound, resolveTest, type CombatRoundResult } from "./combat";
import { applyEffects, availableChoices, cloneCharacter, generateCharacter, isAlive } from "./rules";
import { clearGame, loadGame, saveGame } from "./storage";
import type { Character, Choice, Gamebook, Monster, Section, SectionId } from "./types";

export interface CombatMonsterState extends Monster {
  currentDamageStat: number;
}

export interface CombatState {
  monsters: CombatMonsterState[];
  fleeGoTo?: SectionId;
  onDefeatGoTo?: SectionId;
  lastRound?: CombatRoundResult;
  luckUsedThisRound?: boolean;
}

export type LuckOutcomeContext = "combat-damage" | "combat-heal" | "general";

export interface LuckOutcome {
  context: LuckOutcomeContext;
  success: boolean;
  roll: number;
}

interface HistoryEntry {
  sectionId: SectionId;
  character: Character;
}

/** Used when jumping to a section number the Gamebook hasn't authored —
 * lets the reader use this as a stat/combat companion alongside a real
 * book's own numbered paragraphs, without needing every section digitized. */
function blankSection(id: SectionId): Section {
  return { id, text: "", choices: [] };
}

function lookupSection(book: Gamebook, id: SectionId): Section {
  return book.sections[id] ?? blankSection(id);
}

function startCombat(section: Section, damageStat: string): CombatState | undefined {
  if (!section.encounter) return undefined;
  return {
    monsters: section.encounter.monsters.map((m) => ({ ...m, currentDamageStat: m.stats[damageStat] ?? 0 })),
    fleeGoTo: section.encounter.fleeGoTo,
    onDefeatGoTo: section.encounter.onDefeatGoTo,
  };
}

export function useGameSession(book: Gamebook) {
  const ruleSet = book.ruleSet;
  const hasSave = useMemo(() => loadGame(book.id) !== null, [book.id]);

  const [character, setCharacter] = useState<Character | null>(null);
  const [currentSectionId, setCurrentSectionId] = useState<SectionId>(book.startSection);
  const [combat, setCombat] = useState<CombatState | undefined>(undefined);
  const [lastLuckOutcome, setLastLuckOutcome] = useState<LuckOutcome | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const currentSection = character ? lookupSection(book, currentSectionId) : undefined;

  const persist = useCallback(
    (char: Character, sectionId: SectionId) => {
      saveGame({ bookId: book.id, character: char, currentSectionId: sectionId, savedAt: new Date().toISOString() });
    },
    [book.id],
  );

  const enterSection = useCallback(
    (sectionId: SectionId, char: Character) => {
      const section = lookupSection(book, sectionId);
      const updated = cloneCharacter(char);
      applyEffects(updated, section.onEnter);

      let resolvedSectionId = sectionId;
      let resolvedSection = section;

      if (section.test) {
        const test = findTest(ruleSet, section.test.testKey);
        if (!test) {
          throw new Error(`Unknown test: ${section.test.testKey}`);
        }
        const result = resolveTest(updated, test);
        if (test.decrementStatOnUse) {
          const block = updated.pools[test.statKey];
          if (block) {
            updated.pools = {
              ...updated.pools,
              [test.statKey]: { ...block, current: Math.max(0, block.current - test.decrementStatOnUse) },
            };
          }
        }
        applyEffects(updated, section.test.effects);
        resolvedSectionId = result.success ? section.test.passGoTo : section.test.failGoTo;
        resolvedSection = lookupSection(book, resolvedSectionId);
        setLastLuckOutcome({ context: "general", success: result.success, roll: result.roll });
      } else {
        setLastLuckOutcome(null);
      }

      setCharacter(updated);
      setCurrentSectionId(resolvedSectionId);
      setCombat(startCombat(resolvedSection, ruleSet.combat.damageStat));
      setHistory((h) => [...h, { sectionId: resolvedSectionId, character: cloneCharacter(updated) }]);
      persist(updated, resolvedSectionId);
    },
    [book, persist, ruleSet],
  );

  const startNewGame = useCallback(
    (name: string) => {
      const char = generateCharacter(ruleSet, name || "Adventurer");
      clearGame(book.id);
      setHistory([]);
      enterSection(book.startSection, char);
    },
    [book.id, book.startSection, enterSection, ruleSet],
  );

  const resumeSavedGame = useCallback(() => {
    const save = loadGame(book.id);
    if (!save) return;
    const section = lookupSection(book, save.currentSectionId);
    setCharacter(save.character);
    setCurrentSectionId(save.currentSectionId);
    setCombat(startCombat(section, ruleSet.combat.damageStat));
    setHistory([{ sectionId: save.currentSectionId, character: save.character }]);
  }, [book, ruleSet]);

  const choose = useCallback(
    (choice: Choice) => {
      if (!character) return;
      enterSection(choice.to, character);
    },
    [character, enterSection],
  );

  /** Jumps straight to a section number, same as clicking a choice that
   * leads there — for skipping past a paragraph's choice buttons (or for
   * paragraphs this Gamebook hasn't authored, since lookupSection falls
   * back to a blank section rather than erroring). */
  const goToParagraph = useCallback(
    (id: string) => {
      const trimmed = id.trim();
      if (!character || !trimmed) return;
      enterSection(trimmed, character);
    },
    [character, enterSection],
  );

  const canGoBack = history.length > 1;

  /** Rewinds to the section+character state as it was just before the
   * current one — a true undo, not a re-navigation, so it never re-rolls
   * a test or re-applies an onEnter effect a second time. */
  const goBack = useCallback(() => {
    if (history.length <= 1) return;
    const next = history.slice(0, -1);
    const prevEntry = next[next.length - 1];
    const prevSection = lookupSection(book, prevEntry.sectionId);
    setCharacter(prevEntry.character);
    setCurrentSectionId(prevEntry.sectionId);
    setCombat(startCombat(prevSection, ruleSet.combat.damageStat));
    setLastLuckOutcome(null);
    setHistory(next);
    persist(prevEntry.character, prevEntry.sectionId);
  }, [history, book, persist, ruleSet]);

  const fightRound = useCallback(
    (monsterId: string) => {
      if (!character || !combat) return;
      const monster = combat.monsters.find((m) => m.id === monsterId);
      if (!monster || monster.currentDamageStat <= 0) return;

      const result = resolveCombatRound(character, monster, ruleSet.combat);
      const updatedChar = cloneCharacter(character);
      const playerBlock = updatedChar.pools[ruleSet.combat.damageStat];
      if (playerBlock) {
        updatedChar.pools = {
          ...updatedChar.pools,
          [ruleSet.combat.damageStat]: {
            ...playerBlock,
            current: Math.max(0, playerBlock.current - result.damageTaken),
          },
        };
      }

      const updatedMonsters = combat.monsters.map((m) =>
        m.id === monsterId
          ? { ...m, currentDamageStat: Math.max(0, m.currentDamageStat - result.damageDealt) }
          : m,
      );

      setCharacter(updatedChar);
      setCombat({ ...combat, monsters: updatedMonsters, lastRound: result, luckUsedThisRound: false });
      persist(updatedChar, currentSectionId);

      if (!isAlive(updatedChar, ruleSet) && combat.onDefeatGoTo) {
        enterSection(combat.onDefeatGoTo, updatedChar);
      }
    },
    [character, combat, currentSectionId, enterSection, persist, ruleSet],
  );

  const fleeCombat = useCallback(() => {
    if (!character || !combat?.fleeGoTo) return;
    enterSection(combat.fleeGoTo, character);
  }, [character, combat, enterSection]);

  const useLuckOnRound = useCallback(
    (context: LuckOutcomeContext) => {
      if (!character || !combat?.lastRound || combat.luckUsedThisRound) return;
      const luckTestKey = ruleSet.combat.luckTestKey;
      if (!luckTestKey) return;
      const test = findTest(ruleSet, luckTestKey);
      if (!test) return;

      const { success, roll } = resolveTest(character, test);
      const updated = cloneCharacter(character);
      if (test.decrementStatOnUse) {
        const block = updated.pools[test.statKey];
        if (block) {
          updated.pools = {
            ...updated.pools,
            [test.statKey]: { ...block, current: Math.max(0, block.current - test.decrementStatOnUse) },
          };
        }
      }

      const extra = ruleSet.combat.luckExtraDamage ?? 1;
      const round = combat.lastRound;
      let monsters = combat.monsters;
      if (round.outcome === "player") {
        const adjust = success ? extra : -extra;
        monsters = monsters.map((m) =>
          m.id === round.monsterId ? { ...m, currentDamageStat: Math.max(0, m.currentDamageStat - adjust) } : m,
        );
      } else if (round.outcome === "monster") {
        const relief = success ? extra : -extra;
        const block = updated.pools[ruleSet.combat.damageStat];
        if (block) {
          updated.pools = {
            ...updated.pools,
            [ruleSet.combat.damageStat]: {
              ...block,
              current: Math.min(block.initial, Math.max(0, block.current + relief)),
            },
          };
        }
      }

      setCharacter(updated);
      setCombat({ ...combat, monsters, luckUsedThisRound: true });
      setLastLuckOutcome({ context, success, roll });
      persist(updated, currentSectionId);
    },
    [character, combat, currentSectionId, persist, ruleSet],
  );

  const restart = useCallback(() => {
    clearGame(book.id);
    setCharacter(null);
    setCurrentSectionId(book.startSection);
    setCombat(undefined);
    setHistory([]);
  }, [book.id, book.startSection]);

  const choices = useMemo(
    () => (character && currentSection ? availableChoices(character, currentSection.choices) : []),
    [character, currentSection],
  );

  const combatResolved = combat ? combat.monsters.every((m) => m.currentDamageStat <= 0) : true;

  return {
    ruleSet,
    character,
    currentSection,
    choices,
    combat,
    combatResolved,
    lastLuckOutcome,
    history,
    hasSave,
    startNewGame,
    resumeSavedGame,
    choose,
    goToParagraph,
    canGoBack,
    goBack,
    fightRound,
    fleeCombat,
    useLuckOnRound,
    restart,
    isAlive: character ? isAlive(character, ruleSet) : true,
  };
}
