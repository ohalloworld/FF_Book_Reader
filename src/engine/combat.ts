import { rollFormula } from "./dice";
import type { Character, CombatRules, Monster, RuleSet, TestDefinition } from "./types";

export interface CombatRoundResult {
  monsterId: string;
  playerRoll: number;
  monsterRoll: number;
  playerAttackStrength: number;
  monsterAttackStrength: number;
  outcome: "player" | "monster" | "draw";
  damageDealt: number;
  damageTaken: number;
}

/** Flat adjustments to Attack Strength, e.g. for a book's own combat
 * modifiers ("the guard gets +2 for reinforcements", "-1 in the dark") —
 * set from the Combat panel and applied every round until changed. */
export interface CombatModifiers {
  player: number;
  monster: number;
}

export const noCombatModifiers: CombatModifiers = { player: 0, monster: 0 };

/** Resolves one round of combat between the player and a single monster,
 * driven entirely by the book's own CombatRules (both sides roll the same
 * formula, add their attackStat and any modifier, and the loser's
 * damageStat drops). */
export function resolveCombatRound(
  character: Character,
  monster: Monster,
  combat: CombatRules,
  modifiers: CombatModifiers = noCombatModifiers,
): CombatRoundResult {
  const playerRoll = rollFormula(combat.rollFormula);
  const monsterRoll = rollFormula(combat.rollFormula);
  const playerAttackStrength = playerRoll + (character.pools[combat.attackStat]?.current ?? 0) + modifiers.player;
  const monsterAttackStrength = monsterRoll + (monster.stats[combat.attackStat] ?? 0) + modifiers.monster;

  let outcome: CombatRoundResult["outcome"] = "draw";
  let damageDealt = 0;
  let damageTaken = 0;

  if (playerAttackStrength > monsterAttackStrength) {
    outcome = "player";
    damageDealt = combat.damagePerHit;
  } else if (monsterAttackStrength > playerAttackStrength) {
    outcome = "monster";
    damageTaken = combat.damagePerHit;
  }

  return {
    monsterId: monster.id,
    playerRoll,
    monsterRoll,
    playerAttackStrength,
    monsterAttackStrength,
    outcome,
    damageDealt,
    damageTaken,
  };
}

/** Rolls one monster's own Attack Strength in isolation, with no player
 * side to compare — used for every monster the player isn't directly
 * targeting this round, so a multi-monster encounter has every living
 * monster swing back each round, not just the one being fought. */
export function rollMonsterAttackStrength(monster: Monster, combat: CombatRules, monsterModifier: number): number {
  const roll = rollFormula(combat.rollFormula);
  return roll + (monster.stats[combat.attackStat] ?? 0) + monsterModifier;
}

export function resolveTest(character: Character, test: TestDefinition): { success: boolean; roll: number } {
  const roll = rollFormula(test.rollFormula);
  const stat = character.pools[test.statKey]?.current ?? 0;
  const success = test.successWhen === "lte" ? roll <= stat : roll >= stat;
  return { success, roll };
}

export function findTest(ruleSet: RuleSet, key: string): TestDefinition | undefined {
  return ruleSet.tests.find((t) => t.key === key);
}
