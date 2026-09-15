// Core data model for a gamebook. A "Gamebook" is a graph of numbered
// Sections (matching the original books' numbered paragraphs), paired with
// a RuleSet describing that book's specific character sheet and mechanics
// (every Fighting Fantasy book varied these to some degree — some added
// stats like Fear or Magic Points, changed combat math, etc). The reader
// UI walks the Section graph one at a time; the GameState carries a
// dynamically-shaped character (driven by the RuleSet) between sections.

export type SectionId = string;

/** A dice expression like "1D6+6", "2D6", "3D6-2", or a flat "0". */
export type DiceFormula = string;

export type StatKind = "pool" | "counter";

/** Defines one entry on the character sheet. "pool" stats (SKILL, STAMINA,
 * LUCK, Magic Points, Fear...) have a current/initial value and a bar.
 * "counter" stats (Gold, Provisions...) are a flat number with no cap. */
export interface StatDefinition {
  key: string;
  label: string;
  kind: StatKind;
  /** How the starting value is generated, e.g. "1D6+6" or a fixed "12". */
  generation: DiceFormula;
  min?: number;
}

export type TestSuccessRule = "lte" | "gte";

/** An automatic dice test, e.g. "Test your Luck" or "Test your Skill". */
export interface TestDefinition {
  key: string;
  label: string;
  statKey: string;
  rollFormula: DiceFormula;
  /** "lte" = success when roll <= stat (standard FF Luck/Skill tests). */
  successWhen: TestSuccessRule;
  /** How much the tested stat drops each time it's used, win or lose. */
  decrementStatOnUse?: number;
}

/** This book's combat resolution rule. Standard FF: both sides roll 2D6,
 * add SKILL for an Attack Strength; the loser's STAMINA drops by 2. */
export interface CombatRules {
  rollFormula: DiceFormula;
  attackStat: string;
  damageStat: string;
  damagePerHit: number;
  /** Optional "Test your Luck" after landing/taking a blow, e.g. LUCK. */
  luckTestKey?: string;
  luckExtraDamage?: number;
}

export interface RuleSet {
  id: string;
  bookTitle: string;
  stats: StatDefinition[];
  tests: TestDefinition[];
  combat: CombatRules;
  startingInventory?: string[];
  /** Rules the parser found but couldn't model structurally (special items,
   * unique per-book mechanics) — shown to the reader as reference text. */
  specialRules: string[];
  /** How this RuleSet came to be, for the user's own reference. */
  source: "standard" | "imported";
}

export interface StatValue {
  current: number;
  initial: number;
}

export interface Character {
  name: string;
  pools: Record<string, StatValue>;
  counters: Record<string, number>;
  inventory: string[];
  flags: Record<string, boolean | number>;
}

/** A monster's stats keyed the same way as the RuleSet's combat.attackStat
 * / combat.damageStat, so combat resolution stays rule-set agnostic. */
export interface Monster {
  id: string;
  name: string;
  stats: Record<string, number>;
}

export interface Encounter {
  monsters: Monster[];
  onDefeatGoTo?: SectionId;
  fleeGoTo?: SectionId;
}

export type Condition =
  | { type: "hasItem"; item: string }
  | { type: "notHasItem"; item: string }
  | { type: "flag"; key: string; equals: boolean | number }
  | { type: "poolAtLeast"; stat: string; value: number }
  | { type: "counterAtLeast"; stat: string; value: number };

export type Effect =
  | { type: "addItem"; item: string }
  | { type: "removeItem"; item: string }
  | { type: "setFlag"; key: string; value: boolean | number }
  | { type: "adjustPool"; stat: string; delta: number }
  | { type: "adjustCounter"; stat: string; delta: number };

export interface Choice {
  text: string;
  to: SectionId;
  condition?: Condition;
}

/** References a RuleSet TestDefinition by key and branches on the result. */
export interface SectionTest {
  testKey: string;
  passGoTo: SectionId;
  failGoTo: SectionId;
  effects?: Effect[];
}

export interface Section {
  id: SectionId;
  text: string;
  onEnter?: Effect[];
  encounter?: Encounter;
  test?: SectionTest;
  choices: Choice[];
  ending?: "victory" | "death";
}

export interface Gamebook {
  id: string;
  title: string;
  author: string;
  startSection: SectionId;
  ruleSet: RuleSet;
  sections: Record<SectionId, Section>;
  /** True for a book built from a Library entry (see engine/library.ts) —
   * its `sections` are derived from transcription/override storage rather
   * than hand-authored, so the reader can safely edit/transcribe into it.
   * Never true for a hand-authored book like the demo, whose `sections`
   * must not be overwritten by that derivation. */
  isLibraryBook?: boolean;
}

/** One paragraph transcribed from a book's PDF via Claude vision, cached
 * per book so it only needs transcribing once. */
export interface TranscribedParagraph {
  id: SectionId;
  text: string;
  choices: { text: string; to: SectionId }[];
}

/** Every paragraph found on one PDF page during a transcription request —
 * a page typically holds several paragraphs, so one request populates
 * several at once. */
export interface TranscribedPage {
  pdfPage: number;
  paragraphs: TranscribedParagraph[];
}

/** A book in the reader's library that has no authored story graph — just
 * a title paired with a RuleSet. Played in "companion mode": every section
 * falls back to the blank placeholder (see useGameSession/lookupSection),
 * and the reader tracks paragraphs, stats, and combat manually while
 * reading the physical/PDF book themselves. */
export interface LibraryBookEntry {
  id: string;
  title: string;
  author?: string;
  ruleSetId: string;
  startSection: SectionId;
}
