import { useCallback, useMemo, useState } from "react";
import {
  findTest,
  noCombatModifiers,
  resolveCombatRound,
  resolveTest,
  rollMonsterAttackStrength,
  type CombatModifiers,
  type CombatRoundResult,
} from "./combat";
import { applyEffect, applyEffects, availableChoices, cloneCharacter, isAlive, spendAbilityCost } from "./rules";
import { clearGame, loadGame, saveGame } from "./storage";
import type { Character, Choice, Gamebook, Monster, MultiMonsterMode, Section, SectionId } from "./types";

export interface CombatMonsterState extends Monster {
  currentDamageStat: number;
}

/** A round's result, plus any other living monster that also landed a hit
 * this round (see fightRound) — every monster the player isn't targeting
 * still swings at them, using the player's same Attack Strength roll. */
export interface CombatRoundSummary extends CombatRoundResult {
  additionalAttackers?: string[];
}

export interface CombatState {
  monsters: CombatMonsterState[];
  fleeGoTo?: SectionId;
  onDefeatGoTo?: SectionId;
  lastRound?: CombatRoundSummary;
  luckUsedThisRound?: boolean;
  /** Flat Attack Strength adjustments for this fight — set from the Combat
   * panel for a book's own encounter modifiers, applied every round. */
  modifiers: CombatModifiers;
  /** "sequential" (the FF standard) — only the current monster fights
   * back, in order; "simultaneous" — every living monster attacks every
   * round. Picked per-fight since the real rule varies by book. */
  mode: MultiMonsterMode;
  /** True for a combat started manually (Companion Tools) rather than
   * from an authored Section.encounter — changes how "Flee" behaves. */
  manual?: boolean;
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
    modifiers: noCombatModifiers,
    mode: section.encounter.multiMonsterMode ?? "sequential",
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

  /** Starts a new game with an already-rolled character — the caller
   * rolls (and lets the player reroll) via engine/rules.generateCharacter
   * before calling this, so the reveal screen and the actual game state
   * always agree on the stats rolled. */
  const startNewGameWithCharacter = useCallback(
    (char: Character) => {
      clearGame(book.id);
      setHistory([]);
      enterSection(book.startSection, char);
    },
    [book.id, book.startSection, enterSection],
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

      const result = resolveCombatRound(character, monster, ruleSet.combat, combat.modifiers);

      // "simultaneous" mode: every OTHER living monster in the encounter
      // still swings at the player this round, not just the one being
      // fought — each rolls its own Attack Strength against the player's
      // roll from this round. "sequential" (the FF standard) skips this —
      // only the monster actually being fought poses any threat; the rest
      // wait their turn (see CombatPanel, which only shows an Attack
      // button for the current one in that mode).
      let totalDamageTaken = result.damageTaken;
      const additionalAttackers: string[] = [];
      if (combat.mode === "simultaneous") {
        for (const other of combat.monsters) {
          if (other.id === monsterId || other.currentDamageStat <= 0) continue;
          const otherAttackStrength = rollMonsterAttackStrength(other, ruleSet.combat, combat.modifiers.monster);
          if (otherAttackStrength > result.playerAttackStrength) {
            totalDamageTaken += ruleSet.combat.damagePerHit;
            additionalAttackers.push(other.name);
          }
        }
      }

      const updatedChar = cloneCharacter(character);
      const playerBlock = updatedChar.pools[ruleSet.combat.damageStat];
      if (playerBlock) {
        updatedChar.pools = {
          ...updatedChar.pools,
          [ruleSet.combat.damageStat]: {
            ...playerBlock,
            current: Math.max(0, playerBlock.current - totalDamageTaken),
          },
        };
      }

      const updatedMonsters = combat.monsters.map((m) =>
        m.id === monsterId
          ? { ...m, currentDamageStat: Math.max(0, m.currentDamageStat - result.damageDealt) }
          : m,
      );

      setCharacter(updatedChar);
      setCombat({
        ...combat,
        monsters: updatedMonsters,
        lastRound: { ...result, additionalAttackers },
        luckUsedThisRound: false,
      });
      persist(updatedChar, currentSectionId);

      if (!isAlive(updatedChar, ruleSet) && combat.onDefeatGoTo) {
        enterSection(combat.onDefeatGoTo, updatedChar);
      }
    },
    [character, combat, currentSectionId, enterSection, persist, ruleSet],
  );

  /** Adjusts a flat Attack Strength modifier for the rest of this fight —
   * for a book's own encounter modifiers ("+2 for the ambush", "-1 in the
   * dark"), applied to every subsequent round until changed or the fight
   * ends. */
  const adjustCombatModifier = useCallback((side: keyof CombatModifiers, delta: number) => {
    setCombat((prev) => (prev ? { ...prev, modifiers: { ...prev.modifiers, [side]: prev.modifiers[side] + delta } } : prev));
  }, []);

  const fleeCombat = useCallback(() => {
    if (!character || !combat?.fleeGoTo) return;
    enterSection(combat.fleeGoTo, character);
  }, [character, combat, enterSection]);

  /** Ends a manually-started combat without navigating anywhere — there's
   * no section graph to flee "to" for an ad-hoc fight. */
  const endCombat = useCallback(() => {
    setCombat(undefined);
  }, []);

  /** Starts a combat against one or more monsters the reader types in
   * themselves, for a book whose encounters aren't digitized. No
   * fleeGoTo/onDefeatGoTo — there's nowhere authored to send the player,
   * so fleeing just ends the fight (endCombat) and a defeat just leaves
   * STAMINA at 0 for the reader to act on themselves. */
  const startManualCombat = useCallback(
    (monsters: { name: string; stats: Record<string, number> }[], mode: MultiMonsterMode = "sequential") => {
      if (monsters.length === 0) return;
      setCombat({
        monsters: monsters.map((monster, i) => ({
          id: `manual-${Date.now()}-${i}`,
          name: monster.name,
          stats: monster.stats,
          currentDamageStat: monster.stats[ruleSet.combat.damageStat] ?? 0,
        })),
        modifiers: noCombatModifiers,
        mode,
        manual: true,
      });
      setLastLuckOutcome(null);
    },
    [ruleSet],
  );

  /** Rolls one of the book's named tests (Luck, Skill, ...) on demand,
   * outside of any authored Section.test — for tracking a real book's own
   * "Test your Luck" instructions as you read them. */
  const rollTest = useCallback(
    (testKey: string) => {
      if (!character) return;
      const test = findTest(ruleSet, testKey);
      if (!test) return;

      const result = resolveTest(character, test);
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

      setCharacter(updated);
      setLastLuckOutcome({ context: "general", success: result.success, roll: result.roll });
      persist(updated, currentSectionId);
    },
    [character, currentSectionId, persist, ruleSet],
  );

  const adjustPool = useCallback(
    (statKey: string, delta: number) => {
      if (!character) return;
      const updated = cloneCharacter(character);
      applyEffect(updated, { type: "adjustPool", stat: statKey, delta });
      setCharacter(updated);
      persist(updated, currentSectionId);
    },
    [character, currentSectionId, persist],
  );

  const adjustPoolMax = useCallback(
    (statKey: string, delta: number) => {
      if (!character) return;
      const updated = cloneCharacter(character);
      applyEffect(updated, { type: "adjustPoolMax", stat: statKey, delta });
      setCharacter(updated);
      persist(updated, currentSectionId);
    },
    [character, currentSectionId, persist],
  );

  const adjustCounter = useCallback(
    (statKey: string, delta: number) => {
      if (!character) return;
      const updated = cloneCharacter(character);
      applyEffect(updated, { type: "adjustCounter", stat: statKey, delta });
      setCharacter(updated);
      persist(updated, currentSectionId);
    },
    [character, currentSectionId, persist],
  );

  const useAbilityAction = useCallback(
    (abilityKey: string) => {
      if (!character) return;
      const ability = ruleSet.abilities?.find((a) => a.key === abilityKey);
      if (!ability) return;
      const updated = cloneCharacter(character);
      spendAbilityCost(updated, ruleSet, ability);
      setCharacter(updated);
      persist(updated, currentSectionId);
    },
    [character, currentSectionId, persist, ruleSet],
  );

  const addItem = useCallback(
    (item: string) => {
      const trimmed = item.trim();
      if (!character || !trimmed) return;
      const updated = cloneCharacter(character);
      applyEffect(updated, { type: "addItem", item: trimmed });
      setCharacter(updated);
      persist(updated, currentSectionId);
    },
    [character, currentSectionId, persist],
  );

  const removeItem = useCallback(
    (item: string) => {
      if (!character) return;
      const updated = cloneCharacter(character);
      applyEffect(updated, { type: "removeItem", item });
      setCharacter(updated);
      persist(updated, currentSectionId);
    },
    [character, currentSectionId, persist],
  );

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
    startNewGameWithCharacter,
    resumeSavedGame,
    choose,
    goToParagraph,
    canGoBack,
    goBack,
    fightRound,
    fleeCombat,
    endCombat,
    startManualCombat,
    adjustCombatModifier,
    rollTest,
    adjustPool,
    adjustPoolMax,
    adjustCounter,
    useAbility: useAbilityAction,
    addItem,
    removeItem,
    useLuckOnRound,
    restart,
    isAlive: character ? isAlive(character, ruleSet) : true,
  };
}
