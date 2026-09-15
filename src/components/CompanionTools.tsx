import { useState } from "react";
import { rollDice, type DiceRoll } from "../engine/dice";
import type { RuleSet } from "../engine/types";

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

interface CompanionToolsProps {
  ruleSet: RuleSet;
  onRollTest: (testKey: string) => void;
  onStartCombat: (name: string, stats: Record<string, number>) => void;
  combatActive: boolean;
}

export function CompanionTools({ ruleSet, onRollTest, onStartCombat, combatActive }: CompanionToolsProps) {
  const [monsterName, setMonsterName] = useState("");
  const [attackValue, setAttackValue] = useState("");
  const [damageValue, setDamageValue] = useState("");

  const attackStat = ruleSet.stats.find((s) => s.key === ruleSet.combat.attackStat);
  const damageStat = ruleSet.stats.find((s) => s.key === ruleSet.combat.damageStat);

  const canStart = monsterName.trim() && attackValue.trim() && damageValue.trim();

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canStart) return;
    onStartCombat(monsterName.trim(), {
      [ruleSet.combat.attackStat]: Number(attackValue) || 0,
      [ruleSet.combat.damageStat]: Number(damageValue) || 0,
    });
    setMonsterName("");
    setAttackValue("");
    setDamageValue("");
  };

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
          <button type="submit" className="choice-button secondary" disabled={!canStart}>
            Start Combat
          </button>
        </form>
      )}
    </div>
  );
}
