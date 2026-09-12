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

/** Resolves one round of combat between the player and a single monster,
 * driven entirely by the book's own CombatRules (both sides roll the same
 * formula, add their attackStat, and the loser's damageStat drops). */
export function resolveCombatRound(
  character: Character,
  monster: Monster,
  combat: CombatRules,
): CombatRoundResult {
  const playerRoll = rollFormula(combat.rollFormula);
  const monsterRoll = rollFormula(combat.rollFormula);
  const playerAttackStrength = playerRoll + (character.pools[combat.attackStat]?.current ?? 0);
  const monsterAttackStrength = monsterRoll + (monster.stats[combat.attackStat] ?? 0);

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

export function resolveTest(character: Character, test: TestDefinition): { success: boolean; roll: number } {
  const roll = rollFormula(test.rollFormula);
  const stat = character.pools[test.statKey]?.current ?? 0;
  const success = test.successWhen === "lte" ? roll <= stat : roll >= stat;
  return { success, roll };
}

export function findTest(ruleSet: RuleSet, key: string): TestDefinition | undefined {
  return ruleSet.tests.find((t) => t.key === key);
}
