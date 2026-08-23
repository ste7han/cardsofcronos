// The grant climbs in steps of $35K. Cards cost $20K, $40K, $80K, $200K, $280K
// and an action costs $50K. Those two ladders do not mesh, and the leftover is
// what falls between the rungs: on turn one $35K buys one common and $15K is
// left with nothing in the set cheap enough to spend it on.
//
// Measured elsewhere: the rule destroys ~18% of a player's market cap and the
// player who wasted less wins 74.7% of mirrored matches. So the size of the step
// is not a detail — it is currently the strongest lever in the game, and nobody
// chose it for that.
//
// This sweeps the step size and reports what each one wastes. A step that
// divides the price list should waste far less without changing anything about
// what a card does. Market cap is reported beside it, because a step that wastes
// nothing by making everything affordable is not an improvement either.
//
//   npx tsx scripts/budget-ladder.ts [matches per step]

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { formatMC } from "../engine/format";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import { RULES } from "../engine/types";

const index = buildIndex(CARDS);
const MATCHES = Number(process.argv[2] ?? 400);
const STEPS = [20_000, 25_000, 30_000, 35_000, 40_000, 45_000, 50_000, 60_000];

/** RULES is `as const` for TypeScript, not frozen at runtime. */
const rules = RULES as unknown as { budgetPerTurn: number };
const original = rules.budgetPerTurn;

type Row = { step: number; waste: number; granted: number; mc: number; cards: number };
const rows: Row[] = [];

for (const step of STEPS) {
  rules.budgetPerTurn = step;
  let waste = 0;
  let granted = 0;
  let mc = 0;
  let cards = 0;

  for (let seed = 0; seed < MATCHES; seed++) {
    const deck = buildDeck(CARDS, seed);
    let state = newMatch(CARDS, seed, { you: deck, opponent: deck });
    let guard = 0;

    while (!state.finished && guard++ < 600) {
      const before = state;
      const move = chooseMove(state, index);
      if (move.kind === "playCard") cards += 1;
      if (move.kind === "endTurn") {
        waste += before.budgetThisTurn - before.budgetSpentThisTurn;
        granted += before.budgetThisTurn;
      }
      state = applyMove(state, move, index);
    }
    mc += (state.players.you.mc + state.players.opponent.mc) / 2;
  }

  rows.push({
    step,
    waste: waste / MATCHES / 2,
    granted: granted / MATCHES / 2,
    mc: mc / MATCHES,
    cards: cards / MATCHES / 2,
  });
}

rules.budgetPerTurn = original;

console.log(`${MATCHES} mirrored matches per step, seeds 0..${MATCHES - 1}\n`);
console.log(`  step    granted    wasted   share   cards played   market cap`);
for (const r of rows) {
  const share = ((r.waste / r.granted) * 100).toFixed(0);
  const mark = r.step === original ? "  <- today" : "";
  console.log(
    `  ${formatMC(r.step).padStart(5)}  ${formatMC(r.granted).padStart(8)}  ` +
      `${formatMC(r.waste).padStart(8)}   ${share.padStart(3)}%   ` +
      `${r.cards.toFixed(1).padStart(10)}   ${formatMC(r.mc).padStart(9)}${mark}`,
  );
}
console.log(
  `\n  Everything here is per player per match. Nothing about any card changed;` +
    `\n  only the size of the step the budget climbs in.`,
);
