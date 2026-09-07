// Small shared operations on the state. Kept separate so effects.ts and match.ts
// don't have to import each other.

import type { Aura, Card, CardIndex, LogTone, Player, ProjectCard, Sector, State } from "./types";
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
/**
 * Refills a hand to its size.
 *
 * The size is passed in rather than read from RULES, because an aura can raise
 * it and this file cannot see the support row without importing match.ts back.
 * Callers use handSizeFor, which is the one place that adds it up.
 */
export function drawToFull(state: State, player: Player, handSize: number): void {
  const missing = handSize - state.players[player].hand.length;
  if (missing > 0) draw(state, player, missing);
}

/**
 * Which sectors an aura helps.
 *
 * A pumpSector aura answers this by itself; a champion aura does not, because it
 * names project families and a family's sector lives on the cards. So this takes
 * the set — and it is the reason the deck presets and the coverage test both call
 * one function instead of each reaching for `aura.sector` and quietly missing
 * every champion in the game.
 *
 * Takes cards rather than a CardIndex because both callers hold the set as a
 * list and neither is in a hot path.
 */
export function auraSectors(aura: Aura, cards: readonly Card[]): Sector[] {
  if (aura.kind === "pumpSector") return [aura.sector];
  // Budget, hand and healing are not about a sector at all — they help whatever
  // you happen to be holding. An empty list is the true answer and the callers
  // are built for it: the coverage test asks which sectors have an aura behind
  // them, and these have none to give.
  if (aura.kind === "healEachTurn" || aura.kind === "bankPays") return [aura.sector];
  if (aura.kind !== "championProjects") return [];
  // A champion has its own sector for the flat half, and its families sit in
  // one too. Nearly always the same sector — but "nearly always" is not a thing
  // to build a coverage check on.
  const found = new Set<Sector>([aura.sector]);
  for (const ticker of aura.tickers) {
    for (const card of cards) {
      if (card.type === "project" && card.ticker === ticker) found.add(card.sector);
    }
  }
  return [...found];
}
