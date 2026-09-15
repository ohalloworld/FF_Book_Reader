import { standardRuleSet } from "./standardRuleSet";
import { listSavedRuleSets } from "./storage";
import type { Gamebook, LibraryBookEntry, RuleSet } from "./types";

/** Every RuleSet a new library book can be created against: the built-in
 * standard rules plus anything imported and saved from the rules importer. */
export function availableRuleSets(): RuleSet[] {
  return [standardRuleSet, ...listSavedRuleSets()];
}

export function resolveRuleSet(ruleSetId: string): RuleSet | undefined {
  return availableRuleSets().find((rs) => rs.id === ruleSetId);
}

/** Builds a playable Gamebook for a library entry. There's no authored
 * story graph — every section falls back to the blank placeholder — so
 * the book is played in companion mode alongside the reader's own copy. */
export function buildGamebook(entry: LibraryBookEntry, ruleSet: RuleSet): Gamebook {
  return {
    id: entry.id,
    title: entry.title,
    author: entry.author ?? "",
    startSection: entry.startSection || "1",
    ruleSet,
    sections: {},
  };
}
