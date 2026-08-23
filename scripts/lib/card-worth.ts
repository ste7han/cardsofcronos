// What each card is worth, measured rather than guessed.
//
// Play the card into a board and let the clock run out with both sides passing
// and their budget marked spent, then take the difference in margin. Cheap,
// deterministic, and it ranks cards without a bot's opinion in the middle of it.
//
// Two things this is not. It is not what a card is worth in a fight — coasting
// removes every interaction. And the number is *gross*: the still-life hands the
// card its own price back before playing it, so ranking on it directly picks the
// most expensive cards in the game. Divide by MARKETING_COST before using it to
// choose. That mistake once produced a deck of forty mythics and a win rate of
// 0.0%.

import { CARDS } from "../../data/cards";
import { chooseMove } from "../../engine/bot";
import { applyMove, budgetForTurn, buildIndex, newMatch } from "../../engine/match";
import { MARKETING_COST, RULES, type CardIndex, type State } from "../../engine/types";

function boardAt(index: CardIndex, seed: number, turn: number): State {
  let state = newMatch(CARDS, seed);
  let guard = 0;
  while (!state.finished && state.turn < turn && guard++ < 200) {
    state = applyMove(state, chooseMove(state, index), index);
  }
  const copy = structuredClone(state) as State;
  copy.toMove = "you";
  copy.budgetThisTurn = budgetForTurn(RULES.turns);
  copy.budgetSpentThisTurn = 0;
  return copy;
}

function coast(index: CardIndex, state: State): number {
  let s = state;
  let guard = 0;
  while (!s.finished && guard++ < 400) {
    const quiet = structuredClone(s) as State;
    quiet.budgetSpentThisTurn = quiet.budgetThisTurn;
    s = applyMove(quiet, { kind: "endTurn" }, index);
  }
  return s.players.you.mc - s.players.opponent.mc;
}

/** Gross margin a card adds, summed over a few boards early and mid match. */
export function measureWorth(index: CardIndex): Map<string, number> {
  const worth = new Map<string, number>();
  for (const turn of [3, 6]) {
    for (let seed = 0; seed < 4; seed++) {
      const base = boardAt(index, seed, turn);
      const without = coast(index, structuredClone(base) as State);
      for (const card of CARDS) {
        const withCard = structuredClone(base) as State;
        withCard.players.you.hand = [card.id, ...withCard.players.you.hand];
        withCard.budgetThisTurn = base.budgetThisTurn + MARKETING_COST[card.rarity];
        try {
          const after = coast(
            index,
            applyMove(withCard, { kind: "playCard", handIndex: 0, targetIndex: 0 }, index),
          );
          worth.set(card.id, (worth.get(card.id) ?? 0) + (after - without));
        } catch {
          // Not legal from this board; it contributes nothing rather than a zero.
        }
      }
    }
  }
  return worth;
}

export { buildIndex };
