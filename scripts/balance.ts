// Balance instrumentation across many matches.
//
// CLAUDE.md: "A safety net across many matches. Record a few thousand matches
// before a change and compare afterwards." This is that net. It reports where an
// edge comes from, not just that one exists — a win rate on its own tells you
// something is wrong but never what.
//
//   npm run balance            1000 matches from seed 0
//   npm run balance -- 0 5000  5000 matches

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { formatMC } from "../engine/format";
import { buildDeck } from "../engine/deck";
import { applyMove, buildIndex, newMatch, pumpOf } from "../engine/match";
import type { Player, State } from "../engine/types";
import { PLAYERS, RULES } from "../engine/types";
import { validateSet } from "../engine/validation";

const index = buildIndex(CARDS);
validateSet(CARDS);

const seed = Number(process.argv[2] ?? 0);
const count = Number(process.argv[3] ?? 1000);

interface Trace {
  /** Market cap after each player's own pump phase, one entry per turn. */
  mcAfterTurn: Record<Player, number[]>;
  /** Cards played per turn, one entry per turn. */
  playsPerTurn: Record<Player, number[]>;
  /** Pump rate after each player's own turn — the size of the engine, not the score. */
  pumpAfterTurn: Record<Player, number[]>;
  /** Positions held after each player's own turn. */
  positionsAfterTurn: Record<Player, number[]>;
  /** How often each player banked a position on purpose. */
  profitTakes: Record<Player, number>;
  winner: Player | null;
}

function trace(s: number): Trace {
  // Both sides get the same deck. Turn order is what this script measures, and
  // deck luck would otherwise sit on top of it as noise.
  const deck = buildDeck(CARDS, s);
  let state: State = newMatch(CARDS, s, { you: deck, opponent: deck });
  const mcAfterTurn: Record<Player, number[]> = { you: [], opponent: [] };
  const playsPerTurn: Record<Player, number[]> = { you: [], opponent: [] };
  const pumpAfterTurn: Record<Player, number[]> = { you: [], opponent: [] };
  const positionsAfterTurn: Record<Player, number[]> = { you: [], opponent: [] };
  const profitTakes: Record<Player, number> = { you: 0, opponent: 0 };
  let plays = 0;
  let steps = 0;

  while (!state.finished) {
    const mover = state.toMove;
    const move = chooseMove(state, index);
    if (move.kind === "playCard") plays += 1;
    if (move.kind === "takeProfit") {
      plays += 1;
      profitTakes[mover] += 1;
    }
    state = applyMove(state, move, index);

    // The mover changing means that player just ended their turn, pump included.
    if (state.toMove !== mover || state.finished) {
      mcAfterTurn[mover].push(state.players[mover].mc);
      playsPerTurn[mover].push(plays);
      pumpAfterTurn[mover].push(
        state.players[mover].projects.reduce((sum, _, i) => sum + pumpOf(state, mover, i, index), 0),
      );
      positionsAfterTurn[mover].push(state.players[mover].projects.length);
      plays = 0;
    }
    if (++steps > 2000) throw new Error("The match doesn't end.");
  }
  return {
    mcAfterTurn,
    playsPerTurn,
    pumpAfterTurn,
    positionsAfterTurn,
    profitTakes,
    winner: state.winner,
  };
}

const traces: Trace[] = [];
for (let i = 0; i < count; i++) traces.push(trace(seed + i));

const firstWins = traces.filter((t) => t.winner === "you").length;
const draws = traces.filter((t) => t.winner === null).length;

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
}

console.log(`${count} matches, seeds ${seed}..${seed + count - 1}, mirrored decks`);
console.log("");
console.log(
  `  first player wins : ${firstWins} (${((firstWins / count) * 100).toFixed(1)}%)   draws: ${draws}`,
);
// Standard error on a proportion, so you can tell a real edge from noise.
const stderr = Math.sqrt(0.25 / count) * 100;
console.log(`  95% band on a fair game: ${(50 - 1.96 * stderr).toFixed(1)}% – ${(50 + 1.96 * stderr).toFixed(1)}%`);
console.log("");
console.log("  turn   first player      second player     gap (second − first)");

for (let turn = 0; turn < RULES.turns; turn++) {
  const first = mean(traces.map((t) => t.mcAfterTurn.you[turn] ?? 0));
  const second = mean(traces.map((t) => t.mcAfterTurn.opponent[turn] ?? 0));
  const gap = second - first;
  const bar = gap > 0 ? "+".repeat(Math.min(30, Math.round(gap / 8_000))) : "";
  console.log(
    `  ${String(turn + 1).padStart(4)}   ${formatMC(first).padStart(10)}      ${formatMC(second).padStart(10)}      ${formatMC(gap).padStart(9)} ${bar}`,
  );
}

console.log("");
console.log("  turn   pump rate first   pump rate second   positions first / second");
for (let turn = 0; turn < RULES.turns; turn++) {
  const pf = mean(traces.map((t) => t.pumpAfterTurn.you[turn] ?? 0));
  const ps = mean(traces.map((t) => t.pumpAfterTurn.opponent[turn] ?? 0));
  const nf = mean(traces.map((t) => t.positionsAfterTurn.you[turn] ?? 0));
  const ns = mean(traces.map((t) => t.positionsAfterTurn.opponent[turn] ?? 0));
  console.log(
    `  ${String(turn + 1).padStart(4)}   ${formatMC(pf).padStart(13)}   ${formatMC(ps).padStart(16)}   ${nf.toFixed(2)} / ${ns.toFixed(2)}`,
  );
}

console.log("");
console.log(
  `  profit taken per match: first ${mean(traces.map((t) => t.profitTakes.you)).toFixed(2)}` +
    `   second ${mean(traces.map((t) => t.profitTakes.opponent)).toFixed(2)}`,
);
console.log("");
console.log("  plays per turn (cards played plus positions banked)");
for (const player of PLAYERS) {
  const perTurn = Array.from({ length: RULES.turns }, (_, turn) =>
    mean(traces.map((t) => t.playsPerTurn[player][turn] ?? 0)).toFixed(2),
  );
  console.log(`  ${player === "you" ? "first " : "second"}  ${perTurn.join("  ")}`);
}
