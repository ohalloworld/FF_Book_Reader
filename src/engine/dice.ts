export function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

export function rollDice(count: number): number[] {
  return Array.from({ length: count }, rollDie);
}

export function sumDice(count: number): number {
  return rollDice(count).reduce((a, b) => a + b, 0);
}

/** Standard FF stat generation: SKILL 1d6+6, STAMINA 2d6+12, LUCK 1d6+12. */
export function generateStats() {
  return {
    skill: sumDice(1) + 6,
    stamina: sumDice(2) + 12,
    luck: sumDice(1) + 12,
  };
}
