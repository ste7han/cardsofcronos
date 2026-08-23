// Minting a deck.
//
// The other half of the mint. A pack is ten cards and a handful of luck; a deck
// mint is sixty in one go, which is the product somebody buys when they want to
// start playing today rather than collect towards it.
//
// Sixty rather than forty, and that was measured. Forty cards *is* a deck, so a
// mint of forty leaves nothing to build — you play what came out of the wrapper.
// Sixty leaves twenty to leave out, and that choice is worth about fifteen points
// to the unluckiest tenth of players: at forty they land on 31.8% against a fixed
// field, at fifty-six on 46.4%, and past sixty-four it stops moving.
//
// Three rules, and only two of them bind:
//
//   sixty cards        the product
//   twenty projects    a floor, and it never fires — 539 of the 655 cards are
//                      projects, so a draw of sixty already holds about 52. It
//                      stays because a set that changes shape could make it fire,
//                      and a floor that costs nothing is worth keeping
//   two per project    this one fires, and it is the cheaper of the two levers.
//                      Without it a mint hands one player five cards of the same
//                      project and another a spread, and the gap between the
//                      luckiest and unluckiest tenth widens by about ten points
//
// Rarity comes from PULL_WEIGHTS, the same table a pack uses.

import { drawOne, PULL_WEIGHTS } from "./draw";
import type { Card } from "./types";

export const DECK_MINT_SIZE = 60;
export const DECK_MINT_MIN_PROJECTS = 20;
export const DECK_MINT_MAX_PER_PROJECT = 2;

/**
 * Mints a deck: DECK_MINT_SIZE cards, drawn.
 *
 * Drawn against the whole set, like a pack, and for the same reason: odds that
 * stop holding once a collection fills up are not odds. See the note on
 * openPack. Nothing repeats inside one mint — sixty cards means sixty different
 * cards — but a card you already own can turn up again in the next one.
 *
 * Deterministic in the seed, like everything else in the engine, so a mint can be
 * replayed and a complaint about one can be looked at.
 */
export function mintDeck(cards: readonly Card[], seed: number): string[] {
  const taken = new Set<string>();
  const minted: string[] = [];
  const perProject = new Map<string, number>();
  let state = seed | 0;
  let projects = 0;

  const underCap = (card: Card): boolean =>
    card.type !== "project" ||
    (perProject.get(card.project) ?? 0) < DECK_MINT_MAX_PER_PROJECT;

  const pull = (only?: (card: Card) => boolean): boolean => {
    const drawn = drawOne(cards, PULL_WEIGHTS, taken, state, (c) => underCap(c) && (!only || only(c)));
    if (!drawn) return false;
    state = drawn.state;
    taken.add(drawn.card.id);
    if (drawn.card.type === "project") {
      perProject.set(drawn.card.project, (perProject.get(drawn.card.project) ?? 0) + 1);
      projects += 1;
    }
    minted.push(drawn.card.id);
    return true;
  };

  // The floor first, so it cannot be missed by luck at the end.
  while (projects < DECK_MINT_MIN_PROJECTS && minted.length < DECK_MINT_SIZE) {
    if (!pull((c) => c.type === "project")) break;
  }
  while (minted.length < DECK_MINT_SIZE) {
    if (!pull()) break;
  }

  return minted;
}
