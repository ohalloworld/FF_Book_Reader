import type { RuleSet } from "./types";

export interface ParseRulesResult {
  ruleSet: Omit<RuleSet, "id" | "source">;
}

async function callParseRules(payload: { rulesText: string } | { pageImages: string[] }): Promise<Omit<RuleSet, "id" | "source">> {
  const response = await fetch("/api/parse-rules", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body.error === "string" ? body.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  if (!body?.ruleSet) {
    throw new Error("No rule set was returned.");
  }
  return body.ruleSet as Omit<RuleSet, "id" | "source">;
}

/** Calls the local dev-only /api/parse-rules endpoint (see
 * server/rulesApiPlugin.ts), which runs the Anthropic extraction
 * server-side. Only available under `npm run dev`. */
export function parseRulesText(rulesText: string): Promise<Omit<RuleSet, "id" | "source">> {
  return callParseRules({ rulesText });
}

/** Same as parseRulesText, but for scanned PDFs with no extractable text
 * layer — sends page images (data URLs from renderPdfPages) and lets
 * Claude read the rules directly from the pictures. */
export function parseRulesFromImages(pageImages: string[]): Promise<Omit<RuleSet, "id" | "source">> {
  return callParseRules({ pageImages });
}

export interface PdfPage {
  num: number;
  text: string;
}

export interface PdfExtractionResult {
  total: number;
  title?: string;
  pages: PdfPage[];
  warning?: string;
}

/** Sends raw PDF bytes to the local /api/extract-pdf-text endpoint (see
 * server/rulesApiPlugin.ts). The PDF is parsed in-memory on your machine
 * and never leaves it. */
export async function extractPdfText(file: File): Promise<PdfExtractionResult> {
  const bytes = await file.arrayBuffer();
  const response = await fetch("/api/extract-pdf-text", {
    method: "POST",
    headers: { "content-type": "application/pdf" },
    body: bytes,
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body.error === "string" ? body.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as PdfExtractionResult;
}

/** Renders a page range of a PDF as images (data URLs) via the local
 * /api/render-pdf-pages endpoint — for scanned PDFs with no text layer,
 * so those pages can be sent to Claude as pictures instead of text. */
export async function renderPdfPages(file: File, from: number, to: number): Promise<string[]> {
  const bytes = await file.arrayBuffer();
  const response = await fetch(`/api/render-pdf-pages?from=${from}&to=${to}`, {
    method: "POST",
    headers: { "content-type": "application/pdf" },
    body: bytes,
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body.error === "string" ? body.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return (body?.images as string[] | undefined) ?? [];
}

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "imported-ruleset";
}
