// Do take profit and throwing a card away ever earn their 50K?
//
// Both cost TURN_ACTION_COST out of the same pot that buys cards, so every use is
// a card not played. Neither has been measured since the budget arrived. If the
// bot never reaches for them the cards are decoration; if it reaches constantly
// they may be too cheap.
//
//   npx tsx scripts/action-use.ts [matches]

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { formatMC } from "../engine/format";
import { cardById } from "../engine/helpers";
import { applyMove, buildIndex, canDiscard, canTakeProfit, newMatch } from "../engine/match";
import { RULES, type Player } from "../engine/types";

const index = buildIndex(CARDS);
const MATCHES = Number(process.argv[2] ?? 1500);

let plays = 0;
let profits = 0;
let discards = 0;
let endTurns = 0;
/** Turns where the action was affordable and legal but not taken. */
let couldProfit = 0;
let couldDiscard = 0;
/** Positions that rugged while still on the board — profit not taken in time. */
let rugged = 0;
let bankedByProfit = 0;
const profitByTurn = new Array(RULES.turns + 1).fill(0);

for (let seed = 0; seed < MATCHES; seed++) {
  const deck = buildDeck(CARDS, seed);
  let state = newMatch(CARDS, seed, { you: deck, opponent: deck });
  let guard = 0;
  let lastKey = "";

  while (!state.finished && guard++ < 400) {
    const mover: Player = state.toMove;
    const key = `${state.turn}:${mover}`;
    if (key !== lastKey) {
      lastKey = key;
      if (canTakeProfit(state, mover, index)) couldProfit += 1;
      if (canDiscard(state, mover)) couldDiscard += 1;
    }

    const before = state;
    const move = chooseMove(state, index);
    if (move.kind === "playCard") plays += 1;
    else if (move.kind === "takeProfit") {
      profits += 1;
      profitByTurn[Math.min(before.turn, RULES.turns)] += 1;
      bankedByProfit += before.players[mover].projects[move.slot]?.earned ?? 0;
    } else if (move.kind === "discard") discards += 1;
    else if (move.kind === "endTurn") endTurns += 1;

    state = applyMove(state, move, index);
    for (const entry of state.log.slice(before.log.length)) {
      if (entry.text.includes("it rugs") || entry.text.includes(" rugs ")) rugged += 1;
    }
  }
}

console.log(`${MATCHES} matches — what the two 50K actions get used for\n`);
console.log(`  cards played          : ${plays}`);
console.log(`  take profit           : ${profits}   (${((profits / plays) * 100).toFixed(1)}% as often as a card is played)`);
console.log(`  cards thrown away     : ${discards}   (${((discards / plays) * 100).toFixed(1)}%)`);
console.log(`  turns ended           : ${endTurns}`);
console.log(`\n  turns where take profit was available : ${couldProfit}`);
console.log(`  ...and it was taken                   : ${profits} (${((profits / Math.max(1, couldProfit)) * 100).toFixed(1)}%)`);
console.log(`  turns where a throw was available     : ${couldDiscard}`);
console.log(`  ...and it was taken                   : ${discards} (${((discards / Math.max(1, couldDiscard)) * 100).toFixed(1)}%)`);
console.log(`\n  market cap banked by taking profit    : ${formatMC(bankedByProfit / MATCHES)} per match`);
console.log(`  positions that rugged instead         : ${(rugged / MATCHES).toFixed(2)} per match`);

if (profits > 0) {
  console.log(`\n  when profit is taken, by turn:`);
  for (let t = 1; t <= RULES.turns; t++) {
    if (!profitByTurn[t]) continue;
    console.log(`    turn ${String(t).padStart(2)}: ${profitByTurn[t]}`);
  }
}
