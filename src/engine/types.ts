// Core data model for a gamebook. A "Gamebook" is a graph of numbered
// Sections (matching the original books' numbered paragraphs). The reader
// UI walks this graph one Section at a time; the GameState carries
// character stats, inventory, and story flags between sections.

export type SectionId = string;

export interface StatBlock {
  initial: number;
  current: number;
}

export interface Character {
  name: string;
  skill: StatBlock;
  stamina: StatBlock;
  luck: StatBlock;
  gold: number;
  provisions: number;
  inventory: string[];
  flags: Record<string, boolean | number>;
}

export interface Monster {
  id: string;
  name: string;
  skill: number;
  stamina: number;
}

/** A single combat encounter attached to a section. Player fights monsters
 * in order; the section can't be left via its choices until resolved
 * (unless a choice explicitly allows fleeing). */
export interface Encounter {
  monsters: Monster[];
  /** Section to go to if the player is defeated (stamina hits 0). */
  onDefeatGoTo?: SectionId;
  /** If set, a "flee" option is offered mid-combat, going to this section. */
  fleeGoTo?: SectionId;
}

export type Condition =
  | { type: "hasItem"; item: string }
  | { type: "notHasItem"; item: string }
  | { type: "flag"; key: string; equals: boolean | number }
  | { type: "statAtLeast"; stat: "skill" | "stamina" | "luck" | "gold"; value: number };

export interface Choice {
  text: string;
  to: SectionId;
  condition?: Condition;
}

export type Effect =
  | { type: "addItem"; item: string }
  | { type: "removeItem"; item: string }
  | { type: "setFlag"; key: string; value: boolean | number }
  | { type: "adjustStat"; stat: "skill" | "stamina" | "luck" | "gold" | "provisions"; delta: number };

/** An automatic dice test resolved on arrival, branching by pass/fail.
 * Models FF's "Test your Luck/Skill" paragraphs. */
export interface Test {
  type: "luck" | "skill";
  passGoTo: SectionId;
  failGoTo: SectionId;
  /** Effects applied regardless of outcome (e.g. luck always ticks down). */
  effects?: Effect[];
}

export interface Section {
  id: SectionId;
  text: string;
  /** Effects applied once, the moment this section is entered. */
  onEnter?: Effect[];
  encounter?: Encounter;
  test?: Test;
  choices: Choice[];
  ending?: "victory" | "death";
}

export interface Gamebook {
  id: string;
  title: string;
  author: string;
  startSection: SectionId;
  sections: Record<SectionId, Section>;
}
