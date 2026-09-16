import type { Character, RuleSet } from "../engine/types";
import { CharacterSheet, type CharacterSheetActions } from "./CharacterSheet";
import { Drawer } from "./Drawer";

/** The full character sheet (inventory, counters, edit actions), moved
 * out of the always-visible layout into an on-demand drawer — opened from
 * the StatBar — so the story stays the reading view's visual focus. */
export function CharacterDrawer({
  open,
  onClose,
  character,
  ruleSet,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  character: Character;
  ruleSet: RuleSet;
  actions: CharacterSheetActions;
}) {
  return (
    <Drawer open={open} onClose={onClose} closeLabel="Close character sheet">
      <CharacterSheet character={character} ruleSet={ruleSet} actions={actions} />
    </Drawer>
  );
}
