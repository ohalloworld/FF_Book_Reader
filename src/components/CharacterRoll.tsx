import type { Character, RuleSet } from "../engine/types";

/** The "roll your Adventure Sheet" moment the books open with, made
 * visible instead of happening silently the instant you click Begin:
 * shows exactly what was rolled for each stat (real dice, via
 * engine/rules.generateCharacter — see GameShell), and lets you reroll
 * before committing, same as rolling up a fresh character on paper. */
export function CharacterRoll({
  character,
  ruleSet,
  onReroll,
  onBegin,
  onBack,
}: {
  character: Character;
  ruleSet: RuleSet;
  onReroll: () => void;
  onBegin: () => void;
  onBack: () => void;
}) {
  const pools = ruleSet.stats.filter((s) => s.kind === "pool");
  const counters = ruleSet.stats.filter((s) => s.kind === "counter");

  return (
    <div className="character-roll">
      <button type="button" className="link-button" onClick={onBack}>
        ← Change name
      </button>
      <h1>Roll your Adventure Sheet</h1>
      <p className="muted">Here's what {character.name} rolled. Keep it, or roll again.</p>

      <div className="character-roll-stats">
        {pools.map((stat) => {
          const value = character.pools[stat.key];
          if (!value) return null;
          return (
            <div className="character-roll-stat" key={stat.key}>
              <span className="character-roll-stat-label">{stat.label}</span>
              <span className="character-roll-stat-value">{value.current}</span>
              <span className="character-roll-stat-formula">{stat.generation}</span>
            </div>
          );
        })}
      </div>

      {counters.length > 0 && (
        <div className="character-roll-counters">
          {counters.map((stat) => (
            <span key={stat.key} className="muted">
              {stat.label}: {character.counters[stat.key] ?? 0}
            </span>
          ))}
        </div>
      )}

      {character.inventory.length > 0 && (
        <p className="muted">Starting equipment: {character.inventory.join(", ")}</p>
      )}

      <div className="title-actions">
        <button type="button" className="choice-button" onClick={onBegin}>
          Begin the adventure
        </button>
        <button type="button" className="choice-button secondary" onClick={onReroll}>
          Reroll
        </button>
      </div>
    </div>
  );
}
