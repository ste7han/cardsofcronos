// Plays a match out in the terminal, bot against bot. Handy for checking the
// numbers without pulling the UI into it.
//
//   npm run match           one match with seed 1, full log
//   npm run match -- 42     the same with seed 42
//   npm run match -- 0 200  200 matches, summary only

import { CARDS } from "../data/cards";
import { chooseMove } from "../engine/bot";
import { formatMC } from "../engine/format";
import { applyMove, buildIndex, newMatch } from "../engine/match";
import type { State } from "../engine/types";
import { validateSet } from "../engine/validation";

const index = buildIndex(CARDS);
validateSet(CARDS);

const seed = Number(process.argv[2] ?? 1);
const count = Number(process.argv[3] ?? 1);

function playOut(s: number): State {
  let state = newMatch(CARDS, s);
  let steps = 0;
  while (!state.finished) {
    state = applyMove(state, chooseMove(state, index), index);
    if (++steps > 2000) throw new Error("The match doesn't end.");
  }
  return state;
}

if (count === 1) {
  const state = playOut(seed);
  for (const entry of state.log) {
    const who = entry.player === null ? "  --" : entry.player === "you" ? " YOU" : " BOT";
    console.log(`t${String(entry.turn).padStart(2)} ${who}  ${entry.text}`);
  }
  console.log("");
  console.log(
    `Final: you ${formatMC(state.players.you.mc)} — opponent ${formatMC(state.players.opponent.mc)}`,
  );
} else {
  const finals: number[] = [];
  let firstPlayerWins = 0;
  let draws = 0;
  for (let i = 0; i < count; i++) {
    const state = playOut(seed + i);
    finals.push(state.players.you.mc, state.players.opponent.mc);
    if (state.winner === "you") firstPlayerWins++;
    if (state.winner === null) draws++;
  }
  finals.sort((a, b) => a - b);
  const median = finals[Math.floor(finals.length / 2)]!;
  console.log(`${count} matches, seeds ${seed}..${seed + count - 1}`);
  console.log(
    `  first player wins : ${firstPlayerWins} (${Math.round((firstPlayerWins / count) * 100)}%)`,
  );
  console.log(`  draws             : ${draws}`);
  console.log(`  lowest final MC   : ${formatMC(finals[0]!)}`);
  console.log(`  median final MC   : ${formatMC(median)}`);
  console.log(`  highest final MC  : ${formatMC(finals[finals.length - 1]!)}`);
}
