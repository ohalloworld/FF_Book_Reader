import { useEffect, useState } from "react";
import { slugify } from "../engine/parseRulesApi";
import { availableRuleSets, buildGamebook, resolveRuleSet } from "../engine/library";
import { deleteLibraryBook, listLibraryBooks, saveLibraryBook } from "../engine/storage";
import { attachBookPdf, getPdfStatus, type PdfStatus } from "../engine/transcriptionApi";
import type { Gamebook, LibraryBookEntry } from "../engine/types";
import { testBook } from "../data/testBook";

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
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(books.map((b) => getPdfStatus(b.id).then((status) => [b.id, status] as const))).then((entries) => {
      if (!cancelled) setPdfStatuses(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [books]);

  const handleCreate = async (e: React.FormEvent) => {
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
    if (pdfFile) {
      setAttaching(entry.id);
      try {
        await attachBookPdf(entry.id, pdfFile);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to attach PDF.");
      } finally {
        setAttaching(null);
      }
    }
    setBooks(listLibraryBooks());
    setTitle("");
    setAuthor("");
    setStartSection("1");
    setPdfFile(null);
  };

  const handleDelete = (id: string) => {
    deleteLibraryBook(id);
    setBooks(listLibraryBooks());
  };

  const handleAttachExisting = async (bookId: string, file: File) => {
    setAttaching(bookId);
    setError(null);
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

      {error && <p className="luck-banner failure">{error}</p>}

      <div className="library-list">
        <div className="library-row">
          <div>
            <strong>{testBook.title}</strong>
            <span className="muted"> — {testBook.author} (built-in demo, fully authored)</span>
          </div>
          <button type="button" className="choice-button secondary" onClick={() => onPlay(testBook)}>
            Play
          </button>
        </div>

        {books.map((entry) => {
          const ruleSet = resolveRuleSet(entry.ruleSetId);
          const status = pdfStatuses[entry.id];
          return (
            <div className="library-row" key={entry.id}>
              <div>
                <strong>{entry.title}</strong>
                {entry.author && <span className="muted"> — {entry.author}</span>}
                <span className="muted"> ({ruleSet?.bookTitle ?? "missing rule set"})</span>
                {status?.exists && <span className="muted"> · PDF attached, {status.totalPages} pages</span>}
              </div>
              <span className="library-row-actions">
                <button type="button" className="choice-button secondary" onClick={() => handlePlay(entry)}>
                  Play
                </button>
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
                <button type="button" className="choice-button secondary" onClick={() => handleDelete(entry.id)}>
                  Delete
                </button>
              </span>
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
        <label>
          PDF (optional — can also attach later)
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <div className="importer-actions">
          <button type="submit" className="choice-button" disabled={!title.trim() || !ruleSetId || attaching !== null}>
            {attaching ? "Adding…" : "Add Book"}
          </button>
        </div>
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
