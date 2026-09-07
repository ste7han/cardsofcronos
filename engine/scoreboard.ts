// The one place market cap changes.
//
// It used to be ten places, each doing `mc += something`. That was fine while
// nothing watched, and stopped being fine the moment a card could take a cut of
// what the other player gains: a toll that hooks nine of the ten quietly does
// not collect on the tenth, and nothing anywhere would say so. The lesson this
// project is built around is that an unknown name must fail loudly — the same
// applies to a known name somebody forgot to route through.
//
// So every gain and every loss comes through here, and a test walks the engine
// looking for anybody who wrote `.mc +=` instead.

import { cardLabel, formatMC } from "./format";
import { log } from "./helpers";
import type { Card, CardIndex, CardType, Player, State } from "./types";

/**
 * Market cap cannot go below zero. Returns the change that actually happened.
 *
 * `taxed` is off for the tolls' own payments — a toll paid out of a toll is a
 * loop, and two players each holding one would never stop paying each other.
 */
export function changeMC(
  state: State,
  player: Player,
  delta: number,
  index?: CardIndex,
  taxed = true,
): number {
  const side = state.players[player];
  const before = side.mc;
  // Leverage, before anything else touches the number. Both directions, which is
  // the whole card — and applied here because here is the only place market cap
  // moves, so it cannot be applied to nine paths and quietly miss the tenth.
  let moving = index ? delta * (1 + leverageFor(state, player, index) / 100) : delta;
  // And then the vault, on the way down only. After the lever, which is the
  // order the two cards read in — it moves further, and part of the fall is
  // absorbed.
  if (index && moving < 0) moving *= 1 - shieldFor(state, player, index) / 100;
  side.mc = Math.max(0, side.mc + Math.round(moving));
  const moved = side.mc - before;
  // The high-water mark, kept here because here is where market cap moves. Any
  // other place would be a second implementation waiting to fall behind.
  if (side.mc > state.peakMC[player]) state.peakMC[player] = side.mc;

  if (taxed && moved > 0 && index) collectTolls(state, player, moved, index);
  // The oracle reads the move rather than the direction, so it fires on their
  // bad turns too. Behind the same `taxed` guard as the toll: a payment is not
  // itself a price move worth publishing, and without that two of these facing
  // each other would read each other until the stack gave out.
  if (taxed && moved !== 0 && index) publishPrice(state, player, moved, index);
  return moved;
}

/**
 * Anybody reading the price takes their share of the move.
 *
 * Read off the table every turn, undamaged only, and paid untaxed — the same
 * three rules every other reaction here follows. The absolute value, because a
 * fall is as much a price as a rise and the card says so.
 */
function publishPrice(state: State, moved: Player, amount: number, index: CardIndex): void {
  const reader: Player = moved === "you" ? "opponent" : "you";
  for (const position of state.players[reader].projects) {
    const card = index.get(position.cardId);
    if (!card || card.type !== "project" || !card.oracle) continue;
    if (position.holders < card.holders) continue;

    const paid = Math.round((Math.abs(amount) * card.oracle) / 100);
    if (paid <= 0) continue;
    changeMC(state, reader, paid, index, false);
    log(
      state,
      reader,
      `${cardLabel(card as Card)}: their price moved ${formatMC(Math.abs(amount))} — ${formatMC(paid)} MC to you.`,
      "pump",
    );
  }
}

/**
 * A percentage read off one player's undamaged positions, added up.
 *
 * Three standing percentages now share this — leverage, the shield, and the
 * discount the pool gives — and they were three copies of the same eight lines
 * before that. One place that decides what "standing" means: the position is
 * yours, the card carries the field, and it still has every holder it launched
 * with. Change that rule once and all three change with it.
 *
 * Summed rather than compounded. One position per project means at most one card
 * of a family is standing, but two families could both carry the same kind, and
 * adding is the answer a player can work out in their head.
 */
function standingPercent(
  state: State,
  player: Player,
  index: CardIndex,
  read: (card: Extract<Card, { type: "project" }>) => number | undefined,
): number {
  let total = 0;
  for (const position of state.players[player].projects) {
    const card = index.get(position.cardId);
    if (!card || card.type !== "project") continue;
    const value = read(card);
    if (!value) continue;
    if (position.holders < card.holders) continue;
    total += value;
  }
  return total;
}

/** How much larger every move of this player's market cap is, as a percentage. */
function leverageFor(state: State, player: Player, index: CardIndex): number {
  return standingPercent(state, player, index, (card) => card.leverage);
}

/**
 * How much of a loss this player does not take, as a percentage.
 *
 * Capped below a whole loss: a player who cannot lose market cap is not playing
 * the same game. Validation holds each card under 50 on its own; this is the
 * backstop for two of them standing at once.
 */
function shieldFor(state: State, player: Player, index: CardIndex): number {
  return Math.min(standingPercent(state, player, index, (card) => card.shield), 80);
}

/**
 * How much less everything costs this player, as a percentage.
 *
 * Lives here rather than beside priceFor because this is where the rule about
 * undamaged standing positions lives, and because a price that could be read two
 * ways is exactly the shape of bug this engine keeps one door for. Capped short
 * of free for the same reason a shield is capped short of whole.
 */
export function discountFor(state: State, player: Player, index: CardIndex): number {
  return Math.min(standingPercent(state, player, index, (card) => card.discount), 70);
}

/**
 * Anybody with a toll standing against this player takes their share.
 *
 * Read off the table every time rather than banked, so cancelling the position
 * that carries a toll stops it collecting the same turn — the same rule every
 * other standing thing in this engine follows.
 */
function collectTolls(state: State, gained: Player, amount: number, index: CardIndex): void {
  const collector: Player = gained === "you" ? "opponent" : "you";
  for (const position of state.players[collector].projects) {
    const card = index.get(position.cardId);
    if (!card || card.type !== "project" || !card.toll) continue;
    // Undamaged only, like every other standing rule. A toll that goes on
    // collecting after somebody has answered it is a toll with no answer.
    if (position.holders < card.holders) continue;

    const cut = Math.round((amount * card.toll.percentage) / 100);
    if (cut <= 0) continue;
    // taxed: false, or their toll would collect on your toll's collection and
    // back again.
    changeMC(state, collector, cut, index, false);
    changeMC(state, gained, -cut, index, false);
    log(
      state,
      collector,
      `${cardLabel(card as Card)}: ${card.toll.percentage}% of ${formatMC(amount)} — ` +
        `${formatMC(cut)} off the top.`,
      "pump",
    );
  }
}

/**
 * Marketing budget leaving a player's hands, in one place.
 *
 * It was four: playing a card, taking profit, making room, and the effect that
 * converts what is left. Each of them wrote the two counters by hand and each of
 * them would have had to learn about the tip separately — which is the shape of
 * every silent miss this set has found. Now they all come here.
 *
 * The tip is Jito's: pay a little extra and your transaction goes first, and
 * everyone does. Anybody across the table holding one takes a share of what was
 * spent, as market cap. Untaxed, like every other reaction, so a toll on the
 * other side cannot take a cut of it and start the two of them paying each
 * other.
 */
export function spendBudget(
  state: State,
  player: Player,
  amount: number,
  index: CardIndex,
): void {
  if (amount <= 0) return;
  state.budgetSpentThisTurn += amount;
  state.budgetSpent[player] += amount;

  const watcher: Player = player === "you" ? "opponent" : "you";
  for (const position of state.players[watcher].projects) {
    const card = index.get(position.cardId);
    if (!card || card.type !== "project" || !card.tip) continue;
    if (position.holders < card.holders) continue;

    const taken = Math.round((amount * card.tip) / 100);
    if (taken <= 0) continue;
    changeMC(state, watcher, taken, index, false);
    log(
      state,
      watcher,
      `${cardLabel(card as Card)}: they spent ${formatMC(amount)} — ${formatMC(taken)} MC of it is yours.`,
      "pump",
    );
  }
}

/**
 * Anybody watching for this kind of card takes their payment.
 *
 * Called when a card is played, from the one place a card is played. Same shape
 * as a toll: read off the table, undamaged only, and the payment itself is
 * untaxed so a toll on the other side does not take a cut of it and start the
 * two of them paying each other.
 */
export function onCardPlayed(
  state: State,
  player: Player,
  type: CardType,
  index: CardIndex,
): void {
  // Your own side first: a framework takes its cut of what you build, including
  // of itself.
  for (const position of state.players[player].projects) {
    const card = index.get(position.cardId);
    if (!card || card.type !== "project" || !card.onYourPlay) continue;
    if (position.holders < card.holders) continue;

    // Untaxed, for the same reason the watcher's payment is: a toll on the other
    // side taking a cut of this would have the two of them paying each other.
    changeMC(state, player, card.onYourPlay.mc, index, false);
    log(
      state,
      player,
      `${cardLabel(card as Card)}: built on it — ${formatMC(card.onYourPlay.mc)} MC.`,
      "pump",
    );
  }

  const watcher: Player = player === "you" ? "opponent" : "you";
  for (const position of state.players[watcher].projects) {
    const card = index.get(position.cardId);
    if (!card || card.type !== "project" || !card.onTheirPlay) continue;
    if (card.onTheirPlay.cardType !== type) continue;
    if (position.holders < card.holders) continue;

    changeMC(state, watcher, card.onTheirPlay.mc, index, false);
    log(
      state,
      watcher,
      `${cardLabel(card as Card)}: they played a ${type} — ${formatMC(card.onTheirPlay.mc)} MC.`,
      "pump",
    );
  }
}
