// Which card each token is, settled before the first one was sold.
//
// A token's picture is base + id and nothing else — the contract cannot draw
// anything, so the whole sequence had to be decided somewhere. It was decided in
// scripts/shuffle.ts, from a seed the maker picked, and hashed. That hash goes
// on /mint before the sale opens, which is the only moment publishing it is
// worth anything: afterwards it proves nothing, because by then the order is
// already visible and a hash of it is a hash of what everybody can see.
//
// What the promise is: the order was fixed beforehand and has not moved.
// What it is not: a claim that the order is fair. Those are different, and the
// page says the second one out loud rather than letting the first imply it.
//
// Anybody can check it. `npx tsx scripts/shuffle.ts 20260917` rewrites
// data/shuffle.json, and it comes back byte for byte identical or the promise
// was false.
//
// ── WHY THIS FILE EXISTS AND THE PAGE DOES NOT JUST SAY IT ───────────────────
//
// The same rule as lib/addresses.ts. A hash typed onto a page is a hash that can
// be a character out and nobody would ever know by looking — and a provenance
// commitment that does not match the file it commits to is worse than none,
// because it is the one number a buyer is invited to trust.

import shuffle from "@/data/shuffle.json";

import { SET } from "@/lib/set";
import { RARITIES, type Rarity } from "@/engine/types";

/** The seed the sequence was drawn from. Published so it can be rerun. */
export const SEED: number = shuffle.seed;

/** How many tokens there will ever be. The contract holds the same number. */
export const TOKENS: number = shuffle.tokens;

/** Copies of every card at that rarity. */
export const COPIES: Readonly<Record<Rarity, number>> = shuffle.copies;

/** The commitment. sha256 over the sequence, published before the first sale. */
export const HASH: string = shuffle.hash;

{
  // Loud, at module load, the way validateSet is. A shuffle that has drifted
  // from the set it was drawn against would otherwise surface as a page that
  // renders fine and promises the wrong thing.
  if (shuffle.order.length !== TOKENS) {
    throw new Error(`shuffle.json says ${TOKENS} tokens and lists ${shuffle.order.length}.`);
  }
  if (!/^[0-9a-f]{64}$/.test(HASH)) {
    throw new Error(`The provenance hash is not a sha256 digest: ${HASH}.`);
  }
  let expected = 0;
  for (const card of SET) expected += COPIES[card.rarity];
  if (expected !== TOKENS) {
    throw new Error(
      `${SET.length} cards at these copy counts is ${expected} tokens, not ${TOKENS}. ` +
        `The set changed after the shuffle was drawn; rerun scripts/shuffle.ts.`,
    );
  }
  for (const rarity of RARITIES) {
    if (!Number.isInteger(COPIES[rarity]) || COPIES[rarity] <= 0) {
      throw new Error(`${rarity} is printed ${COPIES[rarity]} times, which is not a number of copies.`);
    }
  }
}
