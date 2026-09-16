import type { RuleSet } from "../engine/types";
import { Drawer } from "./Drawer";
import { RuleSetSummary } from "./RuleSetSummary";

/** A quick rules reference, opened from the StatBar during play — the same
 * stat-generation/test/combat/special-rules summary shown when importing
 * or previewing a rule set, so a mid-read "wait, how does combat work
 * again?" doesn't mean leaving the story. */
export function RulesDrawer({ open, onClose, ruleSet }: { open: boolean; onClose: () => void; ruleSet: RuleSet }) {
  return (
    <Drawer open={open} onClose={onClose} closeLabel="Close rules reference">
      <h2>Rules — {ruleSet.bookTitle}</h2>
      <RuleSetSummary ruleSet={ruleSet} />
    </Drawer>
  );
}
