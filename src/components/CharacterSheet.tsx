import { useState } from "react";
import type { Character, RuleSet } from "../engine/types";

export interface CharacterSheetActions {
  adjustPool: (statKey: string, delta: number) => void;
  adjustCounter: (statKey: string, delta: number) => void;
  addItem: (item: string) => void;
  removeItem: (item: string) => void;
}

function StatAdjuster({ onAdjust }: { onAdjust: (delta: number) => void }) {
  const [amount, setAmount] = useState("1");
  const parsed = Math.max(1, Math.round(Number(amount)) || 1);

  return (
    <div className="stat-adjuster">
      <button type="button" className="stat-adjust-button" onClick={() => onAdjust(-parsed)}>
        −
      </button>
      <input
        type="number"
        min={1}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        aria-label="Adjustment amount"
      />
      <button type="button" className="stat-adjust-button" onClick={() => onAdjust(parsed)}>
        +
      </button>
    </div>
  );
}

function PoolStat({
  label,
  value,
  onAdjust,
}: {
  label: string;
  value: { current: number; initial: number };
  onAdjust?: (delta: number) => void;
}) {
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
      {onAdjust && <StatAdjuster onAdjust={onAdjust} />}
    </div>
  );
}

export function CharacterSheet({
  character,
  ruleSet,
  actions,
}: {
  character: Character;
  ruleSet: RuleSet;
  actions?: CharacterSheetActions;
}) {
  const pools = ruleSet.stats.filter((s) => s.kind === "pool");
  const counters = ruleSet.stats.filter((s) => s.kind === "counter");
  const [newItem, setNewItem] = useState("");

  return (
    <aside className="character-sheet">
      <h2>{character.name}</h2>
      {pools.map((stat) => {
        const value = character.pools[stat.key];
        return value ? (
          <PoolStat
            key={stat.key}
            label={stat.label}
            value={value}
            onAdjust={actions ? (delta) => actions.adjustPool(stat.key, delta) : undefined}
          />
        ) : null;
      })}

      {counters.map((stat) => (
        <div className="sheet-row counter-row" key={stat.key}>
          <span>{stat.label}</span>
          <span className="counter-row-right">
            <span>{character.counters[stat.key] ?? 0}</span>
            {actions && <StatAdjuster onAdjust={(delta) => actions.adjustCounter(stat.key, delta)} />}
          </span>
        </div>
      ))}

      <h3>Inventory</h3>
      {character.inventory.length === 0 ? (
        <p className="muted">Empty</p>
      ) : (
        <ul className="inventory-list">
          {character.inventory.map((item) => (
            <li key={item}>
              {item}
              {actions && (
                <button
                  type="button"
                  className="item-remove-button"
                  aria-label={`Remove ${item}`}
                  onClick={() => actions.removeItem(item)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {actions && (
        <form
          className="add-item-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newItem.trim()) return;
            actions.addItem(newItem);
            setNewItem("");
          }}
        >
          <input
            type="text"
            placeholder="Add item…"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
          />
          <button type="submit" className="choice-button secondary" disabled={!newItem.trim()}>
            Add
          </button>
        </form>
      )}
    </aside>
  );
}
