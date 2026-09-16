// Opening packs.
//
// Nobody hands a player a deck somebody else built. The rules say what a pack
// must contain and the draw does the rest, with rare cards rare — which is what
// a trading card game is, and the reason the mint is worth anything.
//
// Ten cards, bought, with one slot guaranteed rare or better. That guarantee is
// the only promise; everything above it is the odds.
//
// There used to be a second product here: a free starter pack of forty, drawn on
// much kinder rates with a guaranteed backbone of ten epic-or-better and a
// sector theme. It went when the mint arrived. Forty cards *is* a deck, so a
// free forty left nothing to build and nothing to mint for — the best deck in
// the game was the one that cost nothing. A new player mints now, either sixty
// cards or ten, on the same table as everybody else.
//
// What no pack fixes, because nothing does: two collections drawn on these rules
// play out a long way apart. That spread is what opening packs is, and the
// ladder is what absorbs it — see DESIGN.md.

import { drawOne, PULL_WEIGHTS } from "./draw";
import { nextInt } from "./rng";
import type { Card, Rarity, Sector } from "./types";
import { RARITIES, RULES, SECTORS } from "./types";

/**
 * An ordinary pack, bought rather than given.
 *
 * The same table the deck mint draws against — one set of odds for the whole
 * mint, because two tables for the same cards is a difference nobody could
 * explain. Per card that is 9% epic, 5% legendary, 1% mythic, so a mythic is
 * roughly one pack in ten and it stays a story when it happens.
 *
 * What a pack still has that a deck mint does not is the guaranteed slot below.
 * What guarantees a pack *should* carry beyond that is not settled.
 */
export const PACK_PULL_WEIGHTS = PULL_WEIGHTS;

export const PACK_SIZE = 10;

/** Cards that count towards the backbone. */
const BACKBONE_RARITIES: readonly Rarity[] = ["epic", "legendary", "mythic"];

export function isBackbone(card: Card): boolean {
  return BACKBONE_RARITIES.includes(card.rarity);
}

/**
 * A pack of PACK_SIZE cards, with one slot guaranteed rare or better.
 *
 * That slot is the one every card game has, so a pack is never entirely nothing.
 * Everything above it is luck.
 *
 * Every pack is drawn against the whole set, not against what you already have.
 *
 * It used to skip cards you owned, on the grounds that a duplicate is not a card
 * but a disappointment. That was true when this was a local toy and false the
 * moment the cards became tradeable — and it quietly broke the one thing a pack
 * must not break. Commons are half of every draw, so commons run out first: by
 * about 460 cards a collection holds all 202 of them, by 550 all the rares too,
 * and from there a pack could only hand over what was left. The printed odds of
 * 50/35/9/5/1 became 0/0/40/50/10 with nothing wrong anywhere in the code. See
 * scripts/pack-drift.ts, which shows the table drifting pack by pack.
 *
 * A pack now runs its odds forever, which is what the page promises. Duplicates
 * happen; a second copy is something to trade rather than something to deck,
 * because a deck still holds one of each.
 *
 * The only thing it will not do is repeat itself inside a single pack: ten of
 * the same card in one wrapper is a bug however you argue it.
 *
 * Deterministic in the seed, like everything else in the engine, so a pack can be
 * replayed and a complaint about one can be looked at.
 */
export function openPack(cards: readonly Card[], seed: number): string[] {
  const taken = new Set<string>();
  const pack: string[] = [];
  let state = seed | 0;

  const pull = (only?: (card: Card) => boolean): Card | null => {
    const drawn = drawOne(cards, PACK_PULL_WEIGHTS, taken, state, only);
    if (!drawn) return null;
    state = drawn.state;
    taken.add(drawn.card.id);
    pack.push(drawn.card.id);
    return drawn.card;
  };

  // The guarantee first. An epic-or-better if the collection still has one, a
  // rare otherwise, and if neither is left the pack is simply commons — a player
  // that far along has nothing left to be guaranteed.
  if (!pull(isBackbone)) pull((c) => c.rarity !== "common");

  while (pack.length < PACK_SIZE) {
    if (!pull()) break;
  }
  return pack;
}

/**
 * One card, at the printed odds and with nothing promised.
 *
 * The other way to buy. A pack guarantees a rare or better because ten cards
 * with no floor is a wrapper you can open and feel robbed by; one card has no
 * such problem, because one card at 50/35/9/5/1 is exactly what it says on the
 * page and there is nothing to hide a bad slot inside.
 *
 * So this is deliberately not "a pack of one". It runs the same weights and
 * makes no guarantee, which is the whole difference between the two products and
 * the reason the pack is worth a third less per card: the pack sells you a floor.
 *
 * Deterministic in the seed, like everything else here.
 */
export function openSingle(cards: readonly Card[], seed: number): string[] {
  const drawn = drawOne(cards, PACK_PULL_WEIGHTS, new Set<string>(), seed | 0);
  return drawn ? [drawn.card.id] : [];
}
