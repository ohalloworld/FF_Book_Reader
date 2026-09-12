import { useState } from "react";
import { parseRulesText, slugify } from "../engine/parseRulesApi";
import { deleteRuleSet, listSavedRuleSets, saveRuleSet } from "../engine/storage";
import type { RuleSet } from "../engine/types";
import { PdfImportPanel } from "./PdfImportPanel";
import { RuleSetSandbox } from "./RuleSetSandbox";
import { RuleSetSummary } from "./RuleSetSummary";

type Status = "idle" | "loading" | "error";

export function RulesImporter() {
  const [rulesText, setRulesText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RuleSet | null>(null);
  const [saved, setSaved] = useState<RuleSet[]>(() => listSavedRuleSets());
  const [previewing, setPreviewing] = useState<RuleSet | null>(null);

  const handleParse = async () => {
    if (!rulesText.trim()) return;
    setStatus("loading");
    setError(null);
    try {
      const extracted = await parseRulesText(rulesText);
      const ruleSet: RuleSet = { ...extracted, id: slugify(extracted.bookTitle), source: "imported" };
      setDraft(ruleSet);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  };

  const handleSave = () => {
    if (!draft) return;
    saveRuleSet(draft);
    setSaved(listSavedRuleSets());
  };

  const handleDelete = (id: string) => {
    deleteRuleSet(id);
    setSaved(listSavedRuleSets());
    if (previewing?.id === id) setPreviewing(null);
  };

  return (
    <div className="importer">
      <h1>Import Book Rules</h1>
      <p className="muted">
        Paste the rules section from a gamebook you own — stat generation, combat, Luck/Skill tests, starting
        equipment, any special mechanics — and Claude will turn it into a structured rule set the reader can use.
        This calls your local dev server, which uses your own Anthropic API key (see <code>.env</code>) and never
        sends the key to the browser.
      </p>

      <h2 className="importer-subhead">From a PDF</h2>
      <p className="muted">
        Upload a book's PDF, pick the page range covering its rules section, and use the extracted text below. The
        PDF is read entirely on your machine and is never uploaded anywhere else.
      </p>
      <PdfImportPanel onUseText={setRulesText} />

      <h2 className="importer-subhead">Rules Text</h2>
      <textarea
        className="rules-textarea"
        placeholder="Paste the book's rules section here..."
        value={rulesText}
        onChange={(e) => setRulesText(e.target.value)}
        rows={12}
      />

      <div className="importer-actions">
        <button type="button" className="choice-button" disabled={status === "loading" || !rulesText.trim()} onClick={handleParse}>
          {status === "loading" ? "Parsing with Claude…" : "Parse Rules"}
        </button>
      </div>

      {status === "error" && error && <p className="luck-banner failure">{error}</p>}

      {draft && (
        <div className="draft-panel">
          <h2>{draft.bookTitle}</h2>
          <RuleSetSummary ruleSet={draft} />
          <div className="importer-actions">
            <button type="button" className="choice-button" onClick={handleSave}>
              Save this rule set
            </button>
            <button type="button" className="choice-button secondary" onClick={() => setPreviewing(draft)}>
              Try it out
            </button>
          </div>
        </div>
      )}

      {saved.length > 0 && (
        <div className="saved-rulesets">
          <h2>Saved Rule Sets</h2>
          <ul>
            {saved.map((rs) => (
              <li key={rs.id} className="saved-ruleset-row">
                <span>{rs.bookTitle}</span>
                <span className="saved-ruleset-actions">
                  <button type="button" className="choice-button secondary" onClick={() => setPreviewing(rs)}>
                    Try it out
                  </button>
                  <button type="button" className="choice-button secondary" onClick={() => handleDelete(rs.id)}>
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {previewing && (
        <div className="draft-panel">
          <h2>Sandbox: {previewing.bookTitle}</h2>
          <p className="muted">
            Rolls a test character with this rule set and lets you attack a sample monster to see the character
            sheet and combat math in action.
          </p>
          <RuleSetSandbox ruleSet={previewing} />
        </div>
      )}
    </div>
  );
}
