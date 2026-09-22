import { useEffect, useState } from "react";
import { slugify } from "../engine/parseRulesApi";
import { availableRuleSets, buildGamebook, resolveRuleSet } from "../engine/library";
import { deleteBookImages } from "../engine/pageImageStore";
import { clearGame, deleteBookData, deleteLibraryBook, getBookPages, listLibraryBooks, saveLibraryBook } from "../engine/storage";
import { attachBookPdf, detachBookPdf, getPdfStatus, type PdfStatus } from "../engine/transcriptionApi";
import type { Gamebook, LibraryBookEntry } from "../engine/types";
import { testBook } from "../data/testBook";
import { BackupPanel } from "./BackupPanel";
import { BulkTranscribeControl } from "./BulkTranscribe";

// Matches MAX_PDF_BYTES in server/bookTranscriptionPlugin.ts. Checked
// here first so an oversized file gets an immediate, friendly, local
// error instead of spending however long it takes to upload the whole
// thing first.
const MAX_PDF_UPLOAD_BYTES = 300 * 1024 * 1024;

function uniqueId(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export function Library({ onPlay }: { onPlay: (book: Gamebook) => void }) {
  const [books, setBooks] = useState<LibraryBookEntry[]>(() => listLibraryBooks());
  const ruleSets = availableRuleSets();
  const [pdfStatuses, setPdfStatuses] = useState<Record<string, PdfStatus>>({});
  const [attaching, setAttaching] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [startSection, setStartSection] = useState("1");
  const [ruleSetId, setRuleSetId] = useState(ruleSets[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(books.map((b) => getPdfStatus(b.id).then((status) => [b.id, status] as const))).then((entries) => {
      if (!cancelled) setPdfStatuses(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [books]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return;
    if (!ruleSetId) {
      setError("Import a rule set first, or pick the standard rules.");
      return;
    }
    const entry: LibraryBookEntry = {
      id: uniqueId(slugify(title), books.map((b) => b.id)),
      title: title.trim(),
      author: author.trim() || undefined,
      ruleSetId,
      startSection: startSection.trim() || "1",
    };
    saveLibraryBook(entry);
    setBooks(listLibraryBooks());
    setTitle("");
    setAuthor("");
    setStartSection("1");
    // Jump straight to this book's Manage panel so attaching its PDF (a
    // slower, bigger upload) happens as its own step, once the book itself
    // is already safely saved — picking a large PDF file can background or
    // reload the tab on some mobile browsers, and we don't want that to be
    // able to wipe out an unsaved title/author/rule-set selection too.
    setExpandedId(entry.id);
  };

  const handleDelete = async (id: string) => {
    deleteLibraryBook(id);
    deleteBookData(id);
    clearGame(id);
    await Promise.all([detachBookPdf(id).catch(() => {}), deleteBookImages(id)]);
    setBooks(listLibraryBooks());
  };

  const handleAttachExisting = async (bookId: string, file: File) => {
    setError(null);
    if (file.size > MAX_PDF_UPLOAD_BYTES) {
      setError(
        `That PDF is ${(file.size / 1024 / 1024).toFixed(0)}MB, over the ${MAX_PDF_UPLOAD_BYTES / 1024 / 1024}MB limit.`,
      );
      return;
    }
    setAttaching(bookId);
    try {
      await attachBookPdf(bookId, file);
      const status = await getPdfStatus(bookId);
      setPdfStatuses((prev) => ({ ...prev, [bookId]: status }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach PDF.");
    } finally {
      setAttaching(null);
    }
  };

  const handlePlay = (entry: LibraryBookEntry) => {
    const ruleSet = resolveRuleSet(entry.ruleSetId);
    if (!ruleSet) {
      setError(`Couldn't find the rule set for "${entry.title}" — it may have been deleted from Import Book Rules.`);
      return;
    }
    onPlay(buildGamebook(entry, ruleSet));
  };

  return (
    <div className="library">
      <h1>Library</h1>
      <p className="muted">
        Play the built-in demo, or add a book of your own — pair it with the standard rules or a rule set you've
        imported. Attach its PDF to read and transcribe pages as you go, or leave it off to play in companion mode:
        navigate by paragraph number and track stats, items, tests, and combat manually as you read the physical
        book yourself.
      </p>

      <BackupPanel />

      {error && <p className="luck-banner failure">{error}</p>}

      <div className="library-grid">
        <div className="library-card">
          <div className="library-card-cover">
            <span className="library-card-cover-title">{testBook.title}</span>
          </div>
          <div className="library-card-body">
            <strong>{testBook.title}</strong>
            <span className="muted small">{testBook.author} · built-in demo, fully authored</span>
            <div className="library-card-actions">
              <button type="button" className="choice-button" onClick={() => onPlay(testBook)}>
                Play
              </button>
            </div>
          </div>
        </div>

        {books.map((entry) => {
          const ruleSet = resolveRuleSet(entry.ruleSetId);
          const status = pdfStatuses[entry.id];
          const transcribedCount = status?.exists ? Object.keys(getBookPages(entry.id)).length : 0;
          const expanded = expandedId === entry.id;
          return (
            <div className="library-card" key={entry.id}>
              <div className="library-card-cover">
                <span className="library-card-cover-title">{entry.title}</span>
                {status?.exists && status.totalPages !== undefined && (
                  <span className="library-card-badge">
                    {transcribedCount}/{status.totalPages}
                  </span>
                )}
              </div>
              <div className="library-card-body">
                <strong>{entry.title}</strong>
                <span className="muted small">
                  {entry.author && `${entry.author} · `}
                  {ruleSet?.bookTitle ?? "missing rule set"}
                </span>
                <div className="library-card-actions">
                  <button type="button" className="choice-button" onClick={() => handlePlay(entry)}>
                    Play
                  </button>
                  <button type="button" className="link-button" onClick={() => setExpandedId(expanded ? null : entry.id)}>
                    {expanded ? "Hide details" : "Manage"}
                  </button>
                </div>

                {expanded && (
                  <div className="library-card-manage">
                    <span className="library-row-actions">
                      <label className="pdf-file-label small">
                        <input
                          type="file"
                          accept="application/pdf"
                          className="pdf-file-input"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleAttachExisting(entry.id, file);
                          }}
                        />
                        {attaching === entry.id ? "Uploading…" : status?.exists ? "Replace PDF" : "Attach PDF"}
                      </label>
                      <button type="button" className="choice-button secondary" onClick={() => void handleDelete(entry.id)}>
                        Delete
                      </button>
                    </span>
                    {status?.exists && status.totalPages !== undefined && (
                      <BulkTranscribeControl bookId={entry.id} totalPages={status.totalPages} />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="importer-subhead">Add a Book</h2>
      <form className="library-create-form" onSubmit={handleCreate}>
        <label>
          Title
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book title" required />
        </label>
        <label>
          Author (optional)
          <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author" />
        </label>
        <label>
          Starting paragraph
          <input type="text" value={startSection} onChange={(e) => setStartSection(e.target.value)} placeholder="1" />
        </label>
        <label>
          Rule set
          <select value={ruleSetId} onChange={(e) => setRuleSetId(e.target.value)}>
            {ruleSets.map((rs) => (
              <option key={rs.id} value={rs.id}>
                {rs.bookTitle}
              </option>
            ))}
          </select>
        </label>
        <div className="importer-actions">
          <button type="submit" className="choice-button" disabled={!title.trim() || !ruleSetId}>
            Add Book
          </button>
        </div>
        <p className="muted small">You'll attach its PDF on the next step, once the book is saved.</p>
        {ruleSets.length === 1 && (
          <p className="muted">
            Only the standard rules are available so far — import a book's own rules from the "Import Book Rules"
            tab to use them here.
          </p>
        )}
      </form>
    </div>
  );
}
