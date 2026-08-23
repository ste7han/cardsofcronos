// One line of measurement for one setting of the waste rule. Driven from the
// shell over several values of WASTE_PENALTY, which is a plain constant and
// cannot be swept from inside a script — see the header of budget-ladder.ts for
// the sibling question about step size.
//
//   npx tsx scripts/rule-grip.ts [matches]

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { formatMC } from "../engine/format";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import { WASTE_PENALTY, type Player } from "../engine/types";

const index = buildIndex(CARDS);
const MATCHES = Number(process.argv[2] ?? 1200);

let agreed = 0;
let decided = 0;
let wasted = 0;
let mc = 0;
let zeroed = 0;

for (let seed = 0; seed < MATCHES; seed++) {
  const deck = buildDeck(CARDS, seed);
  let state = newMatch(CARDS, seed, { you: deck, opponent: deck });
  const waste: Record<Player, number> = { you: 0, opponent: 0 };
  let guard = 0;

  while (!state.finished && guard++ < 600) {
    const before = state;
    const move = chooseMove(state, index);
    if (move.kind === "endTurn") {
      waste[before.toMove] += before.budgetThisTurn - before.budgetSpentThisTurn;
    }
    state = applyMove(state, move, index);
  }

  const you = state.players.you.mc;
  const them = state.players.opponent.mc;
  if (you === 0 || them === 0) zeroed += 1;
  wasted += (waste.you + waste.opponent) / 2;
  mc += (you + them) / 2;
  if (you === them || waste.you === waste.opponent) continue;
  decided += 1;
  if (waste.you < waste.opponent === you > them) agreed += 1;
}

console.log(
  `  ${String(WASTE_PENALTY).padStart(5)}   ${((agreed / decided) * 100).toFixed(1).padStart(6)}%   ` +
    `${formatMC(wasted / MATCHES).padStart(9)}   ${formatMC(mc / MATCHES).padStart(9)}   ` +
    `${((zeroed / MATCHES) * 100).toFixed(1).padStart(5)}%`,
)
