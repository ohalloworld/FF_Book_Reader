import type { DiceFormula } from "./types";

export function rollDie(): number {
  return 1 + Math.floor(Math.random() * 6);
}

export function sumDice(count: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += rollDie();
  return total;
}

const FORMULA_RE = /^(\d*)D(\d+)\s*([+-]\s*\d+)?$/i;

/** Evaluates a dice formula like "1D6+6", "2D6", "3D6-2", or a flat "12". */
export function rollFormula(formula: DiceFormula): number {
  const trimmed = formula.trim();

  const flat = Number(trimmed);
  if (!Number.isNaN(flat) && trimmed !== "") return flat;

  const match = FORMULA_RE.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid dice formula: "${formula}"`);
  }
  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3].replace(/\s+/g, ""), 10) : 0;

  let total = modifier;
  for (let i = 0; i < count; i++) {
    total += 1 + Math.floor(Math.random() * sides);
  }
  return total;
}
