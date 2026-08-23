// Bot against bot with different policies, to ask whether a change to the bot is
// better play or merely a change.
//
// Both sides normally run the same policy, so a win rate cannot tell you whether
// a tweak helped — it stays at 50% by construction. This pits two policies
// against each other and swaps who moves first every match, so turn order cannot
// flatter either side.
//
// Any single knob on BotPolicy can be duelled; the rest stays at its default.
//
//   npm run duel                                    profitRisk 0.45 against 0.25
//   npm run duel -- 0.25 0 4000                     0.25 against never banking
//   npm run duel -- discardBelow 20000 0 4000       discarding against never discarding

import { CARDS } from "../data/cards";
import { DEFAULT_POLICY, chooseMove, type BotPolicy } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import { validateSet } from "../engine/validation";

const index = buildIndex(CARDS);
validateSet(CARDS);

// First argument is either a policy field or, for the old form, a profitRisk
// value. Anything that is neither is a typo, and a typo that silently duelled
// the default against itself would report a tidy 50% and mean nothing.
const fields = Object.keys(DEFAULT_POLICY) as (keyof BotPolicy)[];
const named = fields.includes(process.argv[2] as keyof BotPolicy);
if (process.argv[2] !== undefined && !named && Number.isNaN(Number(process.argv[2]))) {
  throw new Error(
    `"${process.argv[2]}" is not a policy field. Known fields: ${fields.join(", ")}.`,
  );
}

const field: keyof BotPolicy = named ? (process.argv[2] as keyof BotPolicy) : "profitRisk";
const argv = named ? process.argv.slice(3) : process.argv.slice(2);
const valueA = Number(argv[0] ?? 0.45);
const valueB = Number(argv[1] ?? 0.25);
const count = Number(argv[2] ?? 4000);

function duel(seed: number, first: BotPolicy, second: BotPolicy) {
  // Same deck on both sides: the policy is what is being compared, not the draw.
  const deck = buildDeck(CARDS, seed);
  let state = newMatch(CARDS, seed, { you: deck, opponent: deck });
  let steps = 0;
  while (!state.finished) {
    state = applyMove(state, chooseMove(state, index, state.toMove === "you" ? first : second), index);
    if (++steps > 2000) throw new Error("The match doesn't end.");
  }
  return state;
}

const a: BotPolicy = { ...DEFAULT_POLICY, [field]: valueA };
const b: BotPolicy = { ...DEFAULT_POLICY, [field]: valueB };
let aWins = 0;
let draws = 0;
let decided = 0;

for (let i = 0; i < count; i++) {
  const aMovesFirst = i % 2 === 0;
  const state = aMovesFirst ? duel(i, a, b) : duel(i, b, a);
  if (state.winner === null) {
    draws++;
  } else {
    decided++;
    if ((state.winner === "you") === aMovesFirst) aWins++;
  }
}

// Out of the matches that produced a winner, not out of all of them. A rule that
// grinds both players to zero produces draws by the hundred, and dividing by the
// total then reads as a loss: 717 wins of 1211 decided is 59%, and looked like
// 36% until this was fixed.
const share = decided > 0 ? (aWins / decided) * 100 : 0;
const stderr = Math.sqrt(0.25 / Math.max(1, decided)) * 100;
console.log(`${count} matches, sides swapped every match`);
console.log(`  ${field} ${valueA} wins ${aWins} (${share.toFixed(1)}%) against ${valueB}`);
console.log(`  draws: ${draws} of ${count} — win rate is out of the ${decided} that were decided`);
console.log(
  `  95% band if the two are equal: ${(50 - 1.96 * stderr).toFixed(1)}% – ${(50 + 1.96 * stderr).toFixed(1)}%`,
);
