import type { Character, RuleSet, SectionId } from "./types";

export interface SavedGame {
  bookId: string;
  character: Character;
  currentSectionId: SectionId;
  savedAt: string;
}

const KEY_PREFIX = "ff-reader:save:";

export function saveGame(save: SavedGame): void {
  try {
    localStorage.setItem(KEY_PREFIX + save.bookId, JSON.stringify(save));
  } catch {
    // Storage unavailable (private browsing, quota) — progress just won't persist.
  }
}

export function loadGame(bookId: string): SavedGame | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + bookId);
    return raw ? (JSON.parse(raw) as SavedGame) : null;
  } catch {
    return null;
  }
}

export function clearGame(bookId: string): void {
  try {
    localStorage.removeItem(KEY_PREFIX + bookId);
  } catch {
    // ignore
  }
}

const RULESET_INDEX_KEY = "ff-reader:rulesets:index";
const RULESET_PREFIX = "ff-reader:ruleset:";

export function listSavedRuleSets(): RuleSet[] {
  try {
    const raw = localStorage.getItem(RULESET_INDEX_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    return ids
      .map((id) => {
        const item = localStorage.getItem(RULESET_PREFIX + id);
        return item ? (JSON.parse(item) as RuleSet) : null;
      })
      .filter((r): r is RuleSet => r !== null);
  } catch {
    return [];
  }
}

export function saveRuleSet(ruleSet: RuleSet): void {
  try {
    localStorage.setItem(RULESET_PREFIX + ruleSet.id, JSON.stringify(ruleSet));
    const raw = localStorage.getItem(RULESET_INDEX_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(ruleSet.id)) {
      localStorage.setItem(RULESET_INDEX_KEY, JSON.stringify([...ids, ruleSet.id]));
    }
  } catch {
    // ignore
  }
}

export function deleteRuleSet(id: string): void {
  try {
    localStorage.removeItem(RULESET_PREFIX + id);
    const raw = localStorage.getItem(RULESET_INDEX_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(RULESET_INDEX_KEY, JSON.stringify(ids.filter((i) => i !== id)));
  } catch {
    // ignore
  }
}
