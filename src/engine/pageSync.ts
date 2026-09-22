import { savePageImage } from "./pageImageStore";
import { getBookPages, saveBookPage } from "./storage";
import { getServerBookPages, getServerPageImage } from "./transcriptionApi";

/** Pulls down every page the server has transcribed (via a background
 * bulk-transcribe job, or a single-page transcription from any tab) that
 * isn't already in this browser's own local cache — the last step that
 * makes a server-run job actually show up as read-ready pages here, on
 * whichever device asks. Returns the page numbers that were newly synced. */
export async function syncBookPages(bookId: string): Promise<number[]> {
  const local = getBookPages(bookId);
  const server = await getServerBookPages(bookId);
  const newPages = Object.values(server).filter((page) => !(page.pdfPage in local));

  for (const page of newPages) {
    saveBookPage(bookId, page);
    const imageDataUrl = await getServerPageImage(bookId, page.pdfPage);
    if (imageDataUrl) await savePageImage(bookId, page.pdfPage, imageDataUrl);
  }

  return newPages.map((p) => p.pdfPage);
}
