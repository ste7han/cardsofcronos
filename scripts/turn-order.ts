// Is moving first fair, on the rules as they are actually built?
//
// scripts/night-first-move.ts measured candidates by patching a state after the
// engine had dealt it. That is the right way to compare proposals and the wrong
// way to confirm one: a simulation of a rule and the rule are two different
// programs, and the gap between them is exactly where a change goes wrong
// quietly. This runs the engine and nothing else.
//
// It is also the script to run after any change to the set or the rules. Moving
// first is paid for by RULES.firstMoveFreeCard — one card played for nothing —
// and what that is worth depends on the set: it is the price of the dearest card
// a hand of five tends to hold. Change the rarity mix, the card costs or the
// balance between building and taking and this moves, invisibly to every other
// measurement here. It does not fail. It just hands one seat a few points.
//
//   npx tsx scripts/turn-order.ts [matches] [first seed]

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { formatMC } from "../engine/format";
import { FIRST_MOVER, applyMove, buildIndex, newMatch } from "../engine/match";
import { otherPlayer } from "../engine/helpers";
import { RULES, type Player, type State } from "../engine/types";

const index = buildIndex(CARDS);
const MATCHES = Number(process.argv[2] ?? 7500);
const FROM = Number(process.argv[3] ?? 0);

const second: Player = otherPlayer(FIRST_MOVER);

let firstWins = 0;
let decided = 0;
let firstMC = 0;
let secondMC = 0;
let firstWasted = 0;
let secondWasted = 0;

for (let i = 0; i < MATCHES; i++) {
  const seed = FROM + i;
  // Both seats on a deck of their own, drawn the way newMatch would draw it.
  let state: State = newMatch(CARDS, seed, {
    you: buildDeck(CARDS, seed),
    opponent: buildDeck(CARDS, seed + 7919),
  });
  let guard = 0;
  while (!state.finished && guard++ < 400) {
    const move = chooseMove(state, index);
    if (move.kind === "endTurn") {
      const left = state.budgetThisTurn - state.budgetSpentThisTurn;
      if (state.toMove === FIRST_MOVER) firstWasted += left;
      else secondWasted += left;
    }
    state = applyMove(state, move, index);
  }
  firstMC += state.players[FIRST_MOVER].mc;
  secondMC += state.players[second].mc;
  if (state.winner === null) continue;
  decided++;
  if (state.winner === FIRST_MOVER) firstWins++;
}

const rate = firstWins / decided;
const band = 1.96 * Math.sqrt((rate * (1 - rate)) / decided);

/**
 * How far off fair this is allowed to be before it is worth acting on.
 *
 * Not the statistical band, and that distinction cost a wrong verdict on the
 * first run of this script. firstMoveBudget can only be a whole multiple of
 * budgetPerTurn, so the values either side of the one in use are not 50.6% and
 * 51.6% — they are 38.0% and 59.0%. Measuring to a tenth of a point and then
 * demanding the answer land inside that tenth asks the constant for a precision
 * it does not have, and reports the only sensible value in the game as a
 * failure.
 *
 * So the threshold is what the next step is worth, halved: past this, the step
 * next door really is the better one and the constant should move.
 */
// Two points either side, and no longer half a step of anything.
//
// This was half of what one step of firstMoveBudget was worth, because that rule
// could only move in whole turns of budget and asking it for more precision than
// it had reported the only sensible value as a failure. The rule is a free card
// now and there is no step, so the threshold went back to being what it should
// be: how far off fair is worth acting on. It said "fair" at 44.9% for one run
// before this was noticed, which is a verdict that had outlived its reason.
const STEP_IS_WORTH = 0.04;
const off = Math.abs(rate - 0.5);
const fair = off < STEP_IS_WORTH / 2;

const paidWith = RULES.firstMoveFreeCard
  ? "one card played for nothing"
  : RULES.firstMoveBudget > 0
    ? `${formatMC(RULES.firstMoveBudget)} of extra budget a turn`
    : RULES.firstMoveSeedMC > 0
      ? `${formatMC(RULES.firstMoveSeedMC)} of market cap up front`
      : "nothing at all";
console.log(
  `${MATCHES} matches on seeds ${FROM} to ${FROM + MATCHES}, the engine as built.\n` +
    `Moving first is paid for with ${paidWith}.\n`,
);
console.log(`  first player wins   ${(rate * 100).toFixed(1)}%  (band ±${(band * 100).toFixed(1)})`);
console.log(
  `  fair                ${fair ? "yes" : "NO — move RULES.firstMoveBudget one step"}` +
    `  (${(off * 100).toFixed(1)} points off, ±${(band * 100).toFixed(1)} of that is noise)`,
);
console.log(
  `  with no payment at all this seat last measured 42.2%, so the rule is worth` +
    ` about 8 points`,
);
console.log(`  final MC            first ${formatMC(firstMC / MATCHES)}, second ${formatMC(secondMC / MATCHES)}`);
console.log(`  budget wasted       first ${formatMC(firstWasted / MATCHES)}, second ${formatMC(secondWasted / MATCHES)}`);
console.log(
  `\nThe free card has no dial on it: it is worth what the hand happens to hold,` +
    `\nwhich is a mythic 38% of the time and a rare or a common 8% of the time. That` +
    `\nunevenness is the trade the rule was chosen with, and the note on` +
    `\nRULES.firstMoveFreeCard has the split. If this number drifts, the answer is` +
    `\nnot to tune the rule — there is nothing to tune — but to look at what the` +
    `\nset now deals into an opening hand.`,
);
