import { useState } from "react";
import type { Gamebook } from "../engine/types";

export function TitleScreen({
  book,
  hasSave,
  onStart,
  onResume,
  onExit,
}: {
  book: Gamebook;
  hasSave: boolean;
  onStart: (name: string) => void;
  onResume: () => void;
  onExit?: () => void;
}) {
  const [name, setName] = useState("");
  const [confirmingOverwrite, setConfirmingOverwrite] = useState(false);

  return (
    <div className="title-screen">
      {onExit && (
        <button type="button" className="link-button" onClick={onExit}>
          ← Back to Library
        </button>
      )}
      <h1>{book.title}</h1>
      {book.author && <p className="muted">by {book.author}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (hasSave && !confirmingOverwrite) {
            setConfirmingOverwrite(true);
            return;
          }
          onStart(name);
        }}
      >
        <label htmlFor="hero-name">Your name</label>
        <input
          id="hero-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setConfirmingOverwrite(false);
          }}
          placeholder="Adventurer"
          autoFocus
        />

        {confirmingOverwrite ? (
          <div className="overwrite-confirm">
            <p className="muted">Starting a new adventure deletes your saved game for this book. This can't be undone.</p>
            <div className="title-actions">
              <button type="submit" className="choice-button">
                Yes, start over
              </button>
              <button type="button" className="choice-button secondary" onClick={() => setConfirmingOverwrite(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="title-actions">
            <button type="submit" className="choice-button">
              Begin a new adventure
            </button>
            {hasSave && (
              <button type="button" className="choice-button secondary" onClick={onResume}>
                Resume saved game
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
