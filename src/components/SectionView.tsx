import type { Section } from "../engine/types";
import type { LuckOutcome } from "../engine/useGameSession";

export function SectionView({ section, luckOutcome }: { section: Section; luckOutcome: LuckOutcome | null }) {
  return (
    <div className="section-view">
      <div className="section-number">{section.id}</div>
      {section.text.trim() ? (
        <p className="section-text">{section.text}</p>
      ) : (
        <p className="section-text muted">
          No text saved for section {section.id} yet — read it from your book, then use the box below to keep
          going.
        </p>
      )}

      {luckOutcome?.context === "general" && (
        <p className={"luck-banner" + (luckOutcome.success ? " success" : " failure")}>
          You rolled {luckOutcome.roll} against your Luck — {luckOutcome.success ? "you were lucky!" : "your luck ran out."}
        </p>
      )}

      {section.ending === "victory" && <p className="ending victory">Victory! Your adventure ends here.</p>}
      {section.ending === "death" && <p className="ending death">Your adventure ends here.</p>}
    </div>
  );
}
