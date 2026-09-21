// Drawing the cards somebody just bought.
//
// Nobody hands a player a deck somebody else built. The page says what the odds
// are and the draw does the rest, with rare cards rare — which is what a trading
// card game is, and the reason the mint is worth anything.
//
// ── THERE USED TO BE TWO PRODUCTS, AND A PROMISE ─────────────────────────────
//
// A pack of ten with one slot guaranteed rare or better, and a single card with
// nothing promised. The pack cost a third less per card and the floor was what
// it was selling.
//
// Both went in September 2026, for a reason that is not about balance. Which
// card each token is was settled before the mint opened and published as a hash
// — see lib/provenance.ts — and a sequence fixed in advance cannot promise the
// contents of any ten tokens somebody buys together. The contract cannot pick
// out a rare for them; there is nothing in it that draws. So the floor could not
// have been honoured, and a floor that cannot be honoured is not a product.
//
// What is left is the honest half: you buy a number of cards and the odds are
// the odds. The guarantee is gone from here rather than quietly left in, because
// a function that still enforces a promise the page no longer makes is the same
// trap as two cards sharing an action name.
//
// ── WHAT THIS STILL WILL NOT DO ──────────────────────────────────────────────
//
// It will not repeat a card inside a single purchase. Ten of the same card in
// one transaction is a bug however you argue it. Across purchases duplicates are
// fine and deliberate: a second copy is something to trade, because a deck holds
// one of each.
//
// It also draws against the whole set rather than against what you already own.
// It used to skip cards you held, on the grounds that a duplicate is not a card
// but a disappointment. That was true when this was a local toy and false the
// moment the cards became tradeable — and it quietly broke the one thing a draw
// must not break. Commons are half of every pull, so commons run out first: by
// about 460 cards a collection holds all of them, by 550 all the rares too, and
// from there a draw could only hand over what was left. The printed odds of
// 50/35/9/5/1 became 0/0/40/50/10 with nothing wrong anywhere in the code. See
// scripts/pack-drift.ts, which shows the table drifting purchase by purchase.

import { drawOne, PULL_WEIGHTS } from "./draw";
import type { Card, Rarity } from "./types";

/**
 * The odds, per card, whatever you buy.
 *
 * One table for the whole mint, because two tables for the same cards is a
 * difference nobody could explain. That is 9% epic, 5% legendary, 1% mythic, so
 * a mythic is roughly one card in a hundred and it stays a story when it
 * happens.
 */
export const MINT_PULL_WEIGHTS = PULL_WEIGHTS;

/** Cards that count towards the backbone. What a collection is actually built on. */
const BACKBONE_RARITIES: readonly Rarity[] = ["epic", "legendary", "mythic"];

export function isBackbone(card: Card): boolean {
  return BACKBONE_RARITIES.includes(card.rarity);
}

/**
 * The cards from one purchase, at the printed odds and with nothing promised.
 *
 * Deterministic in the seed, like everything else in the engine, so a purchase
 * can be replayed and a complaint about one can be looked at.
 *
 * Returns fewer than asked only when the set runs out, which it cannot at any
 * size anybody can buy. Callers report a short draw rather than papering over
 * it — see lib/collection.ts.
 */
export function openCards(cards: readonly Card[], seed: number, count: number): string[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`Asked for ${count} cards, which is not a number of cards.`);
  }

  const taken = new Set<string>();
  const drawn: string[] = [];
  let state = seed | 0;

  while (drawn.length < count) {
    const pulled = drawOne(cards, MINT_PULL_WEIGHTS, taken, state);
    if (!pulled) break;
    state = pulled.state;
    taken.add(pulled.card.id);
    drawn.push(pulled.card.id);
  }
  return drawn;
}
