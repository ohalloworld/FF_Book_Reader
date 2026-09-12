import type { Character, RuleSet } from "../engine/types";

function PoolStat({ label, value }: { label: string; value: { current: number; initial: number } }) {
  const pct = value.initial === 0 ? 0 : Math.round((value.current / value.initial) * 100);
  const low = pct <= 25;
  return (
    <div className="stat">
      <div className="stat-label">
        <span>{label}</span>
        <span className="stat-value">
          {value.current} / {value.initial}
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

export function CharacterSheet({ character, ruleSet }: { character: Character; ruleSet: RuleSet }) {
  const pools = ruleSet.stats.filter((s) => s.kind === "pool");
  const counters = ruleSet.stats.filter((s) => s.kind === "counter");

  return (
    <aside className="character-sheet">
      <h2>{character.name}</h2>
      {pools.map((stat) => {
        const value = character.pools[stat.key];
        return value ? <PoolStat key={stat.key} label={stat.label} value={value} /> : null;
      })}

      {counters.map((stat) => (
        <div className="sheet-row" key={stat.key}>
          <span>{stat.label}</span>
          <span>{character.counters[stat.key] ?? 0}</span>
        </div>
      ))}

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
