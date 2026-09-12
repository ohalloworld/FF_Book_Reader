# FF Book Reader

An interactive gamebook reading/playing tool in the style of Fighting
Fantasy: numbered sections with choices, character stats (SKILL /
STAMINA / LUCK), dice-based combat, inventory, and save/resume.

This is an **engine**, not a transcription of any published book — the
story graph format lets you plug in your own (or your own original)
gamebook content. `src/data/testBook.ts` is a small original demo book
used to exercise every engine feature.

## Architecture

- `src/engine/types.ts` — the gamebook data model: a `Gamebook` is a
  graph of `Section`s, each with text, choices (optionally gated by
  conditions), entry effects, an optional dice `Test`, and an optional
  combat `Encounter`.
- `src/engine/dice.ts` / `combat.ts` / `rules.ts` — dice rolling,
  standard FF combat resolution (2d6 + SKILL Attack Strength),
  Luck/Skill tests, and condition/effect evaluation.
- `src/engine/useGameSession.ts` — the state machine tying it together:
  character creation, navigating sections, resolving tests and combat
  rounds, fleeing, and persisting progress.
- `src/engine/storage.ts` — save/resume via `localStorage`.
- `src/components/` — the reader UI (character sheet, section view,
  choice list, combat panel, title/character-creation screen).

## Adding a new book

Write a `Gamebook` object (see `src/data/testBook.ts` for a worked
example covering choices, item gating, a Luck test, combat, fleeing,
and both endings) and point `src/App.tsx` at it.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build     # typecheck + production build
npm run lint      # oxlint
```
