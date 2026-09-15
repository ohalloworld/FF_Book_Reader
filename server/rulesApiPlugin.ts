import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { PDFParse } from "pdf-parse";
import type { Plugin } from "vite";
import { readJsonBody, readRawBody, rejectCrossOrigin, sendJson, splitDataUrl } from "./httpUtils.js";
import { RuleSetExtractionSchema } from "./ruleSetSchema.js";

const EXTRACTION_SYSTEM_PROMPT = `You extract structured game rules from the rules section of a Fighting-Fantasy-style gamebook (the "How to fight the monsters" / "Adventure Sheet" / background rules pages a reader transcribes for you). You may be given the text directly, or page images (photographs/scans of the rules pages) to read yourself. Either way, produce a structured rule set describing:
- every stat on the character sheet and how its starting value is generated
- every named dice test (Luck, Skill, or anything book-specific)
- how combat is resolved
- standard starting equipment, if mentioned
- any other rule or mechanic that doesn't fit those fields, as short reference notes

Use lowercase snake_case for machine keys. Base everything strictly on what the source actually says — don't invent mechanics it doesn't describe. If it only covers part of the rules (e.g. no combat section), still fill in your best structural guess for the missing parts using standard Fighting Fantasy conventions (2D6 + SKILL combat, 2 STAMINA damage per lost round) and note the gap in specialRules.`;

const MAX_PDF_BYTES = 40 * 1024 * 1024; // 40MB — plenty for a scanned-text gamebook, cheap to cap
const MAX_RENDER_PAGES = 25; // a rules section is never this long; guards against rendering a whole book
// Override for cost/quality experiments — the default stays claude-opus-5.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

/** Dev-only local API, running entirely in this Node process so nothing —
 * not the Anthropic API key, not the PDF you upload — leaves your machine
 * except what you choose to send to Claude for parsing. Only available
 * under `npm run dev` (Vite dev middleware). */
export function rulesApiPlugin(): Plugin {
  return {
    name: "ff-rules-api",
    configureServer(server) {
      server.middlewares.use("/api/extract-pdf-text", async (req, res) => {
        if (rejectCrossOrigin(req, res)) return;
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        let parser: PDFParse | null = null;
        try {
          const pdfBytes = await readRawBody(req, MAX_PDF_BYTES);
          if (pdfBytes.length === 0) {
            sendJson(res, 400, { error: "No PDF data received." });
            return;
          }

          parser = new PDFParse({ data: new Uint8Array(pdfBytes) });
          const info = await parser.getInfo().catch(() => null);
          const result = await parser.getText({ pageJoiner: "" });

          const totalTextLength = result.pages.reduce((sum, p) => sum + p.text.trim().length, 0);
          const warning =
            result.total > 0 && totalTextLength / result.total < 20
              ? "Very little text was found per page — this PDF may be scanned page images rather than real text. Try \"Parse from page images\" below instead, which sends the pages to Claude as pictures rather than extracted text."
              : undefined;

          sendJson(res, 200, {
            total: result.total,
            title: info?.info?.Title || undefined,
            pages: result.pages.map((p) => ({ num: p.num, text: p.text })),
            warning,
          });
        } catch (err) {
          const statusCode = (err as { statusCode?: number })?.statusCode ?? 500;
          sendJson(res, statusCode, { error: err instanceof Error ? err.message : "Failed to read PDF" });
        } finally {
          await parser?.destroy();
        }
      });

      server.middlewares.use("/api/render-pdf-pages", async (req, res) => {
        if (rejectCrossOrigin(req, res)) return;
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        let parser: PDFParse | null = null;
        try {
          const url = new URL(req.url ?? "", "http://localhost");
          const from = Number(url.searchParams.get("from"));
          const to = Number(url.searchParams.get("to"));
          if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
            sendJson(res, 400, { error: "Invalid page range." });
            return;
          }
          if (to - from + 1 > MAX_RENDER_PAGES) {
            sendJson(res, 400, { error: `Select at most ${MAX_RENDER_PAGES} pages to render as images.` });
            return;
          }

          const pdfBytes = await readRawBody(req, MAX_PDF_BYTES);
          if (pdfBytes.length === 0) {
            sendJson(res, 400, { error: "No PDF data received." });
            return;
          }

          const pageNumbers = Array.from({ length: to - from + 1 }, (_, i) => from + i);
          parser = new PDFParse({ data: new Uint8Array(pdfBytes) });
          const result = await parser.getScreenshot({ partial: pageNumbers, scale: 2 });

          sendJson(res, 200, { images: result.pages.map((p) => p.dataUrl) });
        } catch (err) {
          const statusCode = (err as { statusCode?: number })?.statusCode ?? 500;
          sendJson(res, statusCode, { error: err instanceof Error ? err.message : "Failed to render PDF pages" });
        } finally {
          await parser?.destroy();
        }
      });

      server.middlewares.use("/api/parse-rules", async (req, res) => {
        if (rejectCrossOrigin(req, res)) return;
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        try {
          const body = (await readJsonBody(req, MAX_PDF_BYTES)) as {
            rulesText?: unknown;
            pageImages?: unknown;
          };

          const rulesText = typeof body.rulesText === "string" ? body.rulesText.trim() : "";
          const pageImages = Array.isArray(body.pageImages)
            ? body.pageImages.filter((i): i is string => typeof i === "string")
            : [];

          if (!rulesText && pageImages.length === 0) {
            sendJson(res, 400, { error: "rulesText or pageImages is required" });
            return;
          }
          if (!process.env.ANTHROPIC_API_KEY) {
            sendJson(res, 500, {
              error: "ANTHROPIC_API_KEY is not set. Add it to a .env file in the project root and restart the dev server.",
            });
            return;
          }

          const content: Anthropic.ContentBlockParam[] = pageImages.length
            ? [
                ...pageImages.map((dataUrl): Anthropic.ContentBlockParam => {
                  const { mediaType, data } = splitDataUrl(dataUrl);
                  return {
                    type: "image",
                    source: { type: "base64", media_type: mediaType as "image/png", data },
                  };
                }),
                {
                  type: "text",
                  text: "These are page images of a gamebook's rules section, in order. Read the rules text from the images and extract the structured rule set.",
                },
              ]
            : [{ type: "text", text: rulesText }];

          const client = new Anthropic();
          const response = await client.messages.parse({
            model: MODEL,
            max_tokens: 8000,
            system: [{ type: "text", text: EXTRACTION_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content }],
            output_config: { format: zodOutputFormat(RuleSetExtractionSchema) },
          });

          if (!response.parsed_output) {
            sendJson(res, 502, { error: "Claude did not return a parseable rule set. Try again, or trim/simplify the source." });
            return;
          }

          sendJson(res, 200, { ruleSet: response.parsed_output });
        } catch (err) {
          const statusCode = (err as { statusCode?: number })?.statusCode ?? 500;
          sendJson(res, statusCode, { error: err instanceof Error ? err.message : "Unknown error" });
        }
      });
    },
  };
}
