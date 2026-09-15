import { useState } from "react";
import type { RuleSet } from "../engine/types";

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
        For tracking a real book's own paragraphs as you read them — roll a test whenever your book calls for one,
        or start a fight against a monster the book describes.
      </p>

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
