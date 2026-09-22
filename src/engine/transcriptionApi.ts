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

export type BulkTranscribeStatus = {
  status: "idle" | "running" | "done" | "cancelled" | "error";
  total: number;
  done: number;
  currentPage: number | null;
  failedPages: { page: number; error: string }[];
  error?: string;
};

/** Starts (or, if one's already running, just confirms) a background
 * transcription job on the dev server for the given pages — the server
 * keeps working through them on its own, independent of this browser tab,
 * so locking the phone or closing the app entirely doesn't interrupt it.
 * Progress is picked up again via getBulkTranscribeStatus + syncBookPages,
 * from this tab or any other one that opens the book later. */
export async function startBulkTranscribe(bookId: string, pages: number[]): Promise<void> {
  const response = await fetch(`/api/library/${bookId}/bulk-transcribe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pages }),
  });
  await readJsonOrThrow<{ ok: true }>(response);
}

export async function cancelBulkTranscribe(bookId: string): Promise<void> {
  const response = await fetch(`/api/library/${bookId}/bulk-transcribe/cancel`, { method: "POST" });
  await readJsonOrThrow<{ ok: true }>(response);
}

export async function getBulkTranscribeStatus(bookId: string): Promise<BulkTranscribeStatus> {
  const response = await fetch(`/api/library/${bookId}/bulk-transcribe-status`);
  return readJsonOrThrow<BulkTranscribeStatus>(response);
}

/** Every page the server has transcribed for this book so far — the
 * durable, server-side copy a background job writes to as it works.
 * Synced down into this browser's own local cache (storage.ts +
 * pageImageStore.ts) by syncBookPages, so the reader keeps working with
 * no server reachable at all once synced, same as a page transcribed
 * directly in this tab always has. */
export async function getServerBookPages(bookId: string): Promise<Record<number, TranscribedPage>> {
  const response = await fetch(`/api/library/${bookId}/pages`);
  const body = await readJsonOrThrow<{ pages: Record<number, TranscribedPage> }>(response);
  return body.pages;
}

export async function getServerPageImage(bookId: string, page: number): Promise<string | undefined> {
  const response = await fetch(`/api/library/${bookId}/page-image/${page}`);
  if (!response.ok) return undefined;
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
