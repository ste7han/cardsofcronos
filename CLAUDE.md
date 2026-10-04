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

That version is gone from this branch, Firebase and all. What was kept out of
it, and where:

- `docs/first-version/` — what its engine measured over 25,000 matches.
- `data/legacy-cards.json`, `data/legacy-token-mapping.json`, `contracts/` and
  `docs/the-first-collection.md` — everything the existing 1894 NFTs and the
  free mints need.
- `legacy/public/` — its artwork. Excluded in `tsconfig.json`, built by nothing.

Everything else is on the `fix/battle-system` branch and in the history.

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
`engine/match.ts`. `DESIGN.md` describes this game and what was decided along the
way; `test/design.test.ts` checks its numbers against the engine, because the
document it replaced had drifted so far that its first paragraph described a turn
structure the engine had not used for a long time. **When the document and the
code disagree, the code is right.**

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

**Large art stays out of git, and out of `public/`.** `art-source/NFTCARDS/` is
734 MB. It is gitignored; it was one `git add .` away from being permanent. It
sat in `public/` until September 2026, which is worse than it sounds: everything
under `public/` is uploaded to the site verbatim, so 800 MB of source art was
being served from cardsofcronos.com and only 16 MB of it was ever used. Source
art goes in `art-source/`. `public/` is what the site serves.

---

## Lessons from the rebuild

Same rule: paid for, so written down.

**A component declared in a render body is a new component on every render.**
`Side` sat inside `MatchBoard`, which read fine and was a remount every time:
React compares the component *type* at a position in the tree, and a fresh
function identity is a fresh type, so it threw the subtree away and built a new
one. All the state underneath went with it. A live match re-renders once a second
to tick its clock, so a magnified card closed before it could be read — which
arrives as "the game feels janky", not as a bug with a name. Declare components
at module level and hand them what they need as props. A prop that changes
identity is only a prop; a component that changes identity is a different
component.

**Some faults are invisible to both the type checker and the tests.** That one
was, and so was the match table missing `.dense`, the opt-out from the small-type
floor: `tsc` clean and 1157 tests green while both were wrong, because neither is
a claim about behaviour — one is component identity, the other is a stylesheet.
What catches those is reading the source and asserting its shape:
`test/live-board.test.ts`, and `test/watch.test.ts` before it. A blunt
instrument, and the only one that fits.

**Copy that quotes a number drifts away from the number.** The live turn clock
moved twice. Both times the engine was right and the lobby, the spectator page,
the Discord invitation and the page description went on saying two minutes — so
people were invited to a game under rules it no longer used. Anything that states
a rule in words reads it from the rule: `clockLabel` and `clockPhrase` off
`TURN_CLOCK`, the same way `DESIGN.md` is checked against the engine rather than
trusted. This is **one file, one truth** again, in prose instead of in data.

**Work that only happens when somebody looks is not scheduled.** `catchUp` ends
a turn whose window has passed, and it ran in the two routes a player opens a
match through and nowhere else. So a correspondence turn did not expire after a
day — it expired whenever somebody next opened that match, which could be days.
The notification built for exactly that case therefore missed it: a turn returns
to you either because the opponent moved or because they let the day lapse, and
only the first went through a request. `/api/cron/clocks` runs it on the alarm
instead — calling the same `catchUp`, `saveMoves`, `settle` and `notify`, because
a second implementation of a rule is two rules, and the one nobody watches is the
one that drifts.

**Repetition hides an omission.** The alarm in `worker/index.js` was three copies
of the same twelve lines, one per job, and that is how the weekly job came to be
missing for a month: adding one meant first noticing that a third block existed.
A weekly job that never fires looks like nothing for six days and like a quiet
Monday on the seventh — no week was closed, nobody was paid, and both boards went
on naming a winner all week. As a table it is one line per job and a missing one
is visible, which is also what let `test/cron.test.ts` start checking that every
job sits behind `CRON_SECRET` rather than only the ones with a cron of their own.

**An instruction with no observable outcome is a broken feature.** Telegram will
not let a bot open a conversation, so a linked account needs one press of Start
first — and pressing it tells the site nothing, because no webhook is registered.
"Press Start" was therefore an instruction answered by silence from the bot and
silence from the site, which is indistinguishable from a feature that does not
work, and was read that way. Whenever a step happens somewhere this code cannot
see, ship the way to check it: `/api/link/telegram/test` asks for the one piece
of evidence that ever arrives and turns each refusal into the next thing to do.

**One site, one hostname.** `wrangler.jsonc` claimed the apex and `www` as custom
domains and both served the site. Two origins for one site is not untidy, it is a
second site that is silently the wrong one: Telegram's login widget allows one
domain per bot, so one of the two always answered "Bot domain invalid", and a
wallet proof is a cookie — cookies are per host — so signing in on `www` and on
the apex were two sessions and landing on the other read as being signed out.
`test/hosts.test.ts` sweeps every route in the config rather than naming one, so
a third domain without a redirect fails there instead of becoming another
silently-wrong copy.

---

## Working agreements

- Rules first, then code.
- If something can fail silently, make it loud.
- Do not build on `legacy/`. Everything else of the old app is gone.
- The plan for the rebuild is at `~/.claude/plans/cozy-greeting-dolphin.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
