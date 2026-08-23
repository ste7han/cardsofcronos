// Budget is left on the table on four turns in five. Why?
//
// Not because the hand is too small — measured at the start of a turn it is worth
// more than the grant right through to turn ten. So the money stops somewhere
// else, and there are only three places it can stop:
//
//   the leftover is smaller than the cheapest card in hand
//   the cards in hand need a target that is not on the board
//   the bot had something it could play and judged it not worth playing
//
// The third is the bot's opinion rather than the game's rule, so it is counted
// separately and never folded in with the other two.
//
//   npx tsx scripts/why-unspent.ts [matches]

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { formatMC } from "../engine/format";
import { cardById } from "../engine/helpers";
import { applyMove, buildIndex, newMatch, playable, whyNot } from "../engine/match";
import { MARKETING_COST } from "../engine/types";

const index = buildIndex(CARDS);
const MATCHES = Number(process.argv[2] ?? 1500);

let turnsWithWaste = 0;
let wasteTooSmall = 0;
let wasteNoTarget = 0;
let wasteDeclined = 0;
let mcTooSmall = 0;
let mcNoTarget = 0;
let mcDeclined = 0;
let handEmpty = 0;

for (let seed = 0; seed < MATCHES; seed++) {
  const deck = buildDeck(CARDS, seed);
  let state = newMatch(CARDS, seed, { you: deck, opponent: deck });
  let guard = 0;

  while (!state.finished && guard++ < 400) {
    const mover = state.toMove;
    const before = state;
    const move = chooseMove(state, index);

    if (move.kind === "endTurn") {
      const left = before.budgetThisTurn - before.budgetSpentThisTurn;
      if (left > 0) {
        turnsWithWaste += 1;
        const hand = before.players[mover].hand.map((id) => cardById(index, id));
        if (hand.length === 0) {
          handEmpty += 1;
        } else if (hand.some((c) => playable(before, c, mover, index))) {
          // Something was affordable and legal. The bot chose not to.
          wasteDeclined += 1;
          mcDeclined += left;
        } else if (hand.every((c) => MARKETING_COST[c.rarity] > left)) {
          wasteTooSmall += 1;
          mcTooSmall += left;
        } else {
          // Affordable but blocked — a target that is not there.
          const blocked = hand.filter(
            (c) => MARKETING_COST[c.rarity] <= left && whyNot(before, c, mover, index) !== null,
          );
          if (blocked.length) {
            wasteNoTarget += 1;
            mcNoTarget += left;
          } else {
            wasteDeclined += 1;
            mcDeclined += left;
          }
        }
      }
    }
    state = applyMove(state, move, index);
  }
}

const pct = (n: number) => `${((n / turnsWithWaste) * 100).toFixed(1)}%`;

console.log(`${MATCHES} matches — why the budget does not get spent\n`);
console.log(`  turns ending with money on the table : ${turnsWithWaste}`);
console.log(`  of those, the hand was empty         : ${handEmpty} (${pct(handEmpty)})\n`);
console.log(`  reason                                  turns          market cap lost`);
console.log(`  leftover smaller than the cheapest card ${String(wasteTooSmall).padStart(6)} ${pct(wasteTooSmall).padStart(7)}   ${formatMC(mcTooSmall / MATCHES).padStart(8)} per match`);
console.log(`  cards in hand had no legal target       ${String(wasteNoTarget).padStart(6)} ${pct(wasteNoTarget).padStart(7)}   ${formatMC(mcNoTarget / MATCHES).padStart(8)} per match`);
console.log(`  the bot could play and chose not to     ${String(wasteDeclined).padStart(6)} ${pct(wasteDeclined).padStart(7)}   ${formatMC(mcDeclined / MATCHES).padStart(8)} per match`);
console.log(
  `\n  The first two are the game. The third is the bot's judgement and says` +
    `\n  nothing about whether a human would leave the same money behind.`,
);
