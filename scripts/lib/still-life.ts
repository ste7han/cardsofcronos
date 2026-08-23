// The still life: play one card into a built board, let the clock run out with
// both sides passing, and take the difference in final margin.
//
// One definition, because there used to be two. rarity-value.ts and mint-size.ts
// each carried their own copy, both copies had the same bug, and one of them was
// fixed. Two copies of a measurement drift, and the half that drifts is the half
// nobody re-reads.
//
// What it is for: what a card is worth on its own, not what it is worth in a
// fight. Playing the rest out with the bot was tried and the answer moved from
// "$9.1K per $10K" to "$1.3K" between four boards and sixteen, because one extra
// card changes every later decision and the noise swamped the signal. Coasting
// leaves exactly one difference between the two runs: this card.
//
// Margin rather than market cap, so an attack card scores for what it takes off
// the opponent. The game is won on the higher number, so that is the number.

import { chooseMove } from "../../engine/bot";
import { applyMove, budgetForTurn, newMatch } from "../../engine/match";
import { MARKETING_COST, RULES } from "../../engine/types";
import type { Card, CardIndex, State } from "../../engine/types";

/**
 * A mid-match position with room and budget for anything in the set.
 *
 * The free position is the whole point and is not an aesthetic choice. A card is
 * played with targetIndex 0, and on a full portfolio that means "close position
 * zero" — so the card gets charged for whatever it destroyed instead of measured
 * on what it adds. At $35K a turn, boards were not full by turn five and this
 * never showed. At $40K, 78% of them are, and commons measured as actively
 * negative while mythics did not, because a mythic's own pump swallows the loss
 * and a common's does not.
 *
 * Nothing about a card caused that. The rules moved and an instrument calibrated
 * against the old ones quietly stopped measuring what it claims. Any still life
 * built on a board has to make its own room, every time, rather than hope.
 */
export function board(
  cards: readonly Card[],
  index: CardIndex,
  seed: number,
  atTurn: number,
  decks?: { you: string[]; opponent: string[] },
): State {
  let state = newMatch(cards, seed, decks);
  let guard = 0;
  while (!state.finished && state.turn < atTurn && guard++ < 200) {
    state = applyMove(state, chooseMove(state, index), index);
  }
  const copy = structuredClone(state) as State;
  copy.toMove = "you";
  copy.budgetThisTurn = budgetForTurn(RULES.turns);
  copy.budgetSpentThisTurn = 0;

  while (copy.players.you.projects.length >= RULES.portfolioSize) {
    copy.players.you.projects.pop();
  }
  if (copy.players.you.projects.length >= RULES.portfolioSize) {
    throw new Error("The still life has no free position, so nothing measured on it means anything.");
  }
  return copy;
}

/**
 * Run the clock out with neither side playing anything, and return the margin.
 *
 * The budget is marked spent before each turn ends. Without that, coasting wastes
 * every remaining grant — over a million between turn five and turn ten — and
 * the waste rule drives both players to the floor at zero, where every card in
 * the set measures as worth exactly nothing.
 */
export function coast(state: State, index: CardIndex): number {
  let s = state;
  let guard = 0;
  while (!s.finished && guard++ < 400) {
    const quiet = structuredClone(s) as State;
    quiet.budgetSpentThisTurn = quiet.budgetThisTurn;
    s = applyMove(quiet, { kind: "endTurn" }, index);
  }
  return s.players.you.mc - s.players.opponent.mc;
}

/**
 * What one card adds to a board, in final margin. Null when it cannot be played
 * from that position — which is not a claim about the card.
 *
 * The card goes in as an extra card in hand and the turn's budget is raised by
 * exactly its price, so it is neither pushing a card out of the hand nor
 * competing for money the bot was going to spend anyway. Without the second one
 * every rarity reads negative, because the bot's own pick for those $20K beats a
 * card drawn at random — a fact about the bot rather than about the card.
 */
export function worthOf(base: State, card: Card, index: CardIndex, without: number): number | null {
  const withCard = structuredClone(base) as State;
  withCard.players.you.hand = [card.id, ...withCard.players.you.hand];
  withCard.budgetThisTurn = base.budgetThisTurn + MARKETING_COST[card.rarity];
  try {
    return coast(applyMove(withCard, { kind: "playCard", handIndex: 0, targetIndex: 0 }, index), index) - without;
  } catch {
    return null;
  }
}
