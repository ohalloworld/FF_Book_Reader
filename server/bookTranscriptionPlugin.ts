import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import type { Plugin } from "vite";
import { isSafeId, readRawBody, rejectCrossOrigin, sendJson, splitDataUrl } from "./httpUtils.js";
import { PageTranscriptionSchema, TranscribedParagraphSchema } from "./pageTranscriptionSchema.js";
import type { z } from "zod";

// The whole PDF gets uploaded and stored here. A real scanned gamebook —
// image-only pages, no text layer — can easily run past 100MB for a full
// book, so this needs real headroom (see the matching comment in
// rulesApiPlugin.ts, which hits the identical whole-book-upload sizing).
const MAX_PDF_BYTES = 300 * 1024 * 1024;
const BOOKS_DIR = path.join(process.cwd(), ".local-books");
// Override for cost/quality experiments — the default stays claude-opus-5.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

const TRANSCRIBE_SYSTEM_PROMPT = `You transcribe numbered paragraphs from a page of a Fighting-Fantasy-style gamebook. Each paragraph starts with a printed number.

You are shown two page images: the TARGET page, and the page that follows it (shown only for context, so a paragraph that runs past the bottom of the target page can still be read in full). Only transcribe paragraphs whose number is printed on the TARGET page — never a paragraph whose number first appears on the following page, even though you can see its text too; that page gets transcribed in its own turn. If the second image isn't provided, only the target page has content (it's the last page).

For every paragraph that starts on the target page:
- transcribe its full text verbatim, including any part that continues onto the following page — do not summarize, paraphrase, correct, or truncate it
- list every numbered choice it offers ("turn to X", "if you have the key, turn to Y"), with the exact target number, even if those choices are only printed on the following page
- leave choices empty if the paragraph has none (e.g. it leads into combat, or is an ending)

If a paragraph's number is printed right at the very bottom edge of the target page and is genuinely unreadable (not just continuing text with no number — an actual illegible or cut-off digit), skip it rather than guessing. Do not invent numbers or content not visible on the page.`;

function bookPdfPath(bookId: string): string {
  return path.join(BOOKS_DIR, `${bookId}.pdf`);
}

function bookPagesPath(bookId: string): string {
  return path.join(BOOKS_DIR, `${bookId}-pages.json`);
}

function bookImagesDir(bookId: string): string {
  return path.join(BOOKS_DIR, `${bookId}-images`);
}

function bookImagePath(bookId: string, page: number): string {
  return path.join(bookImagesDir(bookId), `${page}.png`);
}

interface StoredPage {
  pdfPage: number;
  paragraphs: z.infer<typeof TranscribedParagraphSchema>[];
}

/** Every page transcribed for a book, persisted server-side — the durable
 * copy a background bulk-transcribe job writes to as it goes, and what a
 * client (a phone, say) syncs down from whenever it's next open. Separate
 * from the browser's own localStorage cache (src/engine/storage.ts),
 * which remains what the reader actually reads from so a book keeps
 * working with no server reachable at all once synced. */
async function readStoredPages(bookId: string): Promise<Record<number, StoredPage>> {
  try {
    const raw = await fs.readFile(bookPagesPath(bookId), "utf-8");
    return JSON.parse(raw) as Record<number, StoredPage>;
  } catch {
    return {};
  }
}

async function writeStoredPage(bookId: string, page: StoredPage, imageDataUrl: string): Promise<void> {
  await fs.mkdir(BOOKS_DIR, { recursive: true });
  const pages = await readStoredPages(bookId);
  pages[page.pdfPage] = page;
  await fs.writeFile(bookPagesPath(bookId), JSON.stringify(pages));

  await fs.mkdir(bookImagesDir(bookId), { recursive: true });
  const { data: base64 } = splitDataUrl(imageDataUrl);
  await fs.writeFile(bookImagePath(bookId, page.pdfPage), Buffer.from(base64, "base64"));
}

/** Renders one PDF page (plus the next, for cross-page-paragraph context),
 * sends both to Claude, and persists the result to disk before returning
 * it — used by both the single-page endpoint and the bulk job loop below,
 * so a page transcribed either way is durably backed up the same way. */
async function transcribeOnePage(bookId: string, page: number): Promise<{ pdfPage: number; paragraphs: z.infer<typeof TranscribedParagraphSchema>[]; imageDataUrl: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to a .env file in the project root and restart the dev server.");
  }

  let parser: PDFParse | null = null;
  let dataUrl: string;
  let nextDataUrl: string | undefined;
  try {
    const data = await fs.readFile(bookPdfPath(bookId)).catch(() => {
      throw Object.assign(new Error("No PDF is attached to this book yet."), { statusCode: 404 });
    });
    parser = new PDFParse({ data: new Uint8Array(data) });
    // Also render the following page, shown to Claude as context only — a
    // paragraph starting on `page` but continuing past its bottom edge
    // can then still be transcribed in full, rather than cut off (see
    // TRANSCRIBE_SYSTEM_PROMPT). Simply omitted if `page + 1` is past the
    // end of the document.
    const result = await parser.getScreenshot({ partial: [page, page + 1], scale: 2 });
    const target = result.pages.find((p) => p.pageNumber === page);
    if (!target) {
      throw Object.assign(new Error(`Page ${page} is out of range for this PDF.`), { statusCode: 400 });
    }
    dataUrl = target.dataUrl;
    nextDataUrl = result.pages.find((p) => p.pageNumber === page + 1)?.dataUrl;
  } finally {
    await parser?.destroy();
  }

  const { mediaType, data: base64 } = splitDataUrl(dataUrl);
  const content: Anthropic.ContentBlockParam[] = [
    { type: "text", text: `Page ${page} — the TARGET page. Transcribe every paragraph whose number appears here.` },
    { type: "image", source: { type: "base64", media_type: mediaType as "image/png", data: base64 } },
  ];
  if (nextDataUrl) {
    const next = splitDataUrl(nextDataUrl);
    content.push(
      { type: "text", text: `Page ${page + 1} — for context only, to complete a paragraph that runs past the target page.` },
      { type: "image", source: { type: "base64", media_type: next.mediaType as "image/png", data: next.data } },
    );
  }

  const client = new Anthropic();
  let response: Awaited<ReturnType<typeof client.messages.parse>>;
  try {
    response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: [{ type: "text", text: TRANSCRIBE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
      output_config: { format: zodOutputFormat(PageTranscriptionSchema) },
    });
  } catch (err) {
    // Anthropic's own safety system, not a bug here — older gamebooks
    // routinely describe or depict violence (monster combat, trap deaths)
    // that occasionally trips it, especially from a scanned illustration.
    // No retry or prompt change on our end can force it through; the
    // practical path is transcribing that page's paragraphs by hand as
    // you reach them (SectionView's "Type it in by hand", shown for any
    // paragraph with no text yet) rather than through this page-image
    // pipeline.
    if (err instanceof Error && /content filtering/i.test(err.message)) {
      throw Object.assign(
        new Error(
          "Claude's safety filters blocked this page, most likely because of violent or graphic content on it (common in these books) — not a bug on our end, and not something a retry can fix. Once you reach a paragraph from this page in the story, use \"Type it in by hand\" to transcribe it yourself instead.",
        ),
        { statusCode: 502 },
      );
    }
    throw err;
  }

  if (!response.parsed_output) {
    throw Object.assign(new Error("Claude did not return a parseable transcription. Try again."), { statusCode: 502 });
  }

  const result = { pdfPage: page, paragraphs: response.parsed_output.paragraphs, imageDataUrl: dataUrl };
  await writeStoredPage(bookId, { pdfPage: page, paragraphs: result.paragraphs }, dataUrl);
  return result;
}

type BulkJobStatus = "running" | "done" | "cancelled" | "error";

interface BulkJob {
  status: BulkJobStatus;
  total: number;
  done: number;
  currentPage: number | null;
  failedPages: { page: number; error: string }[];
  error?: string;
  cancelRequested: boolean;
}

/** One job per book at a time, kept in memory only — a dev-server restart
 * loses job progress tracking, but not the pages it already persisted to
 * disk, so re-starting the job afterward just skips what's already done.
 * The job runs detached from any particular HTTP request: once started it
 * keeps going whether or not a client is around to watch it, which is the
 * whole point — a phone can lock or close its tab mid-job and the pages
 * still get transcribed, ready to sync down whenever it's next open. */
const bulkJobs = new Map<string, BulkJob>();

function runBulkJob(bookId: string, pages: number[]): void {
  const job: BulkJob = { status: "running", total: pages.length, done: 0, currentPage: null, failedPages: [], cancelRequested: false };
  bulkJobs.set(bookId, job);

  void (async () => {
    for (const page of pages) {
      if (job.cancelRequested) {
        job.status = "cancelled";
        job.currentPage = null;
        return;
      }
      job.currentPage = page;
      try {
        await transcribeOnePage(bookId, page);
        job.done++;
      } catch (err) {
        job.failedPages.push({ page, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }
    job.status = "done";
    job.currentPage = null;
  })().catch((err) => {
    job.status = "error";
    job.error = err instanceof Error ? err.message : "Unknown error";
    job.currentPage = null;
  });
}

/** Dev-only local API for attaching a book's PDF to a Library entry and
 * transcribing it page by page on demand. Runs entirely in this Node
 * process: the PDF is stored on your own disk (in .local-books/, never
 * committed to git) and only the page image you ask to transcribe is ever
 * sent to Claude. Only available under `npm run dev`. */
export function bookTranscriptionPlugin(): Plugin {
  return {
    name: "ff-book-transcription-api",
    configureServer(server) {
      server.middlewares.use("/api/library", async (req, res) => {
        if (rejectCrossOrigin(req, res)) return;

        const url = new URL(req.url ?? "", "http://localhost");
        const parts = url.pathname.split("/").filter(Boolean);
        const bookId = parts[0];
        const action = parts[1];

        if (!bookId || !isSafeId(bookId)) {
          sendJson(res, 400, { error: "Missing or invalid book id" });
          return;
        }

        try {
          if (action === "pdf" && req.method === "POST") {
            const pdfBytes = await readRawBody(req, MAX_PDF_BYTES);
            if (pdfBytes.length === 0) {
              sendJson(res, 400, { error: "No PDF data received." });
              return;
            }
            await fs.mkdir(BOOKS_DIR, { recursive: true });
            await fs.writeFile(bookPdfPath(bookId), pdfBytes);
            sendJson(res, 200, { ok: true });
            return;
          }

          if (action === "pdf-status" && req.method === "GET") {
            let parser: PDFParse | null = null;
            try {
              const data = await fs.readFile(bookPdfPath(bookId));
              parser = new PDFParse({ data: new Uint8Array(data) });
              const info = await parser.getInfo();
              sendJson(res, 200, { exists: true, totalPages: info.total });
            } catch {
              sendJson(res, 200, { exists: false });
            } finally {
              await parser?.destroy();
            }
            return;
          }

          if (action === "transcribe-page" && req.method === "POST") {
            const body = JSON.parse((await readRawBody(req, 1024)).toString("utf-8")) as { page?: unknown };
            const page = Number(body.page);
            if (!Number.isInteger(page) || page < 1) {
              sendJson(res, 400, { error: "Invalid page number." });
              return;
            }
            const result = await transcribeOnePage(bookId, page);
            sendJson(res, 200, result);
            return;
          }

          if (action === "pages" && req.method === "GET") {
            const pages = await readStoredPages(bookId);
            sendJson(res, 200, { pages });
            return;
          }

          if (action === "page-image" && req.method === "GET") {
            const page = Number(parts[2]);
            if (!Number.isInteger(page) || page < 1) {
              sendJson(res, 400, { error: "Invalid page number." });
              return;
            }
            try {
              const bytes = await fs.readFile(bookImagePath(bookId, page));
              res.statusCode = 200;
              res.setHeader("content-type", "image/png");
              res.end(bytes);
            } catch {
              sendJson(res, 404, { error: "No stored image for that page." });
            }
            return;
          }

          if (action === "bulk-transcribe" && req.method === "POST" && parts[2] === "cancel") {
            const job = bulkJobs.get(bookId);
            if (job && job.status === "running") job.cancelRequested = true;
            sendJson(res, 200, { ok: true });
            return;
          }

          if (action === "bulk-transcribe" && req.method === "POST") {
            const existing = bulkJobs.get(bookId);
            if (existing && existing.status === "running") {
              sendJson(res, 200, { ok: true, alreadyRunning: true });
              return;
            }
            if (!process.env.ANTHROPIC_API_KEY) {
              sendJson(res, 500, {
                error: "ANTHROPIC_API_KEY is not set. Add it to a .env file in the project root and restart the dev server.",
              });
              return;
            }
            const body = JSON.parse((await readRawBody(req, 1024 * 1024)).toString("utf-8")) as { pages?: unknown };
            const pages = Array.isArray(body.pages) ? body.pages.filter((p): p is number => Number.isInteger(p) && p > 0) : [];
            if (pages.length === 0) {
              sendJson(res, 400, { error: "No pages to transcribe." });
              return;
            }
            runBulkJob(bookId, pages);
            sendJson(res, 200, { ok: true });
            return;
          }

          if (action === "bulk-transcribe-status" && req.method === "GET") {
            const job = bulkJobs.get(bookId);
            sendJson(res, 200, job ?? { status: "idle", total: 0, done: 0, currentPage: null, failedPages: [] });
            return;
          }

          if (action === "pdf" && req.method === "DELETE") {
            await fs.unlink(bookPdfPath(bookId)).catch(() => {
              // already gone — fine
            });
            await fs.unlink(bookPagesPath(bookId)).catch(() => {});
            await fs.rm(bookImagesDir(bookId), { recursive: true, force: true }).catch(() => {});
            bulkJobs.delete(bookId);
            sendJson(res, 200, { ok: true });
            return;
          }

          sendJson(res, 404, { error: "Not found" });
        } catch (err) {
          const statusCode = (err as { statusCode?: number })?.statusCode ?? 500;
          sendJson(res, statusCode, { error: err instanceof Error ? err.message : "Unknown error" });
        }
      });
    },
  };
}
