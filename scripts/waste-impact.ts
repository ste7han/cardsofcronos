// What the unspent-budget rule actually costs, and whether it decides matches.
//
// The rule: a turn grants turn * RULES.budgetPerTurn, nothing carries, and every
// unspent dollar comes off your market cap. It is the newest rule in the game and
// the least visible — the maker lost a match to it without seeing it happen, and
// reported the rug that came afterwards as the cause.
//
// So this measures three things and refuses to guess at any of them:
//   1. how much market cap the rule destroys, per turn and per match
//   2. whether the waste gap between two players predicts who wins
//   3. whether a hand can even absorb the budget on the later turns
//
//   npx tsx scripts/waste-impact.ts [matches]

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { formatMC } from "../engine/format";
import { applyMove, budgetForTurn, buildIndex, newMatch } from "../engine/match";
import { RULES, type Player } from "../engine/types";

const index = buildIndex(CARDS);
const MATCHES = Number(process.argv[2] ?? 2000);

const wastedByTurn = new Array(RULES.turns + 1).fill(0);
const turnsByTurn = new Array(RULES.turns + 1).fill(0);


let wastedTotal = 0;
let finalMCTotal = 0;
/** Matches where the player who wasted less won. */
let lessWasteWon = 0;
let decided = 0;

for (let seed = 0; seed < MATCHES; seed++) {
  const deck = buildDeck(CARDS, seed);
  let state = newMatch(CARDS, seed, { you: deck, opponent: deck });
  const wasted: Record<Player, number> = { you: 0, opponent: 0 };

  let guard = 0;
  while (!state.finished && guard++ < 400) {
    const mover = state.toMove;
    const before = state;
    const move = chooseMove(state, index);

    if (move.kind === "endTurn") {
      const left = before.budgetThisTurn - before.budgetSpentThisTurn;
      const turn = Math.min(before.turn, RULES.turns);
      wasted[mover] += left;
      wastedTotal += left;
      wastedByTurn[turn] += left;
      turnsByTurn[turn] += 1;

      // NOT measured here any more. This used to total the hand at the moment the
      // turn ended — after the cards had been played — and print it as "hand could
      // hold", which said turns nine and ten were impossible to spend. They are
      // not: measured at the START of the turn the hand is worth 483K against a
      // 350K grant. scripts/turn-economy.ts does it at the right moment. A ceiling
      // measured after the spending has happened is not a ceiling.
    }
    state = applyMove(state, move, index);
  }

  finalMCTotal += state.players.you.mc + state.players.opponent.mc;
  if (state.winner !== null) {
    decided += 1;
    const loser: Player = state.winner === "you" ? "opponent" : "you";
    if (wasted[state.winner] < wasted[loser]) lessWasteWon += 1;
  }
}

const turnsTotal = turnsByTurn.reduce((a, b) => a + b, 0);

console.log(`${MATCHES} matches, mirrored decks — the unspent-budget rule\n`);
console.log(`  wasted per turn, averaged      : ${formatMC(wastedTotal / turnsTotal)}`);
console.log(`  wasted per player per match    : ${formatMC(wastedTotal / (MATCHES * 2))}`);
console.log(`  final market cap per player    : ${formatMC(finalMCTotal / (MATCHES * 2))}`);
console.log(
  `  so the rule destroys about      ${(
    (wastedTotal / (MATCHES * 2) / (finalMCTotal / (MATCHES * 2) + wastedTotal / (MATCHES * 2))) *
    100
  ).toFixed(0)}% of what a player would otherwise hold`,
);

console.log(`\n  per turn:`);
console.log(`  turn  granted   wasted   share`);
for (let t = 1; t <= RULES.turns; t++) {
  if (!turnsByTurn[t]) continue;
  const granted = budgetForTurn(t);
  const avgWaste = wastedByTurn[t] / turnsByTurn[t];
  console.log(
    `  ${String(t).padStart(4)}  ${formatMC(granted).padStart(7)}  ${formatMC(avgWaste).padStart(7)}  ` +
      `${`${Math.round((avgWaste / granted) * 100)}%`.padStart(5)}`,
  );
}

// The sanity check. Decks are mirrored, so waste is the only asymmetry the bot
// can create; if wasting less did not correlate with winning at all, the rule
// would be noise and this script would be measuring nothing.
const pct = ((lessWasteWon / decided) * 100).toFixed(1);
console.log(
  `\n  the player who wasted less won  : ${pct}% of ${decided} decided matches` +
    `\n  (50% would mean the rule does not decide anything; mirrored decks, so it is the main lever)`,
);
