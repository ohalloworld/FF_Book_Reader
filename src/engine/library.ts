import { standardRuleSet } from "./standardRuleSet";
import { getBookOverrides, getBookPages, listSavedRuleSets } from "./storage";
import type { Gamebook, LibraryBookEntry, RuleSet, Section, SectionId, TranscribedParagraph } from "./types";

/** Every RuleSet a new library book can be created against: the built-in
 * standard rules plus anything imported and saved from the rules importer. */
export function availableRuleSets(): RuleSet[] {
  return [standardRuleSet, ...listSavedRuleSets()];
}

export function resolveRuleSet(ruleSetId: string): RuleSet | undefined {
  return availableRuleSets().find((rs) => rs.id === ruleSetId);
}

function toSection(paragraph: TranscribedParagraph): Section {
  return {
    id: paragraph.id,
    text: paragraph.text,
    choices: paragraph.choices.map((c) => ({ text: c.text, to: c.to })),
  };
}

/** Flattens every transcribed page (and any manual corrections) into a
 * Section graph. A paragraph can appear on more than one transcribed page
 * if the reader re-transcribes to fix a bad read — the longest text wins,
 * on the assumption a fuller capture beats a truncated one; a manual
 * override always wins over either. */
export function deriveBookSections(bookId: string): Record<SectionId, Section> {
  const pages = getBookPages(bookId);
  const overrides = getBookOverrides(bookId);

  const merged: Record<SectionId, TranscribedParagraph> = {};
  for (const page of Object.values(pages)) {
    for (const paragraph of page.paragraphs) {
      const existing = merged[paragraph.id];
      if (!existing || paragraph.text.length > existing.text.length) {
        merged[paragraph.id] = paragraph;
      }
    }
  }
  for (const paragraph of Object.values(overrides)) {
    merged[paragraph.id] = paragraph;
  }

  const sections: Record<SectionId, Section> = {};
  for (const paragraph of Object.values(merged)) {
    sections[paragraph.id] = toSection(paragraph);
  }
  return sections;
}

/** Finds which PDF page a transcribed paragraph came from, so its page
 * scan (artwork included) can be looked up and shown alongside the text.
 * Undefined for a manually-typed/edited paragraph with no source page, or
 * one that isn't transcribed yet. */
export function findPageForParagraph(bookId: string, paragraphId: SectionId): number | undefined {
  const pages = getBookPages(bookId);
  for (const page of Object.values(pages)) {
    if (page.paragraphs.some((p) => p.id === paragraphId)) return page.pdfPage;
  }
  return undefined;
}

/** Builds a playable Gamebook for a library entry, filling in any sections
 * that have been transcribed from its attached PDF so far. Anything not
 * yet transcribed still falls back to the blank placeholder in
 * useGameSession, same as a book with no PDF at all. */
export function buildGamebook(entry: LibraryBookEntry, ruleSet: RuleSet): Gamebook {
  return {
    id: entry.id,
    title: entry.title,
    author: entry.author ?? "",
    startSection: entry.startSection || "1",
    ruleSet,
    sections: deriveBookSections(entry.id),
    isLibraryBook: true,
  };
}
