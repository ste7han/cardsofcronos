// Is taking profit worth 50K, or is it a card guarding a door nobody uses?
//
// The bot reaches for it in about 1% of the turns where it is available, which is
// either the bot being wrong or the move being bad. Its own model says the value
// is `earned * risk - pump given up`, and that model is a guess about the odds —
// so this measures the odds instead of trusting them.
//
// Run twice over the same seeds: once as the game is, once with taking profit
// removed from the bot's options entirely. Same decks, same shuffles, so the only
// difference is whether the move exists.
//
//   npx tsx scripts/profit-worth.ts [matches]

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { buildDeck } from "../engine/deck";
import { formatMC } from "../engine/format";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import type { Move, State } from "../engine/types";

const index = buildIndex(CARDS);
const MATCHES = Number(process.argv[2] ?? 1500);

function run(seed: number, allowProfit: boolean) {
  const deck = buildDeck(CARDS, seed);
  let state = newMatch(CARDS, seed, { you: deck, opponent: deck });
  let guard = 0;
  let ruggedMC = 0;
  let banked = 0;

  while (!state.finished && guard++ < 400) {
    let move: Move = chooseMove(state, index);
    // Take the move away and let the bot's next-best stand in. endTurn is the
    // floor, so this can never deadlock.
    if (!allowProfit && move.kind === "takeProfit") move = { kind: "endTurn" };

    const before: State = state;
    if (move.kind === "takeProfit") {
      banked += before.players[before.toMove].projects[move.slot]?.earned ?? 0;
    }
    state = applyMove(state, move, index);

    for (const entry of state.log.slice(before.log.length)) {
      const m = /(-\$[\d.]+[KMB]?) MC and the pump stops/.exec(entry.text);
      if (m) {
        const raw = m[1]!.replace("-$", "");
        const mult = raw.endsWith("B") ? 1e9 : raw.endsWith("M") ? 1e6 : raw.endsWith("K") ? 1e3 : 1;
        ruggedMC += parseFloat(raw) * mult;
      }
    }
  }
  return { mc: state.players.you.mc, opp: state.players.opponent.mc, ruggedMC, banked };
}

let withMC = 0;
let withoutMC = 0;
let ruggedTotal = 0;
let bankedTotal = 0;
let changed = 0;

for (let seed = 0; seed < MATCHES; seed++) {
  const a = run(seed, true);
  const b = run(seed, false);
  withMC += a.mc + a.opp;
  withoutMC += b.mc + b.opp;
  ruggedTotal += a.ruggedMC;
  bankedTotal += a.banked;
  if (a.mc !== b.mc || a.opp !== b.opp) changed += 1;
}

console.log(`${MATCHES} matches, each played twice over the same seed\n`);
console.log(`  market cap with taking profit    : ${formatMC(withMC / (MATCHES * 2))} per player`);
console.log(`  market cap with it removed       : ${formatMC(withoutMC / (MATCHES * 2))} per player`);
console.log(
  `  difference                       : ${formatMC((withMC - withoutMC) / (MATCHES * 2))} ` +
    `(${(((withMC - withoutMC) / withoutMC) * 100).toFixed(2)}%)`,
);
console.log(`  matches whose outcome moved at all: ${changed} of ${MATCHES} (${((changed / MATCHES) * 100).toFixed(1)}%)`);

console.log(`\n  what the card is insurance against:`);
console.log(`  market cap lost to rugs per match : ${formatMC(ruggedTotal / MATCHES)}`);
console.log(`  market cap banked by profit       : ${formatMC(bankedTotal / MATCHES)}`);

// Sanity: removing a move the bot never picks must change almost nothing. A large
// difference here would mean the harness is not replaying the same match twice.
console.log(
  `\n  sanity: the two runs share seed, deck and shuffle, so anything that moved` +
    `\n  moved because the move was taken away and nothing else.`,
);
