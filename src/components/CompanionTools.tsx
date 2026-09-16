import { useState } from "react";
import { rollDice, type DiceRoll } from "../engine/dice";
import type { MultiMonsterMode, RuleSet } from "../engine/types";

function DiceRoller() {
  const [count, setCount] = useState("2");
  const [sides, setSides] = useState("6");
  const [modifier, setModifier] = useState("0");
  const [result, setResult] = useState<DiceRoll | null>(null);

  const handleRoll = (e: React.FormEvent) => {
    e.preventDefault();
    const c = Math.min(Math.max(parseInt(count, 10) || 1, 1), 20);
    const s = Math.min(Math.max(parseInt(sides, 10) || 6, 2), 100);
    const m = parseInt(modifier, 10) || 0;
    setResult(rollDice(c, s, m));
  };

  return (
    <form className="dice-roller" onSubmit={handleRoll}>
      <div className="dice-roller-inputs">
        <input
          type="number"
          className="dice-roller-count"
          min={1}
          max={20}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          aria-label="Number of dice"
        />
        <span>D</span>
        <input
          type="number"
          className="dice-roller-count"
          min={2}
          max={100}
          value={sides}
          onChange={(e) => setSides(e.target.value)}
          aria-label="Sides per die"
        />
        <span>+</span>
        <input
          type="number"
          className="dice-roller-count"
          value={modifier}
          onChange={(e) => setModifier(e.target.value)}
          aria-label="Modifier"
        />
        <button type="submit" className="choice-button secondary">
          Roll
        </button>
      </div>
      {result && (
        <p className="dice-roller-result">
          {result.rolls.join(" + ")}
          {result.modifier !== 0 && ` ${result.modifier > 0 ? "+" : "-"} ${Math.abs(result.modifier)}`} ={" "}
          <strong>{result.total}</strong>
        </p>
      )}
    </form>
  );
}

export interface ManualMonster {
  name: string;
  stats: Record<string, number>;
}

interface CompanionToolsProps {
  ruleSet: RuleSet;
  onRollTest: (testKey: string) => void;
  onStartCombat: (monsters: ManualMonster[], mode: MultiMonsterMode) => void;
  combatActive: boolean;
}

export function CompanionTools({ ruleSet, onRollTest, onStartCombat, combatActive }: CompanionToolsProps) {
  const [monsterName, setMonsterName] = useState("");
  const [attackValue, setAttackValue] = useState("");
  const [damageValue, setDamageValue] = useState("");
  const [pending, setPending] = useState<ManualMonster[]>([]);
  const [mode, setMode] = useState<MultiMonsterMode>("sequential");

  const attackStat = ruleSet.stats.find((s) => s.key === ruleSet.combat.attackStat);
  const damageStat = ruleSet.stats.find((s) => s.key === ruleSet.combat.damageStat);

  const currentFilled = monsterName.trim() && attackValue.trim() && damageValue.trim();
  const canStart = pending.length > 0 || currentFilled;

  const currentAsMonster = (): ManualMonster | null =>
    currentFilled
      ? {
          name: monsterName.trim(),
          stats: {
            [ruleSet.combat.attackStat]: Number(attackValue) || 0,
            [ruleSet.combat.damageStat]: Number(damageValue) || 0,
          },
        }
      : null;

  const handleAddAnother = () => {
    const monster = currentAsMonster();
    if (!monster) return;
    setPending((p) => [...p, monster]);
    setMonsterName("");
    setAttackValue("");
    setDamageValue("");
  };

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    const monster = currentAsMonster();
    const monsters = monster ? [...pending, monster] : pending;
    if (monsters.length === 0) return;
    onStartCombat(monsters, mode);
    setPending([]);
    setMonsterName("");
    setAttackValue("");
    setDamageValue("");
    setMode("sequential");
  };

  const totalMonsters = pending.length + (currentFilled ? 1 : 0);

  return (
    <div className="companion-tools">
      <h3>Companion Tools</h3>
      <p className="muted">
        For tracking a real book's own paragraphs as you read them — roll dice for anything the book asks for, roll
        a named test, or start a fight against a monster the book describes.
      </p>

      <DiceRoller />

      {ruleSet.tests.length > 0 && (
        <div className="companion-tests">
          {ruleSet.tests.map((test) => (
            <button key={test.key} type="button" className="choice-button secondary" onClick={() => onRollTest(test.key)}>
              {test.label}
            </button>
          ))}
        </div>
      )}

      {!combatActive && (
        <div className="companion-combat">
          {pending.length > 0 && (
            <ul className="pending-monsters-list">
              {pending.map((m, i) => (
                <li key={i}>
                  {m.name} ({attackStat?.label ?? "Attack"} {m.stats[ruleSet.combat.attackStat]}, {damageStat?.label ?? "Stamina"}{" "}
                  {m.stats[ruleSet.combat.damageStat]})
                  <button
                    type="button"
                    className="item-remove-button"
                    aria-label={`Remove ${m.name}`}
                    onClick={() => setPending((p) => p.filter((_, idx) => idx !== i))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {totalMonsters > 1 && (
            <fieldset className="multi-monster-mode">
              <legend>How do they fight? (check this book's own rules — it varies by book)</legend>
              <label>
                <input
                  type="radio"
                  name="multi-monster-mode"
                  checked={mode === "sequential"}
                  onChange={() => setMode("sequential")}
                />
                One at a time, in order (most books' default)
              </label>
              <label>
                <input
                  type="radio"
                  name="multi-monster-mode"
                  checked={mode === "simultaneous"}
                  onChange={() => setMode("simultaneous")}
                />
                All of them attack every round
              </label>
            </fieldset>
          )}
          <form className="companion-combat-form" onSubmit={handleStart}>
            <input
              type="text"
              placeholder="Monster name"
              value={monsterName}
              onChange={(e) => setMonsterName(e.target.value)}
            />
            <input
              type="number"
              placeholder={attackStat?.label ?? "Attack"}
              value={attackValue}
              onChange={(e) => setAttackValue(e.target.value)}
            />
            <input
              type="number"
              placeholder={damageStat?.label ?? "Stamina"}
              value={damageValue}
              onChange={(e) => setDamageValue(e.target.value)}
            />
            <button type="button" className="choice-button secondary" disabled={!currentFilled} onClick={handleAddAnother}>
              Add another monster
            </button>
            <button type="submit" className="choice-button" disabled={!canStart}>
              Start Combat
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
