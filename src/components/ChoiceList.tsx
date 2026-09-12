import type { Choice } from "../engine/types";

export function ChoiceList({ choices, onChoose }: { choices: Choice[]; onChoose: (choice: Choice) => void }) {
  if (choices.length === 0) return null;
  return (
    <div className="choice-list">
      {choices.map((choice, i) => (
        <button key={i} type="button" className="choice-button" onClick={() => onChoose(choice)}>
          {choice.text}
        </button>
      ))}
    </div>
  );
}
