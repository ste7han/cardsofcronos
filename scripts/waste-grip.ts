// The player who wastes less wins about three matches in four with mirrored
// decks. That is the budget rule deciding the game, not the cards.
//
// The question this asks: is that grip a property of the rule, or of the step
// size? A step of $40K divides every price in the set and leaves far less on the
// table (see budget-ladder.ts). If the grip loosens with it, the step was the
// problem. If it does not, the rule itself is.
//
//   npx tsx scripts/waste-grip.ts [matches per step]

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { formatMC } from "../engine/format";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import { RULES, type Player } from "../engine/types";

const index = buildIndex(CARDS);
const MATCHES = Number(process.argv[2] ?? 1500);
const STEPS = [35_000, 40_000];

const rules = RULES as unknown as { budgetPerTurn: number };
const original = rules.budgetPerTurn;

console.log(`${MATCHES} mirrored matches per step\n`);
console.log(`  step   the player who wasted less won   wasted per player   market cap`);

for (const step of STEPS) {
  rules.budgetPerTurn = step;
  let agreed = 0;
  let decided = 0;
  let wasted = 0;
  let mc = 0;

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
    wasted += (waste.you + waste.opponent) / 2;
    mc += (you + them) / 2;
    if (you === them || waste.you === waste.opponent) continue;
    decided += 1;
    if (waste.you < waste.opponent === you > them) agreed += 1;
  }

  const mark = step === original ? "  <- today" : "";
  console.log(
    `  ${formatMC(step).padStart(5)}   ${((agreed / decided) * 100).toFixed(1).padStart(28)}%   ` +
      `${formatMC(wasted / MATCHES).padStart(16)}   ${formatMC(mc / MATCHES).padStart(9)}${mark}`,
  );
}

rules.budgetPerTurn = original;
console.log(
  `\n  50% would mean the rule decides nothing. Decks are mirrored, so anything` +
    `\n  above that is the budget rule and not deck quality.`,
);
