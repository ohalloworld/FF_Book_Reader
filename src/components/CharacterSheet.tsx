import { useState } from "react";
import type { AbilityDefinition, Character, RuleSet, StatDefinition } from "../engine/types";

export interface CharacterSheetActions {
  adjustPool: (statKey: string, delta: number) => void;
  adjustPoolMax: (statKey: string, delta: number) => void;
  adjustCounter: (statKey: string, delta: number) => void;
  addItem: (item: string) => void;
  removeItem: (item: string) => void;
  useAbility: (abilityKey: string) => void;
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
  onAdjustMax,
}: {
  label: string;
  value: { current: number; initial: number };
  onAdjust?: (delta: number) => void;
  onAdjustMax?: (delta: number) => void;
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
      {onAdjustMax && (
        <div className="stat-max-adjuster">
          <span className="stat-max-adjuster-label">Max</span>
          <StatAdjuster onAdjust={onAdjustMax} />
        </div>
      )}
    </div>
  );
}

/** Renders one group's pool/counter stats — either the top-level "no
 * group" set (SKILL, STAMINA, LUCK...) or a named sub-system's own stats
 * (a starship's Armour/Fuel, say), same markup either way. */
function StatGroup({
  stats,
  character,
  actions,
}: {
  stats: StatDefinition[];
  character: Character;
  actions?: CharacterSheetActions;
}) {
  return (
    <>
      {stats
        .filter((s) => s.kind === "pool")
        .map((stat) => {
          const value = character.pools[stat.key];
          return value ? (
            <PoolStat
              key={stat.key}
              label={stat.label}
              value={value}
              onAdjust={actions ? (delta) => actions.adjustPool(stat.key, delta) : undefined}
              onAdjustMax={actions ? (delta) => actions.adjustPoolMax(stat.key, delta) : undefined}
            />
          ) : null;
        })}
      {stats
        .filter((s) => s.kind === "counter")
        .map((stat) => (
          <div className="sheet-row counter-row" key={stat.key}>
            <span>{stat.label}</span>
            <span className="counter-row-right">
              <span>{character.counters[stat.key] ?? 0}</span>
              {actions && <StatAdjuster onAdjust={(delta) => actions.adjustCounter(stat.key, delta)} />}
            </span>
          </div>
        ))}
    </>
  );
}

function AbilityItem({
  ability,
  ruleSet,
  character,
  actions,
}: {
  ability: AbilityDefinition;
  ruleSet: RuleSet;
  character: Character;
  actions?: CharacterSheetActions;
}) {
  const costStat = ability.costStatKey ? ruleSet.stats.find((s) => s.key === ability.costStatKey) : undefined;
  const hasCost = Boolean(ability.costStatKey && ability.costAmount);
  const available =
    !hasCost || !ability.costStatKey || !ability.costAmount
      ? true
      : costStat?.kind === "counter"
        ? (character.counters[ability.costStatKey] ?? 0) >= ability.costAmount
        : (character.pools[ability.costStatKey]?.current ?? 0) >= ability.costAmount;

  return (
    <li className="ability-item">
      <div className="ability-item-header">
        <strong>{ability.label}</strong>
        {hasCost && (
          <span className="muted small">
            {ability.costAmount} {costStat?.label ?? ability.costStatKey}
          </span>
        )}
      </div>
      <p className="muted small ability-description">{ability.description}</p>
      {actions && (
        <button
          type="button"
          className="choice-button secondary"
          disabled={!available}
          onClick={() => actions.useAbility(ability.key)}
        >
          Use
        </button>
      )}
    </li>
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
  const [newItem, setNewItem] = useState("");

  const ungroupedStats = ruleSet.stats.filter((s) => !s.group);
  const abilities = ruleSet.abilities ?? [];
  const ungroupedAbilities = abilities.filter((a) => !a.group);

  const groupNames = Array.from(
    new Set([...ruleSet.stats.flatMap((s) => (s.group ? [s.group] : [])), ...abilities.flatMap((a) => (a.group ? [a.group] : []))]),
  );

  return (
    <aside className="character-sheet">
      <h2>{character.name}</h2>
      <StatGroup stats={ungroupedStats} character={character} actions={actions} />

      {ungroupedAbilities.length > 0 && (
        <>
          <h3>Abilities</h3>
          <ul className="ability-list">
            {ungroupedAbilities.map((ability) => (
              <AbilityItem key={ability.key} ability={ability} ruleSet={ruleSet} character={character} actions={actions} />
            ))}
          </ul>
        </>
      )}

      {groupNames.map((group) => {
        const groupStats = ruleSet.stats.filter((s) => s.group === group);
        const groupAbilities = abilities.filter((a) => a.group === group);
        return (
          <div className="stat-group" key={group}>
            <h3>{group}</h3>
            <StatGroup stats={groupStats} character={character} actions={actions} />
            {groupAbilities.length > 0 && (
              <ul className="ability-list">
                {groupAbilities.map((ability) => (
                  <AbilityItem key={ability.key} ability={ability} ruleSet={ruleSet} character={character} actions={actions} />
                ))}
              </ul>
            )}
          </div>
        );
      })}

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
