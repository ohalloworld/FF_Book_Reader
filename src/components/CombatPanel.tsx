import type { CombatModifiers } from "../engine/combat";
import type { RuleSet } from "../engine/types";
import type { CombatState, LuckOutcomeContext } from "../engine/useGameSession";

interface CombatPanelProps {
  combat: CombatState;
  ruleSet: RuleSet;
  onFight: (monsterId: string) => void;
  onFlee: () => void;
  onEndCombat: () => void;
  onUseLuck: (context: LuckOutcomeContext) => void;
  onAdjustModifier: (side: keyof CombatModifiers, delta: number) => void;
}

function ModifierStepper({ label, value, onAdjust }: { label: string; value: number; onAdjust: (delta: number) => void }) {
  return (
    <div className="combat-modifier">
      <span>{label}</span>
      <button type="button" className="stat-adjust-button" onClick={() => onAdjust(-1)} aria-label={`Decrease ${label}`}>
        −
      </button>
      <span className="combat-modifier-value">{value > 0 ? `+${value}` : value}</span>
      <button type="button" className="stat-adjust-button" onClick={() => onAdjust(1)} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  );
}

export function CombatPanel({ combat, ruleSet, onFight, onFlee, onEndCombat, onUseLuck, onAdjustModifier }: CombatPanelProps) {
  const { lastRound } = combat;
  const luckContext: LuckOutcomeContext | null =
    lastRound?.outcome === "player" ? "combat-damage" : lastRound?.outcome === "monster" ? "combat-heal" : null;

  const attackStat = ruleSet.stats.find((s) => s.key === ruleSet.combat.attackStat);
  const attackLabel = attackStat?.label ?? ruleSet.combat.attackStat;

  return (
    <div className="combat-panel">
      <h3>Combat</h3>

      <div className="combat-modifiers">
        <ModifierStepper label="Your rolls" value={combat.modifiers.player} onAdjust={(d) => onAdjustModifier("player", d)} />
        <ModifierStepper label="Enemy rolls" value={combat.modifiers.monster} onAdjust={(d) => onAdjustModifier("monster", d)} />
      </div>

      {combat.monsters.map((monster) => {
        const defeated = monster.currentDamageStat <= 0;
        const maxDamageStat = monster.stats[ruleSet.combat.damageStat] || 1;
        const pct = Math.max(0, Math.round((monster.currentDamageStat / maxDamageStat) * 100));
        return (
          <div key={monster.id} className={"monster-row" + (defeated ? " defeated" : "")}>
            <div className="stat-label">
              <span>
                {monster.name} ({attackLabel} {monster.stats[ruleSet.combat.attackStat] ?? 0})
              </span>
              <span className="stat-value">
                {defeated ? "Defeated" : `${monster.currentDamageStat} / ${maxDamageStat}`}
              </span>
            </div>
            <div className="stat-bar">
              <div className="stat-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            {!defeated && (
              <button type="button" className="choice-button" onClick={() => onFight(monster.id)}>
                Attack {monster.name}
              </button>
            )}
          </div>
        );
      })}

      {lastRound && (
        <p className="combat-log">
          You rolled {lastRound.playerAttackStrength} (Attack Strength) vs {lastRound.monsterAttackStrength}.{" "}
          {lastRound.outcome === "player" && "You wound your foe!"}
          {lastRound.outcome === "monster" && "You are wounded!"}
          {lastRound.outcome === "draw" && "Neither side lands a blow."}
          {lastRound.additionalAttackers && lastRound.additionalAttackers.length > 0 && (
            <> Also hit by {lastRound.additionalAttackers.join(", ")}!</>
          )}
        </p>
      )}

      <div className="combat-actions">
        {luckContext && ruleSet.combat.luckTestKey && (
          <button
            type="button"
            className="choice-button secondary"
            disabled={combat.luckUsedThisRound}
            onClick={() => onUseLuck(luckContext)}
          >
            Test your Luck
          </button>
        )}
        {combat.manual ? (
          <button type="button" className="choice-button secondary" onClick={onEndCombat}>
            End Combat
          </button>
        ) : (
          combat.fleeGoTo && (
            <button type="button" className="choice-button secondary" onClick={onFlee}>
              Flee
            </button>
          )
        )}
      </div>
    </div>
  );
}
