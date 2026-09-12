import { sumDice } from "./dice";
import type { Character, Monster } from "./types";

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

const DEFAULT_DAMAGE = 2;

/** Resolves one round of combat between the player and a single monster,
 * following the standard FF rule: both sides roll 2d6 and add SKILL to get
 * an Attack Strength; the lower side takes damage (a draw does nothing). */
export function resolveCombatRound(character: Character, monster: Monster): CombatRoundResult {
  const playerRoll = sumDice(2);
  const monsterRoll = sumDice(2);
  const playerAttackStrength = playerRoll + character.skill.current;
  const monsterAttackStrength = monsterRoll + monster.skill;

  let outcome: CombatRoundResult["outcome"] = "draw";
  let damageDealt = 0;
  let damageTaken = 0;

  if (playerAttackStrength > monsterAttackStrength) {
    outcome = "player";
    damageDealt = DEFAULT_DAMAGE;
  } else if (monsterAttackStrength > playerAttackStrength) {
    outcome = "monster";
    damageTaken = DEFAULT_DAMAGE;
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

export function testLuck(character: Character): { success: boolean; roll: number } {
  const roll = sumDice(2);
  const success = roll <= character.luck.current;
  return { success, roll };
}

export function testSkill(character: Character): { success: boolean; roll: number } {
  const roll = sumDice(2);
  const success = roll <= character.skill.current;
  return { success, roll };
}
