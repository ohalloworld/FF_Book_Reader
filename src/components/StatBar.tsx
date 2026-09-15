import type { Character, RuleSet } from "../engine/types";

/** A slim, always-visible summary of the character's pool stats — the
 * reading view's replacement for a full always-on sidebar sheet. Tapping
 * it opens the full CharacterSheet (inventory, counters, edit actions) in
 * a drawer, so the story stays the visual focus while combat-relevant
 * numbers (STAMINA especially) stay in view without scrolling back up. */
export function StatBar({
  character,
  ruleSet,
  onOpenSheet,
}: {
  character: Character;
  ruleSet: RuleSet;
  onOpenSheet: () => void;
}) {
  const pools = ruleSet.stats.filter((s) => s.kind === "pool");

  return (
    <div className="stat-bar-strip">
      <div className="stat-bar-strip-stats">
        {pools.map((stat) => {
          const value = character.pools[stat.key];
          if (!value) return null;
          const pct = value.initial === 0 ? 0 : (value.current / value.initial) * 100;
          const low = pct <= 25;
          return (
            <span key={stat.key} className={"stat-chip" + (low ? " low" : "")}>
              <span className="stat-chip-label">{stat.label}</span>
              <span className="stat-chip-value">
                {value.current}/{value.initial}
              </span>
            </span>
          );
        })}
      </div>
      <button type="button" className="stat-bar-strip-toggle" onClick={onOpenSheet}>
        {character.name} ▸
      </button>
    </div>
  );
}
