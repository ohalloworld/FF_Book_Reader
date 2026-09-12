import { useState } from "react";

interface ParagraphNavProps {
  onGoToParagraph: (id: string) => void;
  onGoBack: () => void;
  canGoBack: boolean;
}

export function ParagraphNav({ onGoToParagraph, onGoBack, canGoBack }: ParagraphNavProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onGoToParagraph(value);
    setValue("");
  };

  return (
    <div className="paragraph-nav">
      <button type="button" className="choice-button secondary" disabled={!canGoBack} onClick={onGoBack}>
        ← Previous
      </button>
      <form className="paragraph-jump" onSubmit={handleSubmit}>
        <label htmlFor="paragraph-jump-input">Go to paragraph</label>
        <input
          id="paragraph-jump-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="e.g. 245"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="choice-button secondary" disabled={!value.trim()}>
          Go
        </button>
      </form>
    </div>
  );
}
