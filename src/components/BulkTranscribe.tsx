import { useEffect, useRef, useState } from "react";
import { syncBookPages } from "../engine/pageSync";
import { getBookPages } from "../engine/storage";
import { cancelBulkTranscribe, getBulkTranscribeStatus, startBulkTranscribe, type BulkTranscribeStatus } from "../engine/transcriptionApi";

// Rough, conservative ballpark for the default model (claude-opus-5): each
// transcription call sends two page images (the target page, plus the
// next one for context — see bookTranscriptionPlugin.ts — so a paragraph
// crossing a page boundary doesn't get cut off), roughly 1600-3000 vision
// tokens total, plus a short system prompt and a few hundred output
// tokens — about 2-4 cents per page. Real cost varies with page density
// and is lower if ANTHROPIC_MODEL is overridden to a cheaper model — this
// is only a pre-flight ballpark, not a bill.
const EST_COST_PER_PAGE = 0.03;

const POLL_INTERVAL_MS = 2500;

/** Kicks off transcription of every untranscribed page of a book's PDF as
 * a job that runs on the dev server itself, independent of this browser
 * tab — locking your phone, backgrounding the app, or closing it entirely
 * doesn't interrupt it, since the server keeps working through pages on
 * its own and writes each one to disk as it finishes. This component's
 * job is just to show that server-side progress (polling while a job is
 * running) and sync completed pages down into this browser's own local
 * cache (pageSync.ts) so the reader keeps working offline once synced —
 * reopening the book later, on this device or another, picks up wherever
 * the server actually got to. Each page still only gets sent to Claude
 * once, ever: pages already transcribed (locally or just on the server,
 * not yet synced) are skipped. */
export function BulkTranscribeControl({ bookId, totalPages }: { bookId: string; totalPages: number }) {
  const [cachedPages, setCachedPages] = useState(() => new Set(Object.keys(getBookPages(bookId)).map(Number)));
  const [status, setStatus] = useState<BulkTranscribeStatus | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  // Set by the effect below to trigger an immediate poll (bypassing the
  // wait for the next scheduled tick) right after starting or cancelling
  // a job — a plain ref rather than useCallback since the recursive poll
  // loop it wraps needs a stable self-reference (a hoisted named function
  // inside the effect), not a value that could change across renders.
  const pollNowRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    async function sync() {
      try {
        const newlySynced = await syncBookPages(bookId);
        if (newlySynced.length > 0 && !cancelled) {
          setCachedPages(new Set(Object.keys(getBookPages(bookId)).map(Number)));
        }
        if (!cancelled) setSyncError(null);
      } catch (err) {
        if (!cancelled) setSyncError(err instanceof Error ? err.message : "Couldn't reach the server to sync pages.");
      }
    }

    async function poll() {
      try {
        const next = await getBulkTranscribeStatus(bookId);
        if (cancelled) return;
        setStatus(next);
        await sync();
        if (!cancelled && next.status === "running") {
          timeout = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        // Server unreachable right now (restarting, or this device briefly
        // offline) — the job itself is unaffected, so keep trying on the
        // same interval rather than giving up until the next remount.
        if (!cancelled) timeout = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    pollNowRef.current = () => {
      if (timeout) clearTimeout(timeout);
      void poll();
    };
    void poll();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [bookId]);

  if (totalPages === 0) return null;

  const remainingPages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => !cachedPages.has(p));
  const running = status?.status === "running";

  const start = async (pages: number[]) => {
    await startBulkTranscribe(bookId, pages);
    pollNowRef.current();
  };

  const cancel = async () => {
    await cancelBulkTranscribe(bookId);
    pollNowRef.current();
  };

  return (
    <div className="bulk-transcribe">
      {running && (
        <div className="bulk-transcribe-progress">
          <span>
            Transcribing page {status.currentPage}… ({status.done} of {status.total} done this run) — running on the
            server, safe to lock your phone or close this tab
          </span>
          <button type="button" className="link-button" onClick={() => void cancel()}>
            Cancel
          </button>
        </div>
      )}

      {!running && remainingPages.length > 0 && (
        <button type="button" className="link-button" onClick={() => void start(remainingPages)}>
          Pre-transcribe {remainingPages.length === totalPages ? "entire book" : `remaining ${remainingPages.length} pages`} (~$
          {(remainingPages.length * EST_COST_PER_PAGE).toFixed(2)} est.)
        </button>
      )}

      {!running && remainingPages.length === 0 && <span className="muted small">All {totalPages} pages transcribed</span>}

      {!running && status && status.failedPages.length > 0 && (
        <div className="bulk-transcribe-failed">
          <span className="muted small">
            Couldn't transcribe {status.failedPages.length} page{status.failedPages.length === 1 ? "" : "s"}:
          </span>
          <ul className="bulk-transcribe-failed-list">
            {status.failedPages.map((f) => (
              <li key={f.page} className="muted small">
                Page {f.page}: {f.error}
              </li>
            ))}
          </ul>
          <button type="button" className="link-button" onClick={() => void start(status.failedPages.map((f) => f.page))}>
            Retry
          </button>
        </div>
      )}

      {syncError && <span className="muted small">Couldn't sync from the server: {syncError}</span>}

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
