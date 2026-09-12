import type { RuleSet } from "./types";

/** The classic Fighting Fantasy ruleset (Warlock of Firetop Mountain and
 * most early titles): SKILL/STAMINA/LUCK, 2D6+SKILL combat, Luck tests. */
export const standardRuleSet: RuleSet = {
  id: "standard-ff",
  bookTitle: "Standard Fighting Fantasy Rules",
  stats: [
    { key: "skill", label: "SKILL", kind: "pool", generation: "1D6+6" },
    { key: "stamina", label: "STAMINA", kind: "pool", generation: "2D6+12" },
    { key: "luck", label: "LUCK", kind: "pool", generation: "1D6+12" },
    { key: "gold", label: "Gold", kind: "counter", generation: "0" },
    { key: "provisions", label: "Provisions", kind: "counter", generation: "10" },
  ],
  tests: [
    { key: "luck", label: "Test your Luck", statKey: "luck", rollFormula: "2D6", successWhen: "lte", decrementStatOnUse: 1 },
    { key: "skill", label: "Test your Skill", statKey: "skill", rollFormula: "2D6", successWhen: "lte" },
  ],
  combat: {
    rollFormula: "2D6",
    attackStat: "skill",
    damageStat: "stamina",
    damagePerHit: 2,
    luckTestKey: "luck",
    luckExtraDamage: 1,
  },
  specialRules: [],
  source: "standard",
};
