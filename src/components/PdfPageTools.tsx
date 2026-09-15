import { useState } from "react";
import { getPageImage, savePageImage } from "../engine/pageImageStore";
import { getBookPages, saveBookPage } from "../engine/storage";
import { transcribePage } from "../engine/transcriptionApi";
import type { TranscribedPage } from "../engine/types";

type Status = "idle" | "loading" | "error";

async function ensurePage(bookId: string, page: number): Promise<TranscribedPage> {
  const cached = getBookPages(bookId)[page];
  if (cached) return cached;
  const result = await transcribePage(bookId, page);
  saveBookPage(bookId, { pdfPage: result.pdfPage, paragraphs: result.paragraphs });
  if (result.imageDataUrl) await savePageImage(bookId, page, result.imageDataUrl);
  return result;
}

/** Shown when the reader's current paragraph hasn't been transcribed yet.
 * Fighting Fantasy paragraph numbers are deliberately not in page order
 * (so you can't peek ahead by flipping), so this can't be guessed — the
 * reader has to say which PDF page it's on, same as glancing at their own
 * book. Transcribing that page fills in every paragraph found there, not
 * just this one. */
export function TranscribeSectionPrompt({
  bookId,
  sectionId,
  onTranscribed,
}: {
  bookId: string;
  sectionId: string;
  onTranscribed: () => void;
}) {
  const [page, setPage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum < 1) return;
    setStatus("loading");
    setError(null);
    try {
      await ensurePage(bookId, pageNum);
      onTranscribed();
      setPage("");
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transcribe page.");
      setStatus("error");
    }
  };

  return (
    <div className="transcribe-prompt">
      <p className="muted">
        Section {sectionId} hasn't been read yet. Which PDF page is it on? (Paragraph numbers don't run in page
        order in these books, so this needs telling once per page — everything found on it gets saved at once.)
      </p>
      <form onSubmit={handleSubmit} className="transcribe-prompt-form">
        <input
          type="number"
          min={1}
          placeholder="PDF page number"
          value={page}
          onChange={(e) => setPage(e.target.value)}
        />
        <button type="submit" className="choice-button secondary" disabled={status === "loading" || !page.trim()}>
          {status === "loading" ? "Transcribing…" : "Transcribe this page"}
        </button>
      </form>
      {status === "error" && error && <p className="luck-banner failure">{error}</p>}
    </div>
  );
}

/** A read-only browsing panel, separate from the reader's actual position
 * in the story — lets you flip through PDF pages (transcribing new ones
 * as you go) to skim ahead or re-find something, without moving your
 * character. */
export function PdfPageBrowser({
  bookId,
  totalPages,
  onTranscribed,
}: {
  bookId: string;
  totalPages?: number;
  onTranscribed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [current, setCurrent] = useState<TranscribedPage | null>(null);
  const [image, setImage] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pageJump, setPageJump] = useState("");

  const goTo = async (target: number) => {
    if (target < 1 || (totalPages && target > totalPages)) return;
    setPage(target);
    setImage(undefined);
    const cached = getBookPages(bookId)[target];
    if (cached) {
      setCurrent(cached);
      setStatus("idle");
      setError(null);
    } else {
      setStatus("loading");
      setError(null);
      setCurrent(null);
      try {
        const result = await transcribePage(bookId, target);
        saveBookPage(bookId, { pdfPage: result.pdfPage, paragraphs: result.paragraphs });
        if (result.imageDataUrl) await savePageImage(bookId, target, result.imageDataUrl);
        setCurrent(result);
        onTranscribed();
        setStatus("idle");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to transcribe page.");
        setStatus("error");
        return;
      }
    }
    setImage(await getPageImage(bookId, target));
  };

  const handlePageJump = (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(pageJump);
    if (!Number.isInteger(target) || target < 1) return;
    void goTo(target);
    setPageJump("");
  };

  return (
    <div className="pdf-browser">
      <button
        type="button"
        className="link-button"
        onClick={() => {
          const opening = !open;
          setOpen(opening);
          if (opening) void goTo(page);
        }}
      >
        {open ? "Hide" : "Browse"} PDF Pages
      </button>
      {open && (
        <div className="pdf-browser-panel">
          <div className="pdf-browser-nav">
            <button
              type="button"
              className="choice-button secondary"
              onClick={() => goTo(page - 1)}
              disabled={page <= 1 || status === "loading"}
            >
              ← Prev page
            </button>
            <span>
              Page {page}
              {totalPages ? ` of ${totalPages}` : ""}
            </span>
            <button
              type="button"
              className="choice-button secondary"
              onClick={() => goTo(page + 1)}
              disabled={(totalPages ? page >= totalPages : false) || status === "loading"}
            >
              Next page →
            </button>
          </div>
          <form className="pdf-browser-jump" onSubmit={handlePageJump}>
            <label htmlFor="pdf-page-jump-input">Go to page</label>
            <input
              id="pdf-page-jump-input"
              type="number"
              min={1}
              max={totalPages}
              placeholder="e.g. 42"
              value={pageJump}
              onChange={(e) => setPageJump(e.target.value)}
            />
            <button type="submit" className="choice-button secondary" disabled={!pageJump.trim() || status === "loading"}>
              Go
            </button>
          </form>
          {status === "loading" && <p className="muted">Transcribing…</p>}
          {status === "error" && error && <p className="luck-banner failure">{error}</p>}
          {image && <img src={image} alt={`Scan of page ${page}`} className="pdf-browser-image" />}
          {current && (
            <div className="pdf-browser-content">
              {current.paragraphs.length === 0 && <p className="muted">No paragraphs found on this page.</p>}
              {current.paragraphs.map((p) => (
                <div key={p.id} className="pdf-browser-paragraph">
                  <strong>{p.id}</strong>
                  <p>{p.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
