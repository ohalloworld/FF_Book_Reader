import type { TranscribedPage } from "./types";

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body.error === "string" ? body.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export interface PdfStatus {
  exists: boolean;
  totalPages?: number;
}

/** Uploads a book's PDF to the local dev server, which stores it on disk
 * (.local-books/, gitignored) keyed by the library book's id, so pages can
 * be transcribed on demand later without re-uploading the file. */
export async function attachBookPdf(bookId: string, file: File): Promise<void> {
  const bytes = await file.arrayBuffer();
  const response = await fetch(`/api/library/${bookId}/pdf`, {
    method: "POST",
    headers: { "content-type": "application/pdf" },
    body: bytes,
  });
  await readJsonOrThrow<{ ok: true }>(response);
}

export async function getPdfStatus(bookId: string): Promise<PdfStatus> {
  const response = await fetch(`/api/library/${bookId}/pdf-status`);
  return readJsonOrThrow<PdfStatus>(response);
}

/** Deletes a book's stored PDF from the local server's disk — used when
 * the library entry itself is removed, so its content doesn't linger. */
export async function detachBookPdf(bookId: string): Promise<void> {
  const response = await fetch(`/api/library/${bookId}/pdf`, { method: "DELETE" });
  await readJsonOrThrow<{ ok: true }>(response);
}

export interface PageTranscriptionResult extends TranscribedPage {
  /** The rendered page image (data URL) the transcription was read from —
   * the same image, at zero extra cost, so it can be cached and shown as
   * the book's own artwork. */
  imageDataUrl?: string;
}

/** Renders one PDF page and sends it to Claude to transcribe its numbered
 * paragraphs (text + outgoing choices). Requires a PDF already attached
 * via attachBookPdf. */
export async function transcribePage(bookId: string, page: number): Promise<PageTranscriptionResult> {
  const response = await fetch(`/api/library/${bookId}/transcribe-page`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ page }),
  });
  return readJsonOrThrow<PageTranscriptionResult>(response);
}
