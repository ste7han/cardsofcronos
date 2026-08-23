// Why the waste zigzags: turn five throws away 36% of its budget and turn six 11%.
//
// A smooth ramp against a smooth hand would waste a smooth share. It does not, and
// an oscillation that regular is a mechanism rather than noise. The suspicion is
// that the budget ramp and the hand refill are out of phase: a fat turn empties
// the hand, the next turn draws back to five cheap cards and cannot spend, and the
// pattern alternates.
//
//   npx tsx scripts/turn-economy.ts [matches]

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { formatMC } from "../engine/format";
import { cardById } from "../engine/helpers";
import { applyMove, budgetForTurn, buildIndex, newMatch } from "../engine/match";
import { MARKETING_COST, RULES } from "../engine/types";

const index = buildIndex(CARDS);
const MATCHES = Number(process.argv[2] ?? 1500);

const n = new Array(RULES.turns + 1).fill(0);
const spent = new Array(RULES.turns + 1).fill(0);
const wasted = new Array(RULES.turns + 1).fill(0);
const cardsPlayed = new Array(RULES.turns + 1).fill(0);
const handAtStart = new Array(RULES.turns + 1).fill(0);
const handValueAtStart = new Array(RULES.turns + 1).fill(0);
const deckLeft = new Array(RULES.turns + 1).fill(0);

for (let seed = 0; seed < MATCHES; seed++) {
  const deck = buildDeck(CARDS, seed);
  let state = newMatch(CARDS, seed, { you: deck, opponent: deck });
  let guard = 0;
  let key = "";
  let playedThisTurn = 0;

  while (!state.finished && guard++ < 400) {
    const mover = state.toMove;
    const turn = Math.min(state.turn, RULES.turns);
    const thisKey = `${state.turn}:${mover}`;
    if (thisKey !== key) {
      key = thisKey;
      playedThisTurn = 0;
      n[turn] += 1;
      const hand = state.players[mover].hand;
      handAtStart[turn] += hand.length;
      handValueAtStart[turn] += hand.reduce(
        (a, id) => a + MARKETING_COST[cardById(index, id).rarity],
        0,
      );
      deckLeft[turn] += state.players[mover].deck.length;
    }

    const before = state;
    const move = chooseMove(state, index);
    if (move.kind === "playCard") playedThisTurn += 1;
    if (move.kind === "endTurn") {
      spent[turn] += before.budgetSpentThisTurn;
      wasted[turn] += before.budgetThisTurn - before.budgetSpentThisTurn;
      cardsPlayed[turn] += playedThisTurn;
    }
    state = applyMove(state, move, index);
  }
}

console.log(`${MATCHES} matches — where the budget goes, turn by turn\n`);
console.log(`  turn  granted    spent   wasted   cards   hand   hand worth   deck left`);
for (let t = 1; t <= RULES.turns; t++) {
  if (!n[t]) continue;
  console.log(
    `  ${String(t).padStart(4)}  ${formatMC(budgetForTurn(t)).padStart(7)}  ` +
      `${formatMC(spent[t] / n[t]).padStart(7)}  ${formatMC(wasted[t] / n[t]).padStart(7)}  ` +
      `${(cardsPlayed[t] / n[t]).toFixed(2).padStart(5)}  ${(handAtStart[t] / n[t]).toFixed(2).padStart(5)}  ` +
      `${formatMC(handValueAtStart[t] / n[t]).padStart(10)}  ${(deckLeft[t] / n[t]).toFixed(1).padStart(9)}`,
  );
}
console.log(
  `\n  "hand worth" is what the five cards in hand would cost to play, all of them.` +
    `\n  Where it drops below the grant, the turn cannot be spent however well it is played.`,
);
