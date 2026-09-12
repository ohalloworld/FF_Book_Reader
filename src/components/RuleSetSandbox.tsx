import { CharacterSheet } from "./CharacterSheet";
import { useRuleSetSandbox } from "../engine/useRuleSetSandbox";
import type { RuleSet } from "../engine/types";

export function RuleSetSandbox({ ruleSet }: { ruleSet: RuleSet }) {
  const sandbox = useRuleSetSandbox(ruleSet);

  return (
    <div className="sandbox">
      <div className="sandbox-actions">
        <button type="button" className="choice-button" onClick={sandbox.rollCharacter}>
          {sandbox.character ? "Roll a new character" : "Roll a test character"}
        </button>
        {sandbox.character && !sandbox.monsterDefeated && sandbox.isAlive && (
          <button type="button" className="choice-button secondary" onClick={sandbox.attack}>
            Attack the {sandbox.monster.name}
          </button>
        )}
      </div>

      {sandbox.character && (
        <div className="sandbox-grid">
          <CharacterSheet character={sandbox.character} ruleSet={ruleSet} />
          <div className="sandbox-combat">
            <h3>{sandbox.monster.name}</h3>
            <p className="muted">
              {ruleSet.combat.attackStat}: {sandbox.monster.stats[ruleSet.combat.attackStat] ?? 0} ·{" "}
              {ruleSet.combat.damageStat}: {sandbox.monster.stats[ruleSet.combat.damageStat] ?? 0} / {sandbox.monsterMax}
            </p>
            {sandbox.monsterDefeated && <p className="ending victory">Defeated!</p>}
            {!sandbox.isAlive && <p className="ending death">You were defeated.</p>}
            <ul className="combat-sandbox-log">
              {sandbox.log.map((entry, i) => (
                <li key={i}>{entry.text}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
