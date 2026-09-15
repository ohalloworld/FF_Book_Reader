import { useRef, useState } from "react";
import { savePageImage } from "../engine/pageImageStore";
import { getBookPages, saveBookPage } from "../engine/storage";
import { transcribePage } from "../engine/transcriptionApi";

// Rough, conservative ballpark for the default model (claude-opus-5): one
// page image (roughly 800-1500 vision tokens at the resolution this app
// renders pages) plus a short system prompt and a few hundred output
// tokens works out to about 1-3 cents per page. Real cost varies with page
// density and is lower if ANTHROPIC_MODEL is overridden to a cheaper
// model — this is only a pre-flight ballpark, not a bill.
const EST_COST_PER_PAGE = 0.02;

/** Works through every untranscribed page of a book's PDF up front — e.g.
 * before taking the app somewhere without the dev server reachable, since
 * the reader only works from pages already cached on the phone (see
 * README's "Reading without the server" section). Each page still only
 * gets sent to Claude once, ever: pages already in the cache are skipped,
 * so re-running this after reading partway through just tops up the rest. */
export function BulkTranscribeControl({ bookId, totalPages }: { bookId: string; totalPages: number }) {
  const [cachedPages, setCachedPages] = useState(() => new Set(Object.keys(getBookPages(bookId)).map(Number)));
  const [running, setRunning] = useState(false);
  const [currentPage, setCurrentPage] = useState<number | null>(null);
  const [failedPages, setFailedPages] = useState<number[]>([]);
  const [showMap, setShowMap] = useState(false);
  const cancelRef = useRef(false);

  if (totalPages === 0) return null;

  const remainingPages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => !cachedPages.has(p));

  const run = async (pages: number[]) => {
    setRunning(true);
    cancelRef.current = false;
    setFailedPages([]);
    const failed: number[] = [];
    for (const p of pages) {
      if (cancelRef.current) break;
      setCurrentPage(p);
      try {
        const result = await transcribePage(bookId, p);
        saveBookPage(bookId, { pdfPage: result.pdfPage, paragraphs: result.paragraphs });
        if (result.imageDataUrl) await savePageImage(bookId, p, result.imageDataUrl);
        setCachedPages((prev) => new Set(prev).add(p));
      } catch {
        failed.push(p);
      }
    }
    setFailedPages(failed);
    setRunning(false);
    setCurrentPage(null);
  };

  return (
    <div className="bulk-transcribe">
      {running && (
        <div className="bulk-transcribe-progress">
          <span>
            Transcribing page {currentPage}… ({cachedPages.size} of {totalPages} done)
          </span>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              cancelRef.current = true;
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {!running && remainingPages.length > 0 && (
        <button type="button" className="link-button" onClick={() => void run(remainingPages)}>
          Pre-transcribe {remainingPages.length === totalPages ? "entire book" : `remaining ${remainingPages.length} pages`} (~$
          {(remainingPages.length * EST_COST_PER_PAGE).toFixed(2)} est.)
        </button>
      )}

      {!running && remainingPages.length === 0 && <span className="muted small">All {totalPages} pages transcribed</span>}

      {!running && failedPages.length > 0 && (
        <div className="bulk-transcribe-failed">
          <span className="muted small">Couldn't transcribe page{failedPages.length === 1 ? "" : "s"} {failedPages.join(", ")}.</span>
          <button type="button" className="link-button" onClick={() => void run(failedPages)}>
            Retry
          </button>
        </div>
      )}

      <button type="button" className="link-button completion-map-toggle" onClick={() => setShowMap((v) => !v)}>
        {showMap ? "Hide" : "Show"} page map ({cachedPages.size}/{totalPages})
      </button>
      {showMap && (
        <div className="completion-map-grid">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <span
              key={p}
              className={"completion-map-cell" + (cachedPages.has(p) ? " done" : "")}
              title={`Page ${p}${cachedPages.has(p) ? " — transcribed" : " — not yet transcribed"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
