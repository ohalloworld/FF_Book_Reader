import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import type { Plugin } from "vite";
import { isSafeId, readRawBody, sendJson, splitDataUrl } from "./httpUtils.js";
import { PageTranscriptionSchema } from "./pageTranscriptionSchema.js";

const MAX_PDF_BYTES = 40 * 1024 * 1024;
const BOOKS_DIR = path.join(process.cwd(), ".local-books");

const TRANSCRIBE_SYSTEM_PROMPT = `You transcribe numbered paragraphs from one page image of a Fighting-Fantasy-style gamebook. Each paragraph starts with a printed number. For every complete paragraph visible on the page:
- transcribe its full text verbatim — do not summarize, paraphrase, or correct it
- list every numbered choice it offers ("turn to X", "if you have the key, turn to Y"), with the exact target number
- leave choices empty if the paragraph has none (e.g. it leads into combat, or is an ending)

Skip a paragraph that is visibly cut off at the very top or bottom of the page with no readable number of its own — it will be caught when the adjacent page is transcribed. Do not invent numbers or content not visible on the page.`;

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
            try {
              const data = await fs.readFile(bookPdfPath(bookId)).catch(() => {
                throw Object.assign(new Error("No PDF is attached to this book yet."), { statusCode: 404 });
              });
              parser = new PDFParse({ data: new Uint8Array(data) });
              const result = await parser.getScreenshot({ partial: [page], scale: 2 });
              if (result.pages.length === 0) {
                sendJson(res, 400, { error: `Page ${page} is out of range for this PDF.` });
                return;
              }
              dataUrl = result.pages[0].dataUrl;
            } finally {
              await parser?.destroy();
            }

            const { mediaType, data: base64 } = splitDataUrl(dataUrl);
            const client = new Anthropic();
            const response = await client.messages.parse({
              model: "claude-opus-5",
              max_tokens: 8000,
              system: TRANSCRIBE_SYSTEM_PROMPT,
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "image", source: { type: "base64", media_type: mediaType as "image/png", data: base64 } },
                    { type: "text", text: `This is page ${page} of the book. Transcribe its numbered paragraphs.` },
                  ],
                },
              ],
              output_config: { format: zodOutputFormat(PageTranscriptionSchema) },
            });

            if (!response.parsed_output) {
              sendJson(res, 502, { error: "Claude did not return a parseable transcription. Try again." });
              return;
            }

            sendJson(res, 200, { pdfPage: page, paragraphs: response.parsed_output.paragraphs });
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
