import type { Character, Choice, Condition, Effect } from "./types";

export function checkCondition(character: Character, condition: Condition): boolean {
  switch (condition.type) {
    case "hasItem":
      return character.inventory.includes(condition.item);
    case "notHasItem":
      return !character.inventory.includes(condition.item);
    case "flag":
      return (character.flags[condition.key] ?? false) === condition.equals;
    case "statAtLeast": {
      const value = condition.stat === "gold" ? character.gold : character[condition.stat].current;
      return value >= condition.value;
    }
  }
}

export function availableChoices(character: Character, choices: Choice[]): Choice[] {
  return choices.filter((c) => !c.condition || checkCondition(character, c.condition));
}

/** Applies an effect in place and returns the same character for chaining. */
export function applyEffect(character: Character, effect: Effect): Character {
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
    case "adjustStat": {
      if (effect.stat === "gold" || effect.stat === "provisions") {
        character[effect.stat] = Math.max(0, character[effect.stat] + effect.delta);
      } else {
        const block = character[effect.stat];
        const next = Math.min(block.initial, Math.max(0, block.current + effect.delta));
        character[effect.stat] = { ...block, current: next };
      }
      break;
    }
  }
  return character;
}

export function applyEffects(character: Character, effects: Effect[] | undefined): Character {
  if (!effects) return character;
  return effects.reduce((c, e) => applyEffect(c, e), character);
}

export function isAlive(character: Character): boolean {
  return character.stamina.current > 0;
}
