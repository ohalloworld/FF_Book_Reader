import { useState } from "react";
import type { Section, TranscribedParagraph } from "../engine/types";
import type { LuckOutcome } from "../engine/useGameSession";

interface EditableChoice {
  text: string;
  to: string;
}

function EditForm({
  section,
  onSave,
  onCancel,
}: {
  section: Section;
  onSave: (paragraph: TranscribedParagraph) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(section.text);
  const [choices, setChoices] = useState<EditableChoice[]>(
    section.choices.map((c) => ({ text: c.text, to: c.to })),
  );

  const updateChoice = (i: number, patch: Partial<EditableChoice>) => {
    setChoices((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  return (
    <div className="section-edit-form">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Paragraph text…" />

      <h4>Choices</h4>
      {choices.map((choice, i) => (
        <div className="section-edit-choice" key={i}>
          <input
            type="text"
            placeholder="Choice text"
            value={choice.text}
            onChange={(e) => updateChoice(i, { text: e.target.value })}
          />
          <input
            type="text"
            placeholder="Go to #"
            value={choice.to}
            onChange={(e) => updateChoice(i, { to: e.target.value })}
          />
          <button type="button" className="item-remove-button" onClick={() => setChoices((cs) => cs.filter((_, idx) => idx !== i))}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="choice-button secondary" onClick={() => setChoices((cs) => [...cs, { text: "", to: "" }])}>
        Add choice
      </button>

      <div className="importer-actions">
        <button
          type="button"
          className="choice-button"
          onClick={() =>
            onSave({
              id: section.id,
              text: text.trim(),
              choices: choices.filter((c) => c.text.trim() && c.to.trim()).map((c) => ({ text: c.text.trim(), to: c.to.trim() })),
            })
          }
        >
          Save
        </button>
        <button type="button" className="choice-button secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SectionView({
  section,
  luckOutcome,
  onSaveOverride,
}: {
  section: Section;
  luckOutcome: LuckOutcome | null;
  onSaveOverride?: (paragraph: TranscribedParagraph) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing && onSaveOverride) {
    return (
      <div className="section-view">
        <div className="section-number">{section.id}</div>
        <EditForm
          section={section}
          onSave={(paragraph) => {
            onSaveOverride(paragraph);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="section-view">
      <div className="section-number">{section.id}</div>
      {section.text.trim() ? (
        <p className="section-text">{section.text}</p>
      ) : (
        <p className="section-text muted">
          No text saved for section {section.id} yet — read it from your book, then use the box below to keep
          going.
        </p>
      )}

      {onSaveOverride && (
        <button type="button" className="link-button" onClick={() => setEditing(true)}>
          {section.text.trim() ? "Edit this paragraph" : "Type it in by hand"}
        </button>
      )}

      {luckOutcome?.context === "general" && (
        <p className={"luck-banner" + (luckOutcome.success ? " success" : " failure")}>
          You rolled {luckOutcome.roll} against your Luck — {luckOutcome.success ? "you were lucky!" : "your luck ran out."}
        </p>
      )}

      {section.ending === "victory" && <p className="ending victory">Victory! Your adventure ends here.</p>}
      {section.ending === "death" && <p className="ending death">Your adventure ends here.</p>}
    </div>
  );
}
