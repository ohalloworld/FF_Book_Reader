import { useState } from "react";
import { buildBackup, downloadBackup, parseBackupFile, restoreBackup } from "../engine/backup";

type Status = "idle" | "working" | "error";

/** Everything the app knows lives only in this browser's own storage —
 * clearing site data, reinstalling the PWA, or switching devices loses it
 * all, transcriptions (real API spend) included. This is the one way to
 * get it back out: a single JSON file with every saved game, rule set,
 * library entry, transcribed page, and page image, downloadable any time
 * and re-importable as a full restore. */
export function BackupPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{ file: File; exportedAt: string } | null>(null);

  const handleExport = async () => {
    setStatus("working");
    setError(null);
    try {
      const bundle = await buildBackup();
      downloadBackup(bundle);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build the backup.");
      setStatus("error");
    }
  };

  const handleFilePicked = async (file: File) => {
    setError(null);
    try {
      const bundle = await parseBackupFile(file);
      setPendingImport({ file, exportedAt: bundle.exportedAt });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
      setStatus("error");
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    setStatus("working");
    setError(null);
    try {
      const bundle = await parseBackupFile(pendingImport.file);
      await restoreBackup(bundle);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore the backup.");
      setStatus("error");
      setPendingImport(null);
    }
  };

  return (
    <div className="backup-panel">
      <button type="button" className="link-button" onClick={() => void handleExport()} disabled={status === "working"}>
        {status === "working" && !pendingImport ? "Building backup…" : "Export backup"}
      </button>
      <span className="backup-panel-sep">·</span>
      <label className="link-button backup-import-label">
        Import backup
        <input
          type="file"
          accept="application/json"
          className="pdf-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFilePicked(file);
            e.target.value = "";
          }}
        />
      </label>

      {error && <p className="luck-banner failure backup-panel-message">{error}</p>}

      {pendingImport && (
        <div className="backup-confirm">
          <p className="muted">
            Importing the backup from {new Date(pendingImport.exportedAt).toLocaleString()} will{" "}
            <strong>replace</strong> everything currently in your library — saved games, rule sets, and transcribed
            pages included. This can't be undone.
          </p>
          <div className="importer-actions">
            <button type="button" className="choice-button" onClick={() => void confirmImport()} disabled={status === "working"}>
              {status === "working" ? "Restoring…" : "Replace and restore"}
            </button>
            <button type="button" className="choice-button secondary" onClick={() => setPendingImport(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
