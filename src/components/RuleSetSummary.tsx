import type { RuleSet } from "../engine/types";

export function RuleSetSummary({ ruleSet }: { ruleSet: RuleSet }) {
  const attackStat = ruleSet.stats.find((s) => s.key === ruleSet.combat.attackStat);
  const damageStat = ruleSet.stats.find((s) => s.key === ruleSet.combat.damageStat);

  return (
    <div className="ruleset-summary">
      <h3>Stats</h3>
      <table className="ruleset-table">
        <thead>
          <tr>
            <th>Label</th>
            <th>Key</th>
            <th>Kind</th>
            <th>Generation</th>
            <th>Group</th>
          </tr>
        </thead>
        <tbody>
          {ruleSet.stats.map((s) => (
            <tr key={s.key}>
              <td>{s.label}</td>
              <td>
                <code>{s.key}</code>
              </td>
              <td>{s.kind}</td>
              <td>{s.generation}</td>
              <td>{s.group ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Tests</h3>
      {ruleSet.tests.length === 0 ? (
        <p className="muted">None found.</p>
      ) : (
        <ul>
          {ruleSet.tests.map((t) => (
            <li key={t.key}>
              <strong>{t.label}</strong> — roll {t.rollFormula} against {t.statKey}, success when{" "}
              {t.successWhen === "lte" ? "roll ≤ stat" : "roll ≥ stat"}
              {t.decrementStatOnUse ? `, stat drops by ${t.decrementStatOnUse} each use` : ""}.
            </li>
          ))}
        </ul>
      )}

      <h3>Combat</h3>
      <p>
        Roll {ruleSet.combat.rollFormula} + {attackStat?.label ?? ruleSet.combat.attackStat} for Attack Strength;
        the loser's {damageStat?.label ?? ruleSet.combat.damageStat} drops by {ruleSet.combat.damagePerHit}.
        {ruleSet.combat.luckTestKey && ` A ${ruleSet.combat.luckTestKey} test can adjust damage by ${ruleSet.combat.luckExtraDamage ?? 1}.`}
      </p>

      {ruleSet.startingInventory && ruleSet.startingInventory.length > 0 && (
        <>
          <h3>Starting Equipment</h3>
          <ul>
            {ruleSet.startingInventory.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}

      {ruleSet.abilities && ruleSet.abilities.length > 0 && (
        <>
          <h3>Abilities</h3>
          <ul>
            {ruleSet.abilities.map((a) => {
              const costStat = a.costStatKey ? ruleSet.stats.find((s) => s.key === a.costStatKey) : undefined;
              return (
                <li key={a.key}>
                  <strong>{a.label}</strong>
                  {a.group && <span className="muted"> ({a.group})</span>}
                  {a.costStatKey && a.costAmount ? ` — costs ${a.costAmount} ${costStat?.label ?? a.costStatKey}` : ""}: {a.description}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <h3>Special Rules</h3>
      {ruleSet.specialRules.length === 0 ? (
        <p className="muted">None noted.</p>
      ) : (
        <ul>
          {ruleSet.specialRules.map((rule, i) => (
            <li key={i}>{rule}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
