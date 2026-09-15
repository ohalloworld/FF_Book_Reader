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

Since a real book's numbered sections aren't digitized here, add it to
your **Library** (a title paired with a rule set) instead. Attach its PDF
and the book **fills itself in as you read**: land on a paragraph that
hasn't been transcribed, say which PDF page it's on, and Claude reads
every paragraph on that page — text and outgoing choices — straight from
the picture, so re-visiting it later (or clicking one of its choices)
shows the real thing, choice buttons included, the same as the demo book.
No PDF attached, or don't want to spend the API calls? The reader falls
back to **companion mode**: every un-transcribed section shows a blank
placeholder, a "Go to paragraph" box jumps to any section number, a
**Previous** button does a true undo of character state (not just the
displayed text — it unwinds a dice test or mid-fight damage too), and
**Companion Tools** let you manually roll any named test, adjust any stat,
add/remove inventory, and start an ad-hoc fight against a monster you type
in — all the same dice/combat math as an authored encounter, just
triggered by hand. Both modes work together: a paragraph either has real
transcribed text, or it's a blank companion placeholder, and you can mix
the two freely as you go (or hand-type/correct a paragraph yourself via
**Edit**, no PDF required).

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
- `src/engine/useGameSession.ts` — the reader's state machine: navigating
  sections, resolving tests/combat, save/resume.
  `startNewGameWithCharacter` takes an already-rolled `Character` (see
  `CharacterRoll.tsx` below) rather than rolling one itself, so the reveal
  screen and the actual game state always agree on what was rolled.
- `src/engine/parseRulesApi.ts` — client for the local rules-parsing
  endpoint.
- `server/rulesApiPlugin.ts` — a Vite dev-server middleware plugin exposing
  `POST /api/parse-rules`. It calls the Anthropic API (`claude-opus-5` by
  default — override with `ANTHROPIC_MODEL` in `.env`) server-side with a
  Zod schema (`server/ruleSetSchema.ts`) via structured outputs, so parsing
  is reliable JSON, not free text — and your API key stays in this Node
  process and is never sent to the browser. Only active under `npm run dev`.
- `server/rulesApiPlugin.ts` also exposes `POST /api/extract-pdf-text`
  (per-page text extraction via `pdf-parse`) and `POST /api/render-pdf-pages`
  (renders a page range as PNG images, for scanned PDFs with no text
  layer — `pdf-parse` wraps `pdfjs-dist`, which can rasterize pages
  directly, no separate rendering library needed). Both run entirely
  in-memory on your machine; the PDF itself is never written to disk or
  sent anywhere. `/api/parse-rules` accepts either `rulesText` or
  `pageImages` and builds the matching (text-only or multimodal) Claude
  request.
- `src/components/RulesImporter.tsx` + `PdfImportPanel.tsx` +
  `RuleSetSandbox.tsx` — upload a book's PDF (or paste text directly), pick
  the page range covering its rules section, parse it, review the
  extracted stats/tests/combat rules, save it (to `localStorage`), and try
  it out immediately against a sample monster without needing full story
  content.
- `src/engine/library.ts` — resolves a `LibraryBookEntry` (title + which
  RuleSet it uses) into a playable `Gamebook`. `deriveBookSections` builds
  its `sections` by flattening every transcribed PDF page (plus any manual
  corrections) into `Section`s; anything not yet transcribed still falls
  through to `useGameSession`'s blank-section fallback, so companion mode
  and transcribed content coexist paragraph by paragraph with no
  special-casing.
- `server/bookTranscriptionPlugin.ts` exposes `POST`/`DELETE
  /api/library/:id/pdf` (stores/removes an uploaded PDF on disk, in
  `.local-books/`, gitignored — never committed, never re-uploaded on
  later requests), `GET /api/library/:id/pdf-status` (page count), and
  `POST /api/library/:id/transcribe-page` (renders one page — keeping that
  same image for reuse — and sends it to Claude with a Zod schema —
  `server/pageTranscriptionSchema.ts` — asking for every paragraph's text
  and outgoing choices, structured the same way the rules importer does).
  `server/httpUtils.ts` holds the request-body and path-safety helpers
  both server plugins share, plus `rejectCrossOrigin`, called first by
  every endpoint: since `server.host: true` makes these reachable from
  anywhere on your LAN with no login of their own, it rejects any request
  whose `Origin` doesn't match the `Host` it's talking to — same-origin
  requests (this app, curl, a phone loading this same address) go through
  as before, but another website's page can no longer silently call them
  and spend your API credits or touch your local files.
- `src/engine/transcriptionApi.ts` — client for those endpoints.
  `src/engine/pageImageStore.ts` — an IndexedDB store just for the
  rendered page images transcription returns; kept separate from the
  (localStorage) text cache because images are far larger — an
  illustrated book's images alone can be tens of MB, well past what
  localStorage can hold, while a whole book's *text* is only a few
  hundred KB and stays in `storage.ts` alongside everything else.
  `src/components/PdfPageTools.tsx` — the "which page is this" prompt
  shown on a blank section, and a separate **Browse PDF Pages** panel for
  flipping through pages (transcribing new ones, showing cached ones
  instantly, page image included) without moving your actual position in
  the story.
- `src/components/Library.tsx` — a card grid of the built-in demo plus your
  saved library books (`localStorage`, alongside saved rule sets); each
  card's **Manage** panel expands to Attach/Replace PDF, Delete, and the
  bulk-transcribe control, keeping the card itself to just a cover and a
  Play button. A form below adds a new book (title, author, starting
  paragraph, rule set, optional PDF).
  `src/components/BulkTranscribe.tsx` adds a per-book **Pre-transcribe
  entire book** control (shown once a PDF's attached) that works through
  every untranscribed page up front — with a rough cost estimate, live
  progress, cancel, and per-page retry — so a book can be read later with
  no server reachable at all. Its **Show page map** toggle renders a small
  grid, one cell per PDF page, filled in once that page is transcribed —
  a way to see at a glance how much of a book is actually readable before
  you start, or after a bulk run finishes.
  `src/components/PdfPageTools.tsx`'s page browser also has a
  **Retranscribe this page** action, distinct from manual Edit — for when
  a scan was blurry and the OCR read is just wrong, without hand-retyping
  the whole page; it re-sends that one page to Claude and overwrites its
  cached result.
- `src/components/CompanionTools.tsx` — a free-form dice roller (any count/
  sides/modifier, e.g. for a "roll one die" instruction that isn't a named
  test), manual test rolls, and the ad-hoc combat form, shown during play;
  `CharacterSheet.tsx` takes an optional `actions` prop for the inline
  stat/inventory edit controls (omitted in the rules-sandbox, where the
  sheet stays read-only).
- **Reading-first layout:** the full `CharacterSheet` isn't part of the
  normal play view anymore — `StatBar.tsx` shows a slim sticky strip of
  just the pool stats (SKILL/STAMINA/LUCK-equivalents) above the story, and
  tapping it opens the full sheet (inventory, counters, edit actions) in
  `CharacterDrawer.tsx`, a slide-in panel (from the right on desktop, up
  from the bottom on mobile) that closes on Escape or a backdrop click. The
  story paragraph stays the visual focus instead of competing with an
  always-on sidebar.
- **Rolling a character is a visible step**, matching the books' own
  ritual of rolling your Adventure Sheet before the story starts:
  `CharacterRoll.tsx` shows each stat as it's rolled (with its dice
  formula, e.g. `1D6+6`) and lets you **Reroll** before committing, instead
  of generating silently the instant you click Begin. `TitleScreen.tsx`
  also confirms before **Begin a new adventure** wipes an existing save
  for that book, rather than deleting it silently.
- `src/engine/backup.ts` + `src/components/BackupPanel.tsx` — since
  everything (saves, rule sets, library entries, transcribed pages and
  images) lives only in this browser's own storage, **Export backup** on
  the Library screen bundles every `ff-reader:`-prefixed `localStorage`
  key plus every cached page image into one downloadable JSON file, and
  **Import backup** restores it — a full replace, not a merge, after a
  confirmation showing when the backup was made. Worth doing before
  clearing site data, reinstalling the PWA, or switching devices, since a
  transcribed page cost a real Claude API call to produce.
- Moving between sections plays a small page-turn animation
  (`@keyframes page-turn-in` in `index.css`, on `.section-view` — it
  remounts on every section change via its `key`), skipped automatically
  under `prefers-reduced-motion`.
- `src/components/` (the rest) — the reader UI: character sheet, section
  view, choice list, combat panel, title/character-creation screen.
- `vite.config.ts` — `server.host: true` (LAN access for phones) and
  `vite-plugin-pwa` (installable manifest + offline app-shell caching,
  icons in `public/`).

## Importing a book's rules

Open the "Import Book Rules" tab. Either:

- **Upload a PDF** of a book you own. Rules and character-sheet
  instructions are typically the first 10–15 pages, before the numbered
  story sections start — pick a page range and check the preview shows
  rules text (not story text).
  - If the PDF has a real text layer, click **Use this text**.
  - If it's a **scanned PDF** (a photo/scan with no selectable text — the
    app will warn you when extraction comes back empty), click **Scanned
    PDF? Parse from page images** instead. This renders the selected
    pages as images (via `POST /api/render-pdf-pages`, using `pdf-parse`'s
    screenshot support — still entirely on your machine) and sends those
    to Claude directly; Claude reads the rules text out of the pictures
    itself, no separate OCR step needed.
- **Paste the rules text** directly into the box.

Then click **Parse Rules**. Claude extracts a structured `RuleSet` — review
it, give it a name (defaults to whatever title Claude found, but you can
rename it, including any rule set you've already saved), and use **Try it
out** to roll a test character and fight a sample monster under those exact
rules. Saved rule sets persist in your browser's `localStorage`, named for
easy reuse in the Library's rule-set picker. The PDF never leaves your
machine — extraction and page rendering happen in the local dev server, and
only the rules text or page images you approve get sent to Claude for
parsing.

Note: this only extracts the *rules*, not a book's story text (which is
copyrighted) — pairing an imported rule set with that book's actual section
content is a separate step of writing your own `Gamebook` (see below). Keep
any transcribed story content as local, `.gitignore`d files rather than
committing it — even for personal use, that's real copyrighted text.

## Playing a real book

Open the **Library** tab and use **Add a Book**: give it a title, optional
author, which paragraph it starts at (usually `1`), which rule set to use
(the standard rules, or one you've imported), and — optionally, right
there or later from the book's row — its PDF. Click **Play** and it
behaves exactly like the demo book's engine: character creation, save/
resume, combat and Luck-test math.

**With a PDF attached:** landing on a section with no text yet shows a
prompt asking which PDF page it's on. Fighting Fantasy paragraph numbers
are deliberately not in page order (so you can't peek ahead by flipping
pages), so this can't be guessed — but you already have the page open in
your own book, so it's a quick answer. Transcribing a page fills in every
paragraph found there at once, so a handful of these questions cover a lot
of the book. Once transcribed, a paragraph shows its real text and real
choice buttons — click one like any authored section, no more typing
numbers. If the page had any artwork, **Show page artwork** displays the
actual scanned page (art and text as printed — the same image already
rendered for transcription, at no extra cost) underneath the transcribed
text. Got a misread? **Edit this paragraph** fixes it by hand. Want to
skim ahead or double-check something without moving your character? Open
**Browse PDF Pages** and flip Prev/Next, or type a page number into **Go to
page** to jump straight there — it shows each page's image too.

Every transcribed page (text and image) is cached the moment it's read,
so rereading a book — or replaying it — never re-sends anything to Claude
for a page it's already seen. Deleting a book from the Library cleans up
everything: its local PDF, its cached text, and its cached images.

### Reading without the server

Transcribing a *new* page always needs the dev server (and your computer)
reachable — that's the one Claude call in the whole app. A page you've
*already* transcribed doesn't: its text and image live in your phone's own
`localStorage`/IndexedDB, and the PWA's service worker caches the app
itself, so anything already read keeps working with your computer off or
out of WiFi range. Only new pages need the server.

So before taking a book somewhere without the server (a trip, a
dead-zone), open its row in the **Library** and use **Pre-transcribe
entire book** (shown once a PDF's attached) — it works through every page
up front, shows a running cost estimate first and live progress as it
goes, can be cancelled and resumed, and retries individually if a page
fails. Every page is still only ever sent to Claude once: running it again
later just tops up whatever's new.

For the built-in demo (and any Library book you write by hand instead of
transcribing), everything's already baked into the app bundle the service
worker caches, so those play fully offline with no pre-step at all.

**Without a PDF (or for anything not transcribed yet):** the reader falls
back to companion mode — follow the book's printed choice ("turn to 245")
via the **Go to paragraph** box, or use **Companion Tools** to roll a
test, adjust a stat, manage inventory, or fight a monster it describes.

Transcribed text and images are real copyrighted book content, stored
only in your browser's `localStorage` (text) and IndexedDB (page images)
and, for the PDF itself, `.local-books/` on your disk — none of it ever
touches this git repo (both are gitignored) or anywhere outside your
machine.

## Authoring a fully digitized book

For an original story (or one you're writing yourself) with real choices,
effects, and combat encounters baked in — like the demo — write a
`Gamebook` object by hand: `{ id, title, author, startSection, ruleSet,
sections }`, pairing your story graph with either the standard ruleset or
one you've imported. See `src/data/testBook.ts` for a worked example
covering choices, item gating, a dice test, combat, fleeing, and both
endings. There's no UI for this yet — it's a `src/data/*.ts` file you add
and reference directly, the same way `testBook.ts` is.

## Development

```bash
npm run dev      # start the dev server (frontend + local rules API)
npm run build    # typecheck + production build
npm run lint     # oxlint
```
