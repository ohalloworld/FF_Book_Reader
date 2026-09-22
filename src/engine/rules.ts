import { rollFormula } from "./dice";
import type { AbilityDefinition, Character, Choice, Condition, Effect, RuleSet } from "./types";

export function generateCharacter(ruleSet: RuleSet, name: string): Character {
  const character: Character = { name, pools: {}, counters: {}, inventory: [], flags: {} };
  for (const stat of ruleSet.stats) {
    const value = rollFormula(stat.generation);
    if (stat.kind === "pool") {
      character.pools[stat.key] = { current: value, initial: value };
    } else {
      character.counters[stat.key] = value;
    }
  }
  if (ruleSet.startingInventory) {
    character.inventory = [...ruleSet.startingInventory];
  }
  return character;
}

export function cloneCharacter(character: Character): Character {
  return {
    ...character,
    pools: Object.fromEntries(Object.entries(character.pools).map(([k, v]) => [k, { ...v }])),
    counters: { ...character.counters },
    inventory: [...character.inventory],
    flags: { ...character.flags },
  };
}

export function checkCondition(character: Character, condition: Condition): boolean {
  switch (condition.type) {
    case "hasItem":
      return character.inventory.includes(condition.item);
    case "notHasItem":
      return !character.inventory.includes(condition.item);
    case "flag":
      return (character.flags[condition.key] ?? false) === condition.equals;
    case "poolAtLeast":
      return (character.pools[condition.stat]?.current ?? 0) >= condition.value;
    case "counterAtLeast":
      return (character.counters[condition.stat] ?? 0) >= condition.value;
  }
}

export function availableChoices(character: Character, choices: Choice[]): Choice[] {
  return choices.filter((c) => !c.condition || checkCondition(character, c.condition));
}

export function applyEffect(character: Character, effect: Effect): void {
  switch (effect.type) {
    case "addItem":
      if (!character.inventory.includes(effect.item)) {
        character.inventory = [...character.inventory, effect.item];
      }
      break;
    case "removeItem":
      character.inventory = character.inventory.filter((i) => i !== effect.item);
      break;
    case "setFlag":
      character.flags = { ...character.flags, [effect.key]: effect.value };
      break;
    case "adjustPool": {
      const block = character.pools[effect.stat];
      if (!block) break;
      const next = Math.min(block.initial, Math.max(0, block.current + effect.delta));
      character.pools = { ...character.pools, [effect.stat]: { ...block, current: next } };
      break;
    }
    case "adjustPoolMax": {
      const block = character.pools[effect.stat];
      if (!block) break;
      const nextInitial = Math.max(1, block.initial + effect.delta);
      const nextCurrent = Math.min(nextInitial, Math.max(0, block.current + effect.delta));
      character.pools = { ...character.pools, [effect.stat]: { current: nextCurrent, initial: nextInitial } };
      break;
    }
    case "adjustCounter": {
      const current = character.counters[effect.stat] ?? 0;
      character.counters = { ...character.counters, [effect.stat]: Math.max(0, current + effect.delta) };
      break;
    }
  }
}

export function applyEffects(character: Character, effects: Effect[] | undefined): void {
  if (!effects) return;
  for (const effect of effects) applyEffect(character, effect);
}

export function isAlive(character: Character, ruleSet: RuleSet): boolean {
  return (character.pools[ruleSet.combat.damageStat]?.current ?? 1) > 0;
}

/** Deducts an ability's cost (a spell's Magic Points, a starship weapon's
 * Fuel...) from whichever stat pays for it — a pool or a counter, however
 * that stat's defined. A no-op for a free ability (no costStatKey) or one
 * whose cost stat doesn't exist on this RuleSet. Mutates `character`
 * in place, same convention as applyEffect — callers clone first. */
export function spendAbilityCost(character: Character, ruleSet: RuleSet, ability: AbilityDefinition): void {
  if (!ability.costStatKey || !ability.costAmount) return;
  const stat = ruleSet.stats.find((s) => s.key === ability.costStatKey);
  if (!stat) return;
  applyEffect(
    character,
    stat.kind === "counter"
      ? { type: "adjustCounter", stat: ability.costStatKey, delta: -ability.costAmount }
      : { type: "adjustPool", stat: ability.costStatKey, delta: -ability.costAmount },
  );
}
