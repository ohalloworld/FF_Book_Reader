import { useEffect } from "react";
import type { Character, RuleSet } from "../engine/types";
import { CharacterSheet, type CharacterSheetActions } from "./CharacterSheet";

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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="character-drawer-backdrop" onClick={onClose}>
      <div className="character-drawer-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="character-drawer-close" onClick={onClose} aria-label="Close character sheet">
          ×
        </button>
        <CharacterSheet character={character} ruleSet={ruleSet} actions={actions} />
      </div>
    </div>
  );
}
