// Drawing one card against a rarity table.
//
// Shared by every product that hands out cards, because the difference between a
// pack and a mint is the weights, the size and the guarantees — never the way a
// card comes out. Two implementations of this would drift, and a drift here is
// invisible: both would still produce cards.

import { nextInt } from "./rng";
import type { Card, Rarity } from "./types";
import { RARITIES } from "./types";

/**
 * The chance of each rarity, per card drawn. One table for the whole mint.
 *
 * Set by the maker rather than derived from the set, and those are two different
 * numbers: how many mythic cards exist is a question about the set, how often one
 * drops is a question about the economy. They used to be the same figure by
 * accident — a uniform draw put 5.2 mythics in a mint of sixty, because 8.7% of
 * the set is mythic. At 1% it is 0.6, and a mythic is a story again.
 *
 * Measured before it was chosen (`npx tsx scripts/mint-curves.ts`): a steeper
 * table makes every deck cheaper, and a cheaper deck escapes the marketing
 * budget — 16.5 cards played a match on a uniform draw against 23.1 on a steep
 * one. So the table decides how much of a deck reaches the table, not only how
 * it feels to open.
 */
export const PULL_WEIGHTS: Record<Rarity, number> = {
  common: 50,
  rare: 35,
  epic: 9,
  legendary: 5,
  mythic: 1,
};

/**
 * One card: rarity first by weight, then a card of that rarity.
 *
 * Shared by both kinds of pack, because the difference between them is the
 * weights and the guarantees, never the way a card comes out.
 *
 * Rolling a rarity that has nothing left to give is normal, not an error, so it
 * rerolls; `fallback` is what stops that being a loop. With a fallback the draw
 * always produces something and throws only when the set is genuinely exhausted;
 * without one it gives up and returns null, which is how an ordinary pack knows
 * to stop rather than hand out a card the player already owns.
 */
export function drawOne(
  cards: readonly Card[],
  weights: Record<Rarity, number>,
  taken: ReadonlySet<string>,
  seed: number,
  only?: (card: Card) => boolean,
  fallback = true,
): { card: Card; state: number } | null {
  let state = seed;
  const total = RARITIES.reduce((sum, r) => sum + weights[r], 0);

  for (let attempt = 0; attempt < 60; attempt++) {
    const roll = nextInt(total, state);
    state = roll.state;

    let running = 0;
    let rarity: Rarity = "common";
    for (const r of RARITIES) {
      running += weights[r];
      if (roll.value < running) {
        rarity = r;
        break;
      }
    }

    const pool = cards.filter(
      (c) => c.rarity === rarity && !taken.has(c.id) && (!only || only(c)),
    );
    if (pool.length === 0) continue;

    const which = nextInt(pool.length, state);
    state = which.state;
    return { card: pool[which.value]!, state: which.state };
  }

  if (!fallback) return null;

  const rest = cards.filter((c) => !taken.has(c.id) && (!only || only(c)));
  if (rest.length === 0) return null;

  const which = nextInt(rest.length, state);
  return { card: rest[which.value]!, state: which.state };
}

