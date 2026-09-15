// Rendered page images (data URLs) are much larger than the transcribed
// text they came from — too large to comfortably keep in localStorage
// alongside everything else, so they get their own IndexedDB store with
// real quota headroom. Text/choices stay in localStorage (storage.ts);
// this module only ever holds page images.

const DB_NAME = "ff-reader-images";
const STORE_NAME = "pageImages";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function keyFor(bookId: string, pdfPage: number): string {
  return `${bookId}:${pdfPage}`;
}

export async function savePageImage(bookId: string, pdfPage: number, dataUrl: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(dataUrl, keyFor(bookId, pdfPage));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // IndexedDB unavailable (private browsing, disabled) — artwork just won't persist.
  }
}

export async function getPageImage(bookId: string, pdfPage: number): Promise<string | undefined> {
  try {
    const db = await openDb();
    return await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(keyFor(bookId, pdfPage));
      request.onsuccess = () => resolve(request.result as string | undefined);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return undefined;
  }
}

/** Dumps every cached page image, keyed the same way the store itself
 * keys them ("<bookId>:<pdfPage>") — used to build a full backup export. */
export async function getAllPageImages(): Promise<Record<string, string>> {
  try {
    const db = await openDb();
    return await new Promise<Record<string, string>>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const keysRequest = store.getAllKeys();
      const valuesRequest = store.getAll();
      tx.oncomplete = () => {
        const entries: Record<string, string> = {};
        const keys = keysRequest.result;
        const values = valuesRequest.result as string[];
        keys.forEach((key, i) => {
          if (typeof key === "string") entries[key] = values[i];
        });
        resolve(entries);
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return {};
  }
}

/** Replaces the entire page-image store with the given "<bookId>:<pdfPage>"
 * -> dataUrl entries — used to restore a full backup import. */
export async function restoreAllPageImages(entries: Record<string, string>): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      for (const [key, dataUrl] of Object.entries(entries)) store.put(dataUrl, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

/** Deletes every cached page image for a book — used when the book itself
 * is removed from the library, so its artwork doesn't linger forever. */
export async function deleteBookImages(bookId: string): Promise<void> {
  try {
    const db = await openDb();
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const prefix = `${bookId}:`;
    const toDelete = keys.filter((k) => typeof k === "string" && k.startsWith(prefix));
    if (toDelete.length === 0) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      for (const key of toDelete) store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}
