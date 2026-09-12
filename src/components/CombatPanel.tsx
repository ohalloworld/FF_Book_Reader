import type { CombatState, LuckOutcomeContext } from "../engine/useGameSession";

interface CombatPanelProps {
  combat: CombatState;
  onFight: (monsterId: string) => void;
  onFlee: () => void;
  onUseLuck: (context: LuckOutcomeContext) => void;
}

export function CombatPanel({ combat, onFight, onFlee, onUseLuck }: CombatPanelProps) {
  const { lastRound } = combat;
  const luckContext: LuckOutcomeContext | null =
    lastRound?.outcome === "player" ? "combat-damage" : lastRound?.outcome === "monster" ? "combat-heal" : null;

  return (
    <div className="combat-panel">
      <h3>Combat</h3>
      {combat.monsters.map((monster) => {
        const defeated = monster.currentStamina <= 0;
        const pct = Math.max(0, Math.round((monster.currentStamina / monster.stamina) * 100));
        return (
          <div key={monster.id} className={"monster-row" + (defeated ? " defeated" : "")}>
            <div className="stat-label">
              <span>
                {monster.name} (SKILL {monster.skill})
              </span>
              <span className="stat-value">
                {defeated ? "Defeated" : `${monster.currentStamina} / ${monster.stamina}`}
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
        </p>
      )}

      <div className="combat-actions">
        {luckContext && (
          <button
            type="button"
            className="choice-button secondary"
            disabled={combat.luckUsedThisRound}
            onClick={() => onUseLuck(luckContext)}
          >
            Test your Luck
          </button>
        )}
        {combat.fleeGoTo && (
          <button type="button" className="choice-button secondary" onClick={onFlee}>
            Flee
          </button>
        )}
      </div>
    </div>
  );
}
