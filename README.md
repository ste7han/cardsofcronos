# Cards of Cronos

A card game on Cronos. Ten turns, a marketing budget that grows every one of
them, and the highest market cap at the end wins.

Being rebuilt. The first version launched in early 2025 and is still deployed;
what is in this branch replaces it. `CLAUDE.md` explains what changed and why,
and the plan behind it is at `~/.claude/plans/cozy-greeting-dolphin.md`.

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
| `legacy/` | Art and scripts from the first version. Built by nothing. |

Deployed to Cloudflare Workers with OpenNext (`npm run deploy`). It does not
deploy yet: `wrangler.jsonc` still needs a domain and a D1 database id.

---

## Two things are still live, and this is the decision they are waiting for

The first version is running. Two pieces of it are in this repo, still deployed,
and were deliberately **not** removed with the rest:

**`functions/`** — one Firebase function, `claimWeeklyTokens`. A weekly token
airdrop gated on a `$CROCARD` balance, signing with a wallet whose key is a
Firebase secret. It pays real people real tokens on a schedule. Deleting the
source would not stop it; it would only mean nobody can fix it.

**`game-engine/`** — the Python engine of the first version, deployed as two
more Firebase functions. The rebuild replaces what it does, but it is what the
live arena still calls.

Alongside them: `firebase.json`, `firebase.rules`, `firestore.indexes.json`,
`storage.rules`, `.firebaserc`, and Firestore collections holding `matches`,
`lobbies`, `requests` and `stats/burnStats`.

**What has to be decided.** Does the weekly airdrop move to a Worker, keep
running on Firebase beside the new site, or stop? And do the Firestore
collections get migrated into D1, exported, or left where they are? Until
somebody answers, all of it stays exactly where it is. `tsconfig.json` excludes
both directories, so neither affects the build.

`game-engine/AUDIT.md`, `VOORWAARDEN.md` and `DREMPELS.md` are in there too, and
those are worth keeping whatever happens: twenty-five thousand simulated matches
measuring every card of the first version. They are the reason two cards of each
faction were dropped rather than picked.

---

## What is not finished

- No art. See above.
- No contract for the new line, and no free mints for existing holders.
  `docs/the-first-collection.md` has everything the snapshot needs.
- No addresses. The admin list and all four revenue wallets are deliberately
  empty rather than guessed — see `lib/admin.ts` and `lib/revenue.ts`, and the
  tests that fail the moment somebody fills one in.
- No domain, no X account, no Telegram. `lib/links.ts` says what that blocks.
