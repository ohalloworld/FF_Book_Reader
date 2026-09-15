import { getAllPageImages, restoreAllPageImages } from "./pageImageStore";

const LOCALSTORAGE_PREFIX = "ff-reader:";
const BACKUP_VERSION = 1;

export interface BackupBundle {
  version: number;
  exportedAt: string;
  /** Every "ff-reader:"-prefixed localStorage key, verbatim — saved games,
   * rule sets, library entries, transcribed pages, manual overrides. */
  localStorage: Record<string, string>;
  /** Every cached page image, from pageImageStore's IndexedDB store. */
  pageImages: Record<string, string>;
}

function dumpLocalStorage(): Record<string, string> {
  const dump: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(LOCALSTORAGE_PREFIX)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) dump[key] = value;
  }
  return dump;
}

export async function buildBackup(): Promise<BackupBundle> {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    localStorage: dumpLocalStorage(),
    pageImages: await getAllPageImages(),
  };
}

export function downloadBackup(bundle: BackupBundle): void {
  const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ff-book-reader-backup-${bundle.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function isBackupBundle(value: unknown): value is BackupBundle {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.version === "number" &&
    typeof v.localStorage === "object" &&
    v.localStorage !== null &&
    typeof v.pageImages === "object" &&
    v.pageImages !== null
  );
}

export async function parseBackupFile(file: File): Promise<BackupBundle> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON — is it a FF Book Reader backup?");
  }
  if (!isBackupBundle(parsed)) {
    throw new Error("That file doesn't look like a FF Book Reader backup.");
  }
  return parsed;
}

/** Fully replaces every ff-reader: localStorage key and every cached page
 * image with what's in the bundle — a true restore, not a merge, so the
 * result always matches what was exported. Reload the page after this
 * resolves so every component re-reads from storage on a clean mount. */
export async function restoreBackup(bundle: BackupBundle): Promise<void> {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(LOCALSTORAGE_PREFIX)) toRemove.push(key);
  }
  toRemove.forEach((key) => localStorage.removeItem(key));
  for (const [key, value] of Object.entries(bundle.localStorage)) {
    localStorage.setItem(key, value);
  }
  await restoreAllPageImages(bundle.pageImages);
}
