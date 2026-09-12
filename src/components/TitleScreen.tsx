import { useState } from "react";
import type { Gamebook } from "../engine/types";

export function TitleScreen({
  book,
  hasSave,
  onStart,
  onResume,
}: {
  book: Gamebook;
  hasSave: boolean;
  onStart: (name: string) => void;
  onResume: () => void;
}) {
  const [name, setName] = useState("");

  return (
    <div className="title-screen">
      <h1>{book.title}</h1>
      <p className="muted">by {book.author}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onStart(name);
        }}
      >
        <label htmlFor="hero-name">Your name</label>
        <input
          id="hero-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Adventurer"
          autoFocus
        />
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
      </form>
    </div>
  );
}
