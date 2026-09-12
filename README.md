# FF Book Reader

An interactive gamebook reading/playing tool in the style of Fighting
Fantasy: numbered sections with choices, a dynamic character sheet, dice-based
combat, inventory, save/resume, and — since every book varied its rules
somewhat — a way to **import a specific book's rules and have them parsed
into a structured rule set** instead of relying on one hardcoded ruleset.

This is an **engine**, not a transcription of any published book — the
story graph format lets you plug in your own (or your own original)
gamebook content. `src/data/testBook.ts` is a small original demo book
used to exercise every engine feature.

## Running it locally

```bash
npm install
cp .env.example .env   # then add your own ANTHROPIC_API_KEY (only needed for rules import)
npm run dev            # starts the app at http://localhost:5173
```

Everything runs on your machine — the frontend and the local rules-parsing
endpoint are one process (`npm run dev`), nothing is hosted externally.
Playing the demo book doesn't need an API key at all; the key is only used
when you use the "Import Book Rules" screen.

## Using it on your phone

It's a PWA (installable web app), so you can put it on your phone's home
screen and use it full-screen like a native app — as long as your phone is
on the **same WiFi** as the computer running `npm run dev` (nothing is
hosted anywhere else, so it only reaches devices on your local network):

1. Run `npm run dev` on your computer. It prints a `Network:` URL, e.g.
   `http://192.168.1.23:5173/` — that's your computer's LAN address.
2. On your phone (same WiFi), open that URL in the browser.
3. Add it to your home screen:
   - **iOS (Safari):** Share button → "Add to Home Screen"
   - **Android (Chrome):** ⋮ menu → "Add to Home screen" / "Install app"

It'll launch full-screen with its own icon, and the service worker caches
the app shell so it still loads even if your connection drops mid-read.
Save/resume is stored in your phone's own browser storage, independent of
the server. Your computer only needs to stay on and running `npm run dev`
for: the very first load (before the service worker has cached anything),
and the "Import Book Rules" screen (which calls Claude via your computer).

## Architecture

- `src/engine/types.ts` — the data model. A `Gamebook` is a graph of
  `Section`s (text, choices, entry effects, a dice `Test`, or a combat
  `Encounter`) paired with a `RuleSet` describing *that book's* character
  sheet: which stats exist, how they're generated, how combat resolves, and
  what named dice tests it defines. Nothing about stats is hardcoded — the
  whole engine reads the `RuleSet` at runtime.
- `src/engine/standardRuleSet.ts` — the classic FF ruleset (SKILL / STAMINA
  / LUCK, 2D6+SKILL combat) used by the demo book, and a reasonable default
  when importing an unfamiliar book.
- `src/engine/dice.ts` — parses dice formulas like `"1D6+6"` and rolls them.
- `src/engine/combat.ts` / `rules.ts` — generic combat resolution and
  condition/effect evaluation, both driven entirely by the active `RuleSet`.
- `src/engine/useGameSession.ts` — the reader's state machine: character
  creation, navigating sections, resolving tests/combat, save/resume.
- `src/engine/parseRulesApi.ts` — client for the local rules-parsing
  endpoint.
- `server/rulesApiPlugin.ts` — a Vite dev-server middleware plugin exposing
  `POST /api/parse-rules`. It calls the Anthropic API (`claude-opus-5`)
  server-side with a Zod schema (`server/ruleSetSchema.ts`) via structured
  outputs, so parsing is reliable JSON, not free text — and your API key
  stays in this Node process and is never sent to the browser. Only active
  under `npm run dev`.
- `server/rulesApiPlugin.ts` also exposes `POST /api/extract-pdf-text`,
  which reads an uploaded PDF's text per-page (via `pdf-parse`) entirely
  in-memory on your machine — the PDF itself is never written to disk or
  sent anywhere.
- `src/components/RulesImporter.tsx` + `PdfImportPanel.tsx` +
  `RuleSetSandbox.tsx` — upload a book's PDF (or paste text directly), pick
  the page range covering its rules section, parse it, review the
  extracted stats/tests/combat rules, save it (to `localStorage`), and try
  it out immediately against a sample monster without needing full story
  content.
- `src/components/` (the rest) — the reader UI: character sheet, section
  view, choice list, combat panel, title/character-creation screen.
- `vite.config.ts` — `server.host: true` (LAN access for phones) and
  `vite-plugin-pwa` (installable manifest + offline app-shell caching,
  icons in `public/`).

## Importing a book's rules

Open the "Import Book Rules" tab. Either:

- **Upload a PDF** of a book you own. Rules and character-sheet
  instructions are typically the first 10–15 pages, before the numbered
  story sections start — pick a page range, check the preview shows rules
  text (not story text), and click **Use this text**; or
- **Paste the rules text** directly into the box.

Then click **Parse Rules**. Claude extracts a structured `RuleSet` — review
it, save it, and use **Try it out** to roll a test character and fight a
sample monster under those exact rules. Saved rule sets persist in your
browser's `localStorage`. The PDF and its text never leave your machine —
extraction happens in the local dev server, and only the short rules text
you approve gets sent to Claude for parsing.

Note: this only extracts the *rules*, not a book's story text (which is
copyrighted) — pairing an imported rule set with that book's actual section
content is a separate step of writing your own `Gamebook` (see below). Keep
any transcribed story content as local, `.gitignore`d files rather than
committing it — even for personal use, that's real copyrighted text.

## Adding a new book

Write a `Gamebook` object — `{ id, title, author, startSection, ruleSet,
sections }` — pairing your story graph with either the standard ruleset or
one you've imported, and point `src/App.tsx` at it. See
`src/data/testBook.ts` for a worked example covering choices, item gating,
a dice test, combat, fleeing, and both endings.

## Development

```bash
npm run dev      # start the dev server (frontend + local rules API)
npm run build    # typecheck + production build
npm run lint     # oxlint
```
