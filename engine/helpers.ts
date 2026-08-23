// Small shared operations on the state. Kept separate so effects.ts and match.ts
// don't have to import each other.

import type { Card, CardIndex, LogTone, Player, ProjectCard, State } from "./types";
import { RULES } from "./types";

export function otherPlayer(player: Player): Player {
  return player === "you" ? "opponent" : "you";
}

/**
 * Look up a card. Throws if the id doesn't exist.
 *
 * This is the first Cards of Cronos lesson in one function: there, a name the
 * engine didn't recognise silently fell through to "do nothing" while the log
 * cheerfully reported "triggered". Here an unknown id is a crash, not a blank card.
 */
export function cardById(index: CardIndex, id: string): Card {
  const card = index.get(id);
  if (!card) {
    throw new Error(
      `Unknown card id "${id}". The card is not in the set — check data/cards.ts.`,
    );
  }
  return card;
}

export function projectById(index: CardIndex, id: string): ProjectCard {
  const card = cardById(index, id);
  if (card.type !== "project") {
    throw new Error(`Card "${id}" sits on the board as a project but is a ${card.type}.`);
  }
  return card;
}

export function log(state: State, player: Player | null, text: string, tone: LogTone): void {
  state.log.push({ turn: state.turn, player, text, tone });
}

/**
 * Draws cards from the deck into the hand. An empty deck is not an error, but it
 * is something you need to see, so it goes into the log.
 */
export function draw(state: State, player: Player, amount: number): void {
  const side = state.players[player];
  for (let i = 0; i < amount; i++) {
    const id = side.deck.shift();
    if (id === undefined) {
      log(state, player, "Deck is empty — no card drawn.", "system");
      return;
    }
    side.hand.push(id);
  }
}

/** Draws until the hand is full. */
export function drawToFull(state: State, player: Player): void {
  const missing = RULES.handSize - state.players[player].hand.length;
  if (missing > 0) draw(state, player, missing);
}
