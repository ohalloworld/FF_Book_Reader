import { useCallback, useState } from "react";
import { resolveCombatRound, type CombatRoundResult } from "./combat";
import { cloneCharacter, generateCharacter, isAlive } from "./rules";
import type { Character, Monster, RuleSet } from "./types";

function sampleMonster(ruleSet: RuleSet): Monster {
  return {
    id: "training-dummy",
    name: "Training Dummy",
    stats: { [ruleSet.combat.attackStat]: 6, [ruleSet.combat.damageStat]: 8 },
  };
}

/** A minimal standalone sandbox (no story graph) for trying out a parsed
 * RuleSet: roll a character, then attack a sample monster a few times to
 * see the combat math and character sheet render correctly. */
export function useRuleSetSandbox(ruleSet: RuleSet) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [monster, setMonster] = useState<Monster>(() => sampleMonster(ruleSet));
  const [monsterMax, setMonsterMax] = useState(() => sampleMonster(ruleSet).stats[ruleSet.combat.damageStat] ?? 0);
  const [log, setLog] = useState<{ result: CombatRoundResult; text: string }[]>([]);

  const rollCharacter = useCallback(() => {
    const fresh = sampleMonster(ruleSet);
    setCharacter(generateCharacter(ruleSet, "Test Adventurer"));
    setMonster(fresh);
    setMonsterMax(fresh.stats[ruleSet.combat.damageStat] ?? 0);
    setLog([]);
  }, [ruleSet]);

  const attack = useCallback(() => {
    if (!character) return;
    if ((monster.stats[ruleSet.combat.damageStat] ?? 0) <= 0) return;

    const result = resolveCombatRound(character, monster, ruleSet.combat);
    const updatedChar = cloneCharacter(character);
    const block = updatedChar.pools[ruleSet.combat.damageStat];
    if (block) {
      updatedChar.pools = {
        ...updatedChar.pools,
        [ruleSet.combat.damageStat]: { ...block, current: Math.max(0, block.current - result.damageTaken) },
      };
    }
    const updatedMonster: Monster = {
      ...monster,
      stats: {
        ...monster.stats,
        [ruleSet.combat.damageStat]: Math.max(0, (monster.stats[ruleSet.combat.damageStat] ?? 0) - result.damageDealt),
      },
    };

    setCharacter(updatedChar);
    setMonster(updatedMonster);
    setLog((l) => [
      {
        result,
        text:
          result.outcome === "player"
            ? `You rolled ${result.playerAttackStrength} vs ${result.monsterAttackStrength} — you land a blow.`
            : result.outcome === "monster"
              ? `You rolled ${result.playerAttackStrength} vs ${result.monsterAttackStrength} — you're hit.`
              : `You rolled ${result.playerAttackStrength} vs ${result.monsterAttackStrength} — no damage either way.`,
      },
      ...l,
    ]);
  }, [character, monster, ruleSet]);

  return {
    character,
    monster,
    monsterMax,
    log,
    rollCharacter,
    attack,
    isAlive: character ? isAlive(character, ruleSet) : true,
    monsterDefeated: (monster.stats[ruleSet.combat.damageStat] ?? 0) <= 0,
  };
}
