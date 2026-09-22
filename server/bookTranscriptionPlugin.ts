import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import type { Plugin } from "vite";
import { isSafeId, readRawBody, rejectCrossOrigin, sendJson, splitDataUrl } from "./httpUtils.js";
import { PageTranscriptionSchema } from "./pageTranscriptionSchema.js";

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
            if (!process.env.ANTHROPIC_API_KEY) {
              sendJson(res, 500, {
                error: "ANTHROPIC_API_KEY is not set. Add it to a .env file in the project root and restart the dev server.",
              });
              return;
            }

            let parser: PDFParse | null = null;
            let dataUrl: string;
            let nextDataUrl: string | undefined;
            try {
              const data = await fs.readFile(bookPdfPath(bookId)).catch(() => {
                throw Object.assign(new Error("No PDF is attached to this book yet."), { statusCode: 404 });
              });
              parser = new PDFParse({ data: new Uint8Array(data) });
              // Also render the following page, shown to Claude as context
              // only — a paragraph starting on `page` but continuing past
              // its bottom edge can then still be transcribed in full,
              // rather than cut off (see TRANSCRIBE_SYSTEM_PROMPT). Simply
              // omitted from the results if `page + 1` is past the end.
              const result = await parser.getScreenshot({ partial: [page, page + 1], scale: 2 });
              const target = result.pages.find((p) => p.pageNumber === page);
              if (!target) {
                sendJson(res, 400, { error: `Page ${page} is out of range for this PDF.` });
                return;
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
            const response = await client.messages.parse({
              model: MODEL,
              max_tokens: 8000,
              system: [{ type: "text", text: TRANSCRIBE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
              messages: [{ role: "user", content }],
              output_config: { format: zodOutputFormat(PageTranscriptionSchema) },
            });

            if (!response.parsed_output) {
              sendJson(res, 502, { error: "Claude did not return a parseable transcription. Try again." });
              return;
            }

            sendJson(res, 200, { pdfPage: page, paragraphs: response.parsed_output.paragraphs, imageDataUrl: dataUrl });
            return;
          }

          if (action === "pdf" && req.method === "DELETE") {
            await fs.unlink(bookPdfPath(bookId)).catch(() => {
              // already gone — fine
            });
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
