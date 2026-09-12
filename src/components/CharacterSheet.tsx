import type { Character } from "../engine/types";

function Stat({ label, block }: { label: string; block: { current: number; initial: number } }) {
  const pct = block.initial === 0 ? 0 : Math.round((block.current / block.initial) * 100);
  const low = pct <= 25;
  return (
    <div className="stat">
      <div className="stat-label">
        <span>{label}</span>
        <span className="stat-value">
          {block.current} / {block.initial}
        </span>
      </div>
      <div className="stat-bar">
        <div
          className={"stat-bar-fill" + (low ? " low" : "")}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

export function CharacterSheet({ character }: { character: Character }) {
  return (
    <aside className="character-sheet">
      <h2>{character.name}</h2>
      <Stat label="SKILL" block={character.skill} />
      <Stat label="STAMINA" block={character.stamina} />
      <Stat label="LUCK" block={character.luck} />

      <div className="sheet-row">
        <span>Gold</span>
        <span>{character.gold}</span>
      </div>
      <div className="sheet-row">
        <span>Provisions</span>
        <span>{character.provisions}</span>
      </div>

      <h3>Inventory</h3>
      {character.inventory.length === 0 ? (
        <p className="muted">Empty</p>
      ) : (
        <ul className="inventory-list">
          {character.inventory.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}
