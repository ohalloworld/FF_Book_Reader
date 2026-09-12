import type { Character, SectionId } from "./types";

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
