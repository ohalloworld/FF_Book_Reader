import { useCallback, useMemo, useState } from "react";
import { resolveCombatRound, testLuck, testSkill, type CombatRoundResult } from "./combat";
import { generateStats } from "./dice";
import { applyEffects, availableChoices, isAlive } from "./rules";
import { clearGame, loadGame, saveGame } from "./storage";
import type { Character, Choice, Gamebook, Monster, Section, SectionId } from "./types";

export interface CombatMonsterState extends Monster {
  currentStamina: number;
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

function freshCharacter(name: string): Character {
  const stats = generateStats();
  return {
    name,
    skill: { initial: stats.skill, current: stats.skill },
    stamina: { initial: stats.stamina, current: stats.stamina },
    luck: { initial: stats.luck, current: stats.luck },
    gold: 0,
    provisions: 10,
    inventory: [],
    flags: {},
  };
}

function cloneCharacter(character: Character): Character {
  return {
    ...character,
    skill: { ...character.skill },
    stamina: { ...character.stamina },
    luck: { ...character.luck },
    inventory: [...character.inventory],
    flags: { ...character.flags },
  };
}

function startCombat(section: Section): CombatState | undefined {
  if (!section.encounter) return undefined;
  return {
    monsters: section.encounter.monsters.map((m) => ({ ...m, currentStamina: m.stamina })),
    fleeGoTo: section.encounter.fleeGoTo,
    onDefeatGoTo: section.encounter.onDefeatGoTo,
  };
}

export function useGameSession(book: Gamebook) {
  const hasSave = useMemo(() => loadGame(book.id) !== null, [book.id]);

  const [character, setCharacter] = useState<Character | null>(null);
  const [currentSectionId, setCurrentSectionId] = useState<SectionId>(book.startSection);
  const [combat, setCombat] = useState<CombatState | undefined>(undefined);
  const [lastLuckOutcome, setLastLuckOutcome] = useState<LuckOutcome | null>(null);
  const [history, setHistory] = useState<SectionId[]>([]);

  const currentSection = book.sections[currentSectionId];

  const persist = useCallback(
    (char: Character, sectionId: SectionId) => {
      saveGame({ bookId: book.id, character: char, currentSectionId: sectionId, savedAt: new Date().toISOString() });
    },
    [book.id],
  );

  const enterSection = useCallback(
    (sectionId: SectionId, char: Character) => {
      const section = book.sections[sectionId];
      if (!section) {
        throw new Error(`Unknown section: ${sectionId}`);
      }
      const updated = cloneCharacter(char);
      applyEffects(updated, section.onEnter);

      let resolvedSectionId = sectionId;
      let resolvedSection = section;

      // Auto-resolve a dice test on arrival (e.g. "Test your Luck").
      if (section.test) {
        const result = section.test.type === "luck" ? testLuck(updated) : testSkill(updated);
        applyEffects(updated, section.test.effects);
        resolvedSectionId = result.success ? section.test.passGoTo : section.test.failGoTo;
        resolvedSection = book.sections[resolvedSectionId];
        setLastLuckOutcome({
          context: "general",
          success: result.success,
          roll: result.roll,
        });
      } else {
        setLastLuckOutcome(null);
      }

      setCharacter(updated);
      setCurrentSectionId(resolvedSectionId);
      setCombat(startCombat(resolvedSection));
      setHistory((h) => [...h, resolvedSectionId]);
      persist(updated, resolvedSectionId);
    },
    [book.sections, persist],
  );

  const startNewGame = useCallback(
    (name: string) => {
      const char = freshCharacter(name || "Adventurer");
      clearGame(book.id);
      setHistory([]);
      enterSection(book.startSection, char);
    },
    [book.id, book.startSection, enterSection],
  );

  const resumeSavedGame = useCallback(() => {
    const save = loadGame(book.id);
    if (!save) return;
    const section = book.sections[save.currentSectionId];
    setCharacter(save.character);
    setCurrentSectionId(save.currentSectionId);
    setCombat(startCombat(section));
    setHistory([save.currentSectionId]);
  }, [book.id, book.sections]);

  const choose = useCallback(
    (choice: Choice) => {
      if (!character) return;
      enterSection(choice.to, character);
    },
    [character, enterSection],
  );

  const fightRound = useCallback(
    (monsterId: string) => {
      if (!character || !combat) return;
      const monster = combat.monsters.find((m) => m.id === monsterId);
      if (!monster || monster.currentStamina <= 0) return;

      const result = resolveCombatRound(character, monster);
      const updatedChar = cloneCharacter(character);
      updatedChar.stamina.current = Math.max(0, updatedChar.stamina.current - result.damageTaken);

      const updatedMonsters = combat.monsters.map((m) =>
        m.id === monsterId
          ? { ...m, currentStamina: Math.max(0, m.currentStamina - result.damageDealt) }
          : m,
      );

      setCharacter(updatedChar);
      setCombat({ ...combat, monsters: updatedMonsters, lastRound: result, luckUsedThisRound: false });
      persist(updatedChar, currentSectionId);

      if (!isAlive(updatedChar) && combat.onDefeatGoTo) {
        enterSection(combat.onDefeatGoTo, updatedChar);
      }
    },
    [character, combat, currentSectionId, enterSection, persist],
  );

  const fleeCombat = useCallback(() => {
    if (!character || !combat?.fleeGoTo) return;
    enterSection(combat.fleeGoTo, character);
  }, [character, combat, enterSection]);

  const useLuckOnRound = useCallback(
    (context: LuckOutcomeContext) => {
      if (!character || !combat?.lastRound || combat.luckUsedThisRound) return;
      const { success, roll } = testLuck(character);
      const updated = cloneCharacter(character);
      updated.luck.current = Math.max(0, updated.luck.current - 1);

      const round = combat.lastRound;
      let monsters = combat.monsters;
      if (round.outcome === "player") {
        // Lucky doubles the extra damage; unlucky halves it back.
        const extra = success ? 1 : -1;
        monsters = monsters.map((m) =>
          m.id === round.monsterId ? { ...m, currentStamina: Math.max(0, m.currentStamina - extra) } : m,
        );
      } else if (round.outcome === "monster") {
        const relief = success ? 1 : -1;
        updated.stamina.current = Math.min(updated.stamina.initial, Math.max(0, updated.stamina.current + relief));
      }

      setCharacter(updated);
      setCombat({ ...combat, monsters, luckUsedThisRound: true });
      setLastLuckOutcome({ context, success, roll });
      persist(updated, currentSectionId);
    },
    [character, combat, currentSectionId, persist],
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

  const combatResolved = combat ? combat.monsters.every((m) => m.currentStamina <= 0) : true;

  return {
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
    fightRound,
    fleeCombat,
    useLuckOnRound,
    restart,
    isAlive: character ? isAlive(character) : true,
  };
}
