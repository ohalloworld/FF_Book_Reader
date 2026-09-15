import { useState } from "react";
import { extractPdfText, renderPdfPages, type PdfPage } from "../engine/parseRulesApi";

type Status = "idle" | "loading" | "error";

interface PdfImportPanelProps {
  onUseText: (text: string) => void;
  onUseImages: (images: string[]) => void;
}

export function PdfImportPanel({ onUseText, onUseImages }: PdfImportPanelProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PdfPage[] | null>(null);
  const [total, setTotal] = useState(0);
  const [title, setTitle] = useState<string | undefined>();
  const [warning, setWarning] = useState<string | undefined>();
  const [fileName, setFileName] = useState<string | null>(null);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(1);

  const [renderStatus, setRenderStatus] = useState<Status>("idle");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderedImages, setRenderedImages] = useState<string[] | null>(null);

  const handleFile = async (selected: File) => {
    setStatus("loading");
    setError(null);
    setFile(selected);
    setFileName(selected.name);
    setRenderedImages(null);
    setRenderError(null);
    try {
      const result = await extractPdfText(selected);
      setPages(result.pages);
      setTotal(result.total);
      setTitle(result.title);
      setWarning(result.warning);
      setFromPage(1);
      setToPage(Math.min(10, result.total || 1));
      setStatus("idle");
    } catch (err) {
      setPages(null);
      setError(err instanceof Error ? err.message : "Failed to read PDF.");
      setStatus("error");
    }
  };

  const clampedFrom = Math.max(1, Math.min(fromPage || 1, total || 1));
  const clampedTo = Math.max(clampedFrom, Math.min(toPage || 1, total || 1));

  const previewText = pages
    ? pages
        .filter((p) => p.num >= clampedFrom && p.num <= clampedTo)
        .map((p) => p.text.trim())
        .join("\n\n")
        .trim()
    : "";

  const handleRenderImages = async () => {
    if (!file) return;
    setRenderStatus("loading");
    setRenderError(null);
    try {
      const images = await renderPdfPages(file, clampedFrom, clampedTo);
      setRenderedImages(images);
      setRenderStatus("idle");
    } catch (err) {
      setRenderedImages(null);
      setRenderError(err instanceof Error ? err.message : "Failed to render pages.");
      setRenderStatus("error");
    }
  };

  return (
    <div className="pdf-import">
      <label className="pdf-file-label">
        <input
          type="file"
          accept="application/pdf"
          className="pdf-file-input"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) void handleFile(selected);
          }}
        />
        {status === "loading" ? "Reading PDF…" : "Choose a PDF"}
      </label>

      {fileName && (
        <p className="muted">
          {fileName}
          {title ? ` — "${title}"` : ""}
          {total ? `, ${total} page${total === 1 ? "" : "s"}` : ""}
        </p>
      )}

      {status === "error" && error && <p className="luck-banner failure">{error}</p>}
      {warning && <p className="luck-banner failure">{warning}</p>}

      {pages && total > 0 && (
        <>
          <div className="pdf-range-picker">
            <label>
              From page
              <input
                type="number"
                min={1}
                max={total}
                value={fromPage}
                onChange={(e) => setFromPage(Number(e.target.value))}
              />
            </label>
            <label>
              To page
              <input
                type="number"
                min={1}
                max={total}
                value={toPage}
                onChange={(e) => setToPage(Number(e.target.value))}
              />
            </label>
            <span className="muted">of {total} pages</span>
          </div>
          <p className="muted">
            Rules and adventure-sheet pages are usually near the front of the book — adjust the range until the
            preview below shows rules text, not story text, then use it.
          </p>
          <div className="pdf-preview">{previewText || <span className="muted">No text in this range.</span>}</div>
          <div className="importer-actions">
            <button
              type="button"
              className="choice-button secondary"
              disabled={!previewText}
              onClick={() => onUseText(previewText)}
            >
              Use this text
            </button>
            <button
              type="button"
              className="choice-button secondary"
              disabled={renderStatus === "loading"}
              onClick={handleRenderImages}
            >
              {renderStatus === "loading" ? "Rendering pages…" : "Scanned PDF? Parse from page images"}
            </button>
          </div>

          {renderStatus === "error" && renderError && <p className="luck-banner failure">{renderError}</p>}

          {renderedImages && renderedImages.length > 0 && (
            <>
              <div className="pdf-image-thumbs">
                {renderedImages.map((img, i) => (
                  <img key={i} src={img} alt={`Page ${clampedFrom + i}`} />
                ))}
              </div>
              <div className="importer-actions">
                <button type="button" className="choice-button secondary" onClick={() => onUseImages(renderedImages)}>
                  Use these {renderedImages.length} page image{renderedImages.length === 1 ? "" : "s"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
