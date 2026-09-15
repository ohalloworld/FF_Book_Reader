import type { Character, LibraryBookEntry, RuleSet, SectionId } from "./types";

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

/** A small indexed collection of JSON records in localStorage: an index
 * key holding an array of ids, plus one key per record. Used for both
 * saved RuleSets and library books, which share this exact shape. */
function listIndexed<T>(indexKey: string, itemPrefix: string): T[] {
  try {
    const raw = localStorage.getItem(indexKey);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    return ids
      .map((id) => {
        const item = localStorage.getItem(itemPrefix + id);
        return item ? (JSON.parse(item) as T) : null;
      })
      .filter((r): r is T => r !== null);
  } catch {
    return [];
  }
}

function saveIndexed(indexKey: string, itemPrefix: string, id: string, value: unknown): void {
  try {
    localStorage.setItem(itemPrefix + id, JSON.stringify(value));
    const raw = localStorage.getItem(indexKey);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(id)) {
      localStorage.setItem(indexKey, JSON.stringify([...ids, id]));
    }
  } catch {
    // ignore
  }
}

function deleteIndexed(indexKey: string, itemPrefix: string, id: string): void {
  try {
    localStorage.removeItem(itemPrefix + id);
    const raw = localStorage.getItem(indexKey);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(indexKey, JSON.stringify(ids.filter((i) => i !== id)));
  } catch {
    // ignore
  }
}

const RULESET_INDEX_KEY = "ff-reader:rulesets:index";
const RULESET_PREFIX = "ff-reader:ruleset:";

export const listSavedRuleSets = (): RuleSet[] => listIndexed<RuleSet>(RULESET_INDEX_KEY, RULESET_PREFIX);
export const saveRuleSet = (ruleSet: RuleSet): void => saveIndexed(RULESET_INDEX_KEY, RULESET_PREFIX, ruleSet.id, ruleSet);
export const deleteRuleSet = (id: string): void => deleteIndexed(RULESET_INDEX_KEY, RULESET_PREFIX, id);

const LIBRARY_INDEX_KEY = "ff-reader:library:index";
const LIBRARY_PREFIX = "ff-reader:library:";

export const listLibraryBooks = (): LibraryBookEntry[] => listIndexed<LibraryBookEntry>(LIBRARY_INDEX_KEY, LIBRARY_PREFIX);
export const saveLibraryBook = (entry: LibraryBookEntry): void => saveIndexed(LIBRARY_INDEX_KEY, LIBRARY_PREFIX, entry.id, entry);
export const deleteLibraryBook = (id: string): void => deleteIndexed(LIBRARY_INDEX_KEY, LIBRARY_PREFIX, id);
