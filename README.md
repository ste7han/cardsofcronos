# Cards of Cronos

A card game on Cronos. Ten turns, a marketing budget that grows every one of
them, and the highest market cap at the end wins.

Being rebuilt. The first version launched in early 2025; this branch replaces
it and everything of it has been taken out — see below, including the one step
that still has to be run by hand. `CLAUDE.md` explains what changed and why, and
the plan behind it is at `~/.claude/plans/cozy-greeting-dolphin.md`.

---

## Running it

```
npm install
npm run dev          # http://localhost:3000
npm test             # vitest, ~500 tests
npm run typecheck
```

No environment variables are needed for the game. `.env.example` lists the one
that is optional (`CRONOS_RPC`, a paid RPC endpoint — the free ones are used
otherwise).

### Measuring it

The scripts are the reason the balance can be argued about rather than felt.

```
npm run match                          play one match and print the log
npm run balance                        1000 mirrored matches, first-player win rate
npm run duel                           two bot policies, sides swapped
npm run baseline -- record 3000        record a safety net
npm run baseline -- check --touched=a,b   what moved that should not have
```

`npm run baseline -- check` after a change is the one that finds regressions the
tests miss: it reports matches whose outcome moved *without* a changed card
being anywhere near them.

### The card images

```
npm run art:optimise     PNG → WebP, moves the original to art-source/
npm run art              rebuilds lib/art-manifest.ts from public/art
npm run render-cards     screenshots each card at 4x into a PNG + metadata
```

There is no art yet. Every card falls back to a chart generated from its own id,
which is why `/cards` says so instead of promising illustrations.

---

## How it is laid out

| | |
|---|---|
| `engine/` | The rules. Imports nothing — not React, not the browser. |
| `data/cards.ts` | Every card. The only source; there is no second copy. |
| `lib/` | Everything between the engine and the screen. `store.ts` is the only file that knows SQL. |
| `app/`, `components/` | Next.js App Router and the UI. |
| `db/schema.sql` | Cloudflare D1. |
| `test/` | 25 suites, including one test per card. |
| `scripts/` | Measurement, art, and end-to-end drivers. |
| `contracts/` | The first collection's contract, as deployed. |
| `docs/` | What was measured, and what is known about the first collection. |
| `legacy/` | Artwork from the first version. Built by nothing, served by nothing. |

Deployed to Cloudflare Workers with OpenNext (`npm run deploy`). It does not
deploy yet: `wrangler.jsonc` still needs a domain and a D1 database id.

---

## The first version is switched off

Everything of it has been removed from this branch: the Next app, the Python
engine, the Firebase functions and every piece of Firebase configuration. The
weekly `$CROCARD` airdrop is stopped.

**Deleting the source did not stop the deployed function.** `claimWeeklyTokens`
keeps running on Firebase until it is deleted there:

```
firebase functions:delete claimWeeklyTokens --project my-project-1472564361903
```

That has to be run by somebody with access to the project, and it is the step
that actually stops the payouts. Until it is run, the function is still on a
schedule with a funded wallet behind it.

What was kept out of it:

- `docs/first-version/` — the balance audit, condition rates and threshold
  distributions. Twenty-five thousand simulated matches, and the reason two of
  every faction's ten cards were dropped rather than picked.
- `data/legacy-cards.json` — the 235 cards of the first version, which are what
  the existing 1894 NFTs depict.
- `data/legacy-token-mapping.json`, `contracts/`, `docs/the-first-collection.md`
  — everything the free mints need.
- `legacy/public/` — the first version's artwork.

The rest is on the `fix/battle-system` branch and in the history. The Firestore
collections (`matches`, `lobbies`, `requests`, `stats/burnStats`) still exist in
the Firebase project; nothing here reads them, and whether they are exported or
dropped is a decision about that project rather than about this repository.

Two leftovers that are harmless and were left alone: `.env.local`, which still
holds the old Firebase and EmailJS keys and which nothing reads any more, and
`.idx/`, a Firebase Studio dev environment.

---

## What is not finished

- No art. Every card falls back to a generated chart; see The card images above.
- No contract for the new line, and no free mints for existing holders.
  `docs/the-first-collection.md` has everything the snapshot needs.
- No addresses. The admin list and all four revenue wallets are deliberately
  empty rather than guessed — see `lib/admin.ts` and `lib/revenue.ts`, and the
  tests that fail the moment somebody fills one in.
- No domain, no X account, no Telegram. `lib/links.ts` says what that blocks.
