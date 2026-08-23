# Cards of Cronos

A card game on Cronos. You win by reaching the highest market cap.

The language of code, comments and documentation is English. Commits in this
repository are written in Dutch, which is what its history has always done.

---

## Important: this is a rebuild, not the old game

Cards of Cronos launched in early 2025 and never got traction. What it had was
not really a game: you handed in a deck of five projects, five supports and one
founder, and ~10,300 lines of Python computed the whole match in one pass
through six fixed phases. The browser then replayed the transcript. You never
made a move.

Most of that version has been removed from this branch. What is left, and why:

- **`functions/` and `game-engine/`** are still deployed and still running —
  a weekly token airdrop and the old arena's engine. They stay until somebody
  decides where the airdrop lives. `README.md` states the decision needed.
- **`legacy/`** holds the first version's artwork and its Firebase admin
  scripts. Kept because they are somebody's work, not because anything uses
  them.

All three are excluded in `tsconfig.json` and built by nothing. **Do not add
features to them.** Everything else from the old app is on the
`fix/battle-system` branch and in the history.

The rebuild takes its foundation from the maker's other project, TCG (Trenches
Card Game), at `/Users/stephandanser/Desktop/TCG`. Same genre, built on the
lessons this project paid for. The engine, the card schema, the render pipeline
and the tests came from there. That is the maker's own code and copying it is
the plan, not a shortcut.

What comes over from TCG and what does not:

- **The mechanics come over whole.** Ten turns, a marketing budget that ramps,
  market cap as the score, an interactive turn where you choose moves.
- **The chain-neutral cards come over.** Of TCG's 725 cards, 69 are not tied to
  Solana: 34 tactics, 20 events, 15 unnamed influencer archetypes. Those are the
  interaction layer of the game.
- **Solana projects and Solana people do not come over.** Not the 610 project
  cards, not the 20 named influencers, not the 26 named tools. Cards of Cronos
  has its own projects: the twelve factions this game already had.
- **The colours do not come over, and only the colours.** The palette stays
  Cards of Cronos — `#050314` ground, `#9D4EDD` primary, `#FFD700` for headings
  — over TCG's layout and TCG's typeface. The brief was colours; Cinzel over a
  mono grid would pull the screen back to the old site. See app/globals.css.

---

## The rules, as they stand

Authoritative source is `engine/types.ts` (`RULES`, `MARKETING_COST`) and
`engine/match.ts`. `DESIGN.md` is TCG's design document, carried over as the
spec of the mechanics — it is still written in Trenches' terms and parts of it
have drifted from the code. **When the document and the code disagree, the code
is right.**

- Ten turns, alternating. Highest market cap at the end wins.
- Turn N gets N × $40K of marketing budget. It does not carry over, and whatever
  is left at the end of the turn comes off your market cap at 100%.
- Playing a card costs by rarity: 20/40/80/200/280K. Taking profit and
  discarding cost a flat $50K.
- A project pays its launch MC once, then pumps every turn. Damage to holders
  makes a position pay proportionally less.
- Market cap is what you are holding. Take profit to realise it; a rug takes
  back what a position has earned.

---

## Lessons from the first version

These were paid for dearly and apply here in full.

**Unknown names fail silently.** In the old engine a card was a combination of
`condition_type`, `target_type` and `action_type`. A name the engine did not know
fell through to "do nothing" while the log cheerfully reported "triggered". 110
of 235 cards demonstrably did nothing. The new engine closes this with
`assertNever` at the end of every switch, `validateSet` at module load, and
`cardById` throwing on an unknown id. **Keep all three.**

**One name, two meanings is the same trap.** Two cards sharing an action name
with different intentions: the implementation knows one, the other card does
nothing, and statically that is invisible.

**Measure effect on the outcome, not on log lines.** `test/set.test.ts` plays
each card against not playing it and compares the resulting position. A card
that only writes a log line has done nothing.

**Build the deck the card text describes.** A card asking for exactly three of
something gets tested with exactly three, or you cannot tell broken from
demanding.

**Check your own test setup.** If an outcome cannot possibly be right, suspect
the measurement first.

**A safety net across many matches.** `npm run baseline -- record` before a
change, `-- check --touched=<ids>` after. Anything that moves without a touched
card near it is a regression.

**Card text and mechanics have to match** — and printed art does not change
along with a rebalance. Eight card images in the old set still show numbers that
the data no longer has.

**One file, one truth.** The old card data lived in two files, one for the engine
and one for the frontend, and the frontend failed to ship eight times. Cards live
in `data/cards.ts` and nowhere else.

**Never a key in the source.** An RPC key ended up in this project's history and
there is no getting it out again.

**Large art stays out of git.** `public/NFTCARDS/` is 734 MB. It is gitignored
now; it was one `git add .` away from being permanent.

---

## Working agreements

- Rules first, then code.
- If something can fail silently, make it loud.
- Do not build on `functions/`, `game-engine/` or `legacy/`. `src/` is gone.
- The plan for the rebuild is at `~/.claude/plans/cozy-greeting-dolphin.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
